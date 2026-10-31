"""
SEC EDGAR Provider: live retrieval of real filings.

Data sources (all official SEC endpoints, see https://www.sec.gov/os/accessing-edgar-data):
  * https://www.sec.gov/files/company_tickers.json         - ticker/name -> CIK
  * https://data.sec.gov/submissions/CIK##########.json    - filing index for a company
  * https://www.sec.gov/Archives/edgar/data/...            - the filing documents themselves

Nothing is fabricated: if a company cannot be resolved, or SEC cannot be reached, the provider
returns no filings (or raises SECProviderError for network failures). Fair-access rules are
respected: a declared User-Agent is sent and requests are issued sequentially.
"""

import html
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from backend.app.core.config import get_settings

logger = logging.getLogger("stratify.providers.sec_edgar")

TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik:010d}.json"
ARCHIVE_URL = "https://www.sec.gov/Archives/edgar/data/{cik}/{accession_nodash}/{document}"

SUPPORTED_FORMS = ("10-K", "10-Q", "8-K", "20-F", "6-K", "40-F")
RISK_FACTOR_FORMS = ("10-K", "10-Q", "20-F")
MAX_RISK_DOCS_PER_REQUEST = 2  # keep outbound request volume small (SEC fair access)
MAX_DOCUMENT_BYTES = 6_000_000
EXCERPT_CHARS = 1200
TICKER_CACHE_TTL_SECONDS = 24 * 3600

# Reliability is a *source-class prior*, not a measurement: filings are primary, legally
# attested documents. It is recorded in metadata as such so consumers can tell.
SEC_SOURCE_RELIABILITY_PRIOR = 1.0

_ticker_cache: dict[str, Any] = {"loaded_at": 0.0, "rows": []}


class SECProviderError(Exception):
    """Raised when SEC EDGAR cannot be reached or returns an unexpected response."""


@dataclass
class SECFilingResult:
    entity_name: str
    ticker: str
    cik: str
    filing_type: str
    fiscal_period: str
    title: str
    content_excerpt: str
    source_url: str
    reliability_score: float = SEC_SOURCE_RELIABILITY_PRIOR
    metadata: dict[str, Any] = field(default_factory=dict)


def html_to_text(raw: str) -> str:
    """Converts filing HTML to plain text."""
    raw = re.sub(r"(?is)<(script|style|head)[^>]*>.*?</\1>", " ", raw)
    raw = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</tr>|</li>", "\n", raw)
    raw = re.sub(r"(?s)<[^>]+>", " ", raw)
    raw = html.unescape(raw).replace("\xa0", " ")
    raw = re.sub(r"[ \t\r\f\v]+", " ", raw)
    raw = re.sub(r"\n\s*\n+", "\n", raw)
    return raw.strip()


_ITEM_1A = re.compile(r"item\s*1a\s*[\.\:\-–—]?\s*risk\s*factors", re.IGNORECASE)
_ITEM_END = re.compile(
    r"item\s*1b\s*[\.\:\-–—]?\s*unresolved|item\s*2\s*[\.\:\-–—]?\s*(?:properties|management)|item\s*1c\s*[\.\:\-–—]?\s*cyber",
    re.IGNORECASE,
)


def extract_risk_factors(text: str, max_chars: int = EXCERPT_CHARS) -> str | None:
    """
    Extracts the opening of the real "Item 1A. Risk Factors" section from filing text.
    The table of contents repeats the heading, so the longest candidate section is used.
    Returns None when no substantial section is found.
    """
    flat = re.sub(r"\s+", " ", text)
    best = ""
    for match in _ITEM_1A.finditer(flat):
        start = match.end()
        end_match = _ITEM_END.search(flat, start)
        end = end_match.start() if end_match else min(len(flat), start + 20000)
        section = flat[start:end].strip()
        if len(section) > len(best):
            best = section
    if len(best) < 300:
        return None
    excerpt = best[:max_chars]
    if len(best) > max_chars:
        cut = excerpt.rfind(". ")
        excerpt = excerpt[: cut + 1] if cut > max_chars * 0.5 else excerpt.rstrip() + "..."
    return excerpt


