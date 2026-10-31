"""
Test doubles for the search and LLM provider interfaces.

These exist ONLY for automated tests (no network, deterministic). They are not part of the
product package and are never selected by the provider factories. All content is obviously
synthetic: fixture URLs use the reserved ``.test`` TLD and snippets carry no real-world claims.
"""

import hashlib

from backend.app.models.evidence import Evidence
from backend.app.providers.llm.base import (
    AnalysisOutput,
    Citation,
    KeyFinding,
    LLMProvider,
    LLMProviderError,
)
from backend.app.providers.search.base import SearchProvider, SearchResult


class MockSearchProvider(SearchProvider):
    """Returns a fixed number of synthetic fixture results for any non-empty query."""

    @property
    def provider_name(self) -> str:
        return "mock"

    async def search(self, query: str, max_results: int = 5) -> list[SearchResult]:
        clean = (query or "").strip()
        if not clean:
            return []
        digest = hashlib.md5(clean.encode("utf-8")).hexdigest()[:8]
        results = []
        for n in range(1, min(max_results, 4) + 1):
            results.append(
                SearchResult(
                    title=f"[TEST FIXTURE {n}] {clean}",
                    url=f"https://fixtures.example.test/{digest}/{n}",
                    content=f"Fixture snippet {n} for the query '{clean}'. It contains no real-world data.",
                    score=round(1.0 - n * 0.1, 2),
                    published_date="2024-01-01T00:00:00Z",
                    raw_metadata={"query": clean, "fixture": True},
                )
            )
        return results


class MockLLMProvider(LLMProvider):
    """Quotes the first fixture evidence snippets; raises on empty evidence like the real providers."""

    def __init__(self, model_name: str = "test-fixture-llm"):
        self._model_name = model_name

    @property
    def provider_name(self) -> str:
        return "mock"

    @property
    def model_name(self) -> str:
        return self._model_name

    async def analyze(
        self, task_type: str, research_question: str, evidence_items: list[Evidence]
    ) -> AnalysisOutput:
        if not evidence_items:
            raise LLMProviderError("No evidence supplied")
        findings, citations, seen = [], [], set()
        for ev in evidence_items[:4]:
            if ev.source_url in seen:
                continue
            seen.add(ev.source_url)
            citations.append(Citation(url=ev.source_url, title=ev.source_title or ev.source_url))
            score = float((ev.provider_metadata or {}).get("relevance_score", 0.9))
            findings.append(KeyFinding(claim=ev.snippet[:150], source_url=ev.source_url, confidence=round(score, 2)))
        return AnalysisOutput(
            key_findings=findings,
            grounded_summary=f"Test fixture analysis of {len(evidence_items)} evidence items for {task_type}.",
            confidence_score=round(sum(f.confidence for f in findings) / len(findings), 2),
            citations=citations,
            model_name=self._model_name,
        )


# ----------------------------------------------------------------------------
# Recorded-shape HTTP responses for SEC EDGAR and arXiv (used with httpx.MockTransport).
# The shapes follow the real public APIs; the content is synthetic test data.
# ----------------------------------------------------------------------------
import json  # noqa: E402

import httpx  # noqa: E402

_RISK_BODY = (
    "Our production ramp could be adversely affected by supplier shortage and manufacturing yield "
    "bottlenecks, which may delay deliveries. Regulatory investigation or litigation could also "
    "disrupt operations and harm our financial results. "
) * 4


def _filing_html() -> str:
    return (
        "<html><body><p>TABLE OF CONTENTS</p><p>Item 1A. Risk Factors 12</p>"
        "<p>Item 1B. Unresolved Staff Comments 30</p>"
        f"<div>Item 1A. Risk Factors</div><p>{_RISK_BODY}</p>"
        "<div>Item 1B. Unresolved Staff Comments</div><p>None.</p></body></html>"
    )


_TICKERS = {
    "0": {"cik_str": 1318605, "ticker": "TSLA", "title": "Tesla, Inc."},
    "1": {"cik_str": 1535527, "ticker": "CRWD", "title": "CrowdStrike Holdings, Inc."},
}


def _submissions(cik: int) -> dict:
    return {
        "cik": str(cik),
        "filings": {
            "recent": {
                "accessionNumber": ["0000000000-25-000003", "0000000000-25-000002", "0000000000-25-000001"],
                "filingDate": ["2025-04-20", "2025-01-30", "2025-01-10"],
                "reportDate": ["2025-03-31", "2024-12-31", "2025-01-09"],
                "form": ["10-Q", "10-K", "8-K"],
                "primaryDocument": ["q1.htm", "annual.htm", "current.htm"],
                "primaryDocDescription": ["10-Q", "10-K", "8-K"],
                "items": ["", "", "2.02"],
            }
        },
    }


_ATOM = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.00001v2</id>
    <published>2024-01-02T00:00:00Z</published>
    <title>A study of solid-state battery interfaces</title>
    <summary>We study interfacial degradation in solid-state cells. A key limitation is limited cycle life
    under high current density, which remains a challenge for scaling.</summary>
    <author><name>Test Author One</name></author>
    <author><name>Test Author Two</name></author>
    <category term="cond-mat.mtrl-sci"/>
  </entry>
</feed>"""


def sec_arxiv_handler(request: httpx.Request) -> httpx.Response:
    """Routes SEC EDGAR and arXiv requests to recorded-shape payloads."""
    host, path = request.url.host, request.url.path
    if host == "www.sec.gov" and path == "/files/company_tickers.json":
        return httpx.Response(200, content=json.dumps(_TICKERS))
    if host == "data.sec.gov" and path.startswith("/submissions/CIK"):
        cik = int(path.split("CIK")[1].split(".")[0])
        return httpx.Response(200, content=json.dumps(_submissions(cik)))
    if host == "www.sec.gov" and path.startswith("/Archives/edgar/data/"):
        return httpx.Response(200, text=_filing_html())
    if host == "export.arxiv.org" and path == "/api/query":
        return httpx.Response(200, text=_ATOM)
    return httpx.Response(404, text="not found")


def install_sec_arxiv_transport(monkeypatch) -> None:
    """Makes every default-constructed httpx.AsyncClient use ``sec_arxiv_handler``."""
    from backend.app.providers import sec_edgar

    sec_edgar._ticker_cache.update(loaded_at=0.0, rows=[])
    original = httpx.AsyncClient

    class _Routed(original):  # type: ignore[misc, valid-type]
        def __init__(self, *args, **kwargs):
            kwargs.setdefault("transport", httpx.MockTransport(sec_arxiv_handler))
            super().__init__(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", _Routed)
