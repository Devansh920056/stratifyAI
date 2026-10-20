"""
Live Real-Time Web Evidence Provider.
Queries open authoritative web sources (Wikipedia Search API, DuckDuckGo Instant Answer API,
and DuckDuckGo Web) to retrieve genuine, verifiable web evidence at zero financial cost
without requiring paid subscriptions or API keys.
"""

import html
import logging
import re
import urllib.parse

import httpx

from backend.app.providers.search.base import (
    SearchProvider,
    SearchResult,
)
from backend.app.providers.search.sanitizer import (
    sanitize_snippet,
    validate_and_normalize_url,
)

logger = logging.getLogger("stratify.providers.search.duckduckgo")

WIKIPEDIA_ENDPOINT = "https://en.wikipedia.org/w/api.php"
DUCKDUCKGO_API_ENDPOINT = "https://api.duckduckgo.com/"
DUCKDUCKGO_HTML_ENDPOINT = "https://html.duckduckgo.com/html/"

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 "
        "StratifyAI/1.0"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


class DuckDuckGoSearchProvider(SearchProvider):
    """
    Live web search evidence provider.
    Retrieves grounded, verifiable real-world web evidence at zero cost
    using multi-source live web APIs and anti-bot resilient querying.
    """

    def __init__(
        self,
        timeout_seconds: float = 12.0,
        client: httpx.AsyncClient | None = None,
    ):
        self._timeout = timeout_seconds
        self._client = client

    @property
    def provider_name(self) -> str:
        return "duckduckgo"

    async def search(self, query: str, max_results: int = 5) -> list[SearchResult]:
        """
        Executes real web search across open web APIs and returns deduplicated SearchResult items.
        """
        clean_query = query.strip()
        if not clean_query:
            return []

        results: list[SearchResult] = []
        seen_urls: set[str] = set()

        # Simplify query if it has overly verbose chained prompt terms
        search_terms = self._clean_query_terms(clean_query)

        if self._client:
            await self._execute_search_sources(
                self._client, search_terms, results, seen_urls, max_results
            )
        else:
            async with httpx.AsyncClient(
                headers=DEFAULT_HEADERS,
                timeout=self._timeout,
                follow_redirects=True,
            ) as client:
                await self._execute_search_sources(
                    client, search_terms, results, seen_urls, max_results
                )

        logger.info(
            f"Live search retrieved {len(results)} verified real web items for '{search_terms}' (requested max {max_results})"
        )
        return results[:max_results]

    def _clean_query_terms(self, query: str) -> str:
        """Strips excessive prompt keywords to focus on core factual entities."""
        # Remove trailing year ranges or redundant filler
        cleaned = re.sub(
            r"\b(202[4-9]-203[0-9]|Global|market size TAM growth rate|key market drivers trends)\b",
            "",
            query,
            flags=re.IGNORECASE,
        )
        words = cleaned.split()
        if len(words) > 8:
            return " ".join(words[:8])
        return cleaned.strip() or query

    async def _execute_search_sources(
        self,
        client: httpx.AsyncClient,
        query: str,
        results: list[SearchResult],
        seen_urls: set[str],
        max_results: int,
    ) -> None:
        """Queries multiple authoritative open web endpoints with resilient error handling."""

        # Source 1: Wikipedia Search API (Authoritative encyclopedia & market technology)
        try:
            wiki_resp = await client.get(
                WIKIPEDIA_ENDPOINT,
                params={
                    "action": "query",
                    "list": "search",
                    "srsearch": query,
                    "utf8": "",
                    "format": "json",
                },
            )
            if wiki_resp.status_code == 200:
                data = wiki_resp.json()
                items = data.get("query", {}).get("search", [])
                for idx, item in enumerate(items[:max_results]):
                    title = item.get("title", "")
                    raw_snippet = item.get("snippet", "")
                    clean_snip = sanitize_snippet(
                        html.unescape(re.sub(r"<[^>]+>", "", raw_snippet))
                    )
                    url_slug = title.replace(" ", "_")
                    norm_url = validate_and_normalize_url(
                        f"https://en.wikipedia.org/wiki/{url_slug}"
                    )
                    if norm_url and norm_url not in seen_urls and clean_snip:
                        seen_urls.add(norm_url)
                        results.append(
                            SearchResult(
                                title=title,
                                url=norm_url,
                                content=clean_snip,
                                score=round(0.96 - (idx * 0.03), 2),
                                raw_metadata={"source": "wikipedia", "rank": idx + 1},
                            )
                        )
        except Exception as exc:
            logger.debug(f"Wikipedia search warning: {exc}")

        # Source 2: DuckDuckGo Instant Answer API (Abstracts & Related Topics)
        try:
            ddg_resp = await client.get(
                DUCKDUCKGO_API_ENDPOINT,
                params={"q": query, "format": "json", "no_html": "1"},
            )
            if ddg_resp.status_code in (200, 202):
                data = ddg_resp.json()
                abstract = data.get("Abstract")
                abstract_url = data.get("AbstractURL")
                heading = data.get("Heading") or query

                if abstract and abstract_url:
                    norm_url = validate_and_normalize_url(abstract_url)
                    if norm_url and norm_url not in seen_urls:
                        seen_urls.add(norm_url)
                        results.append(
                            SearchResult(
                                title=heading,
                                url=norm_url,
                                content=sanitize_snippet(abstract),
                                score=0.98,
                                raw_metadata={"source": "duckduckgo_abstract"},
                            )
                        )

                for idx, topic in enumerate(data.get("RelatedTopics", [])[:3]):
                    if isinstance(topic, dict) and "Text" in topic and "FirstURL" in topic:
                        norm_url = validate_and_normalize_url(topic["FirstURL"])
                        if norm_url and norm_url not in seen_urls:
                            seen_urls.add(norm_url)
                            topic_text = topic["Text"]
                            results.append(
                                SearchResult(
                                    title=topic_text[:70],
                                    url=norm_url,
                                    content=sanitize_snippet(topic_text),
                                    score=round(0.90 - (idx * 0.04), 2),
                                    raw_metadata={"source": "duckduckgo_topic"},
                                )
                            )
        except Exception as exc:
            logger.debug(f"DuckDuckGo API search warning: {exc}")

        # Source 3: DuckDuckGo HTML Endpoint (Direct web results if quota permits)
        if len(results) < max_results:
            try:
                html_resp = await client.post(
                    DUCKDUCKGO_HTML_ENDPOINT,
                    data={"q": query},
                    headers=DEFAULT_HEADERS,
                )
                if html_resp.status_code == 200:
                    html_results = self._parse_duckduckgo_html(
                        html_resp.text, max_results=max_results
                    )
                    for item in html_results:
                        if item.url not in seen_urls:
                            seen_urls.add(item.url)
                            results.append(item)
            except Exception as exc:
                logger.debug(f"DuckDuckGo HTML search warning: {exc}")

    def _parse_duckduckgo_html(
        self, html_content: str, max_results: int = 5
    ) -> list[SearchResult]:
        """Parses HTML web results from DuckDuckGo HTML endpoint."""
        title_matches = re.findall(
            r"<a[^>]+class=\"[^\"]*result__a[^\"]*\"[^>]*>(.*?)</a>",
            html_content,
        )
        url_matches = re.findall(
            r"<a class=\"result__url\" href=\"([^\"]+)\">\s*([^\s<][^<]*)\s*</a>",
            html_content,
        )
        snippet_matches = re.findall(
            r"<a class=\"result__snippet\" href=\"[^\"]*\">([^<]*(?:<b>[^<]*</b>[^<]*)*)</a>",
            html_content,
        )

        results: list[SearchResult] = []
        limit = min(len(url_matches), len(snippet_matches), max_results)

        for i in range(limit):
            raw_url, domain_label = url_matches[i]
            raw_snippet = snippet_matches[i]

            clean_url = raw_url.strip()
            if "uddg=" in clean_url:
                parsed = urllib.parse.parse_qs(urllib.parse.urlparse(clean_url).query)
                if "uddg" in parsed:
                    clean_url = parsed["uddg"][0]

            normalized_url = validate_and_normalize_url(clean_url)
            if not normalized_url:
                continue

            cleaned_snippet = sanitize_snippet(
                html.unescape(re.sub(r"<[^>]+>", "", raw_snippet))
            )
            if not cleaned_snippet:
                continue

            if i < len(title_matches) and title_matches[i]:
                raw_title = html.unescape(
                    re.sub(r"<[^>]+>", "", title_matches[i])
                ).strip()
                title = raw_title if raw_title else domain_label.strip()
            else:
                title = domain_label.strip()

            results.append(
                SearchResult(
                    title=title,
                    url=normalized_url,
                    content=cleaned_snippet,
                    score=round(0.88 - (i * 0.04), 2),
                    raw_metadata={"source": "duckduckgo_html", "domain": domain_label.strip()},
                )
            )

        return results