class SECFilingsProvider:
    """Retrieves real filings from SEC EDGAR."""

    def __init__(
        self,
        timeout_seconds: float = 15.0,
        client: httpx.AsyncClient | None = None,
        user_agent: str | None = None,
    ):
        self.timeout = timeout_seconds
        self.client = client
        self.user_agent = user_agent or get_settings().SEC_USER_AGENT

    # ------------------------------------------------------------------ HTTP
    async def _get(self, client: httpx.AsyncClient, url: str) -> httpx.Response:
        headers = {"User-Agent": self.user_agent, "Accept-Encoding": "gzip, deflate"}
        try:
            response = await client.get(url, headers=headers, timeout=self.timeout, follow_redirects=True)
        except httpx.HTTPError as exc:
            raise SECProviderError(f"SEC request failed for {url}: {exc!s}") from exc
        if response.status_code != 200:
            raise SECProviderError(f"SEC returned HTTP {response.status_code} for {url}")
        return response

    async def _load_tickers(self, client: httpx.AsyncClient) -> list[dict[str, Any]]:
        now = time.time()
        if _ticker_cache["rows"] and now - _ticker_cache["loaded_at"] < TICKER_CACHE_TTL_SECONDS:
            return _ticker_cache["rows"]
        payload = (await self._get(client, TICKERS_URL)).json()
        rows = list(payload.values()) if isinstance(payload, dict) else list(payload)
        _ticker_cache.update(loaded_at=now, rows=rows)
        return rows

    # ------------------------------------------------------------ resolution
    @staticmethod
    def match_company(entity_name: str, rows: list[dict[str, Any]]) -> dict[str, Any] | None:
        """Matches a ticker or company name to a row of SEC's company_tickers.json."""
        query = entity_name.strip().lower()
        if not query:
            return None
        for row in rows:  # exact ticker
            if str(row.get("ticker", "")).lower() == query:
                return row
        for row in rows:  # exact company name
            if str(row.get("title", "")).lower() == query:
                return row
        word = re.compile(rf"\b{re.escape(query)}\b")
        contains = [r for r in rows if word.search(str(r.get("title", "")).lower())]
        if contains:  # shortest title = closest to the query (e.g. "Tesla, Inc.")
            return min(contains, key=lambda r: len(str(r.get("title", ""))))
        return None

    async def resolve_company(self, entity_name: str, client: httpx.AsyncClient) -> dict[str, Any] | None:
        rows = await self._load_tickers(client)
        row = self.match_company(entity_name, rows)
        if not row:
            return None
        return {
            "cik": int(row["cik_str"]),
            "ticker": str(row.get("ticker", "")),
            "name": str(row.get("title", entity_name)),
        }

    # --------------------------------------------------------------- filings
    async def get_filings_for_entity(self, entity_name: str, max_results: int = 5) -> list[SECFilingResult]:
        """
        Returns the company's most recent 10-K/10-Q/8-K/20-F/6-K/40-F filings, newest first.
        Returns [] when the company is not an SEC registrant; raises SECProviderError on outage.
        """
        if self.client is not None:
            return await self._get_filings(self.client, entity_name, max_results)
        async with httpx.AsyncClient() as client:
            return await self._get_filings(client, entity_name, max_results)

    async def _get_filings(
        self, client: httpx.AsyncClient, entity_name: str, max_results: int
    ) -> list[SECFilingResult]:
        company = await self.resolve_company(entity_name, client)
        if not company:
            logger.info("No SEC registrant found matching '%s'.", entity_name)
            return []

        cik = company["cik"]
        submissions = (await self._get(client, SUBMISSIONS_URL.format(cik=cik))).json()
        recent = (submissions.get("filings") or {}).get("recent") or {}
        forms = recent.get("form", [])

        def col(name: str, i: int) -> str:
            values = recent.get(name, [])
            return str(values[i]) if i < len(values) and values[i] is not None else ""

        results: list[SECFilingResult] = []
        risk_docs_fetched = 0
        for i, form in enumerate(forms):
            if form not in SUPPORTED_FORMS:
                continue
            if len(results) >= max_results:
                break

            accession = col("accessionNumber", i)
            document = col("primaryDocument", i)
            filing_date = col("filingDate", i)
            report_date = col("reportDate", i)
            items = col("items", i)
            description = col("primaryDocDescription", i)
            url = ARCHIVE_URL.format(cik=cik, accession_nodash=accession.replace("-", ""), document=document)

            excerpt: str | None = None
            excerpt_kind = "filing_metadata"
            if form in RISK_FACTOR_FORMS and document and risk_docs_fetched < MAX_RISK_DOCS_PER_REQUEST:
                risk_docs_fetched += 1
                try:
                    doc = await self._get(client, url)
                    excerpt = extract_risk_factors(html_to_text(doc.text[:MAX_DOCUMENT_BYTES]))
                    if excerpt:
                        excerpt_kind = "item_1a_risk_factors"
                except SECProviderError as exc:
                    logger.warning("Could not fetch filing document %s: %s", url, exc)

            if not excerpt:
                parts = [f"Form {form} filed {filing_date}"]
                if report_date:
                    parts.append(f"for period ending {report_date}")
                if description:
                    parts.append(f"({description})")
                if items:
                    parts.append(f"reporting items {items}")
                excerpt = " ".join(parts) + "."

            fiscal_period = f"FY {report_date[:4]}" if form in ("10-K", "20-F", "40-F") and report_date else (
                f"Period ending {report_date}" if report_date else f"Filed {filing_date}"
            )
            title = f"{company['name']} - Form {form} ({fiscal_period})"
            if excerpt_kind == "item_1a_risk_factors":
                title = f"Item 1A. Risk Factors - {company['name']} Form {form} ({fiscal_period})"

            results.append(
                SECFilingResult(
                    entity_name=company["name"],
                    ticker=company["ticker"],
                    cik=f"{cik:010d}",
                    filing_type=form,
                    fiscal_period=fiscal_period,
                    title=title,
                    content_excerpt=excerpt,
                    source_url=url,
                    metadata={
                        "cik": f"{cik:010d}",
                        "ticker": company["ticker"],
                        "accession_number": accession,
                        "filing_date": filing_date,
                        "report_date": report_date,
                        "excerpt_kind": excerpt_kind,
                        "reliability_basis": "source_class_prior",
                        "source": "SEC EDGAR",
                    },
                )
            )

        return results
