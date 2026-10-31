"""
Deterministic Mock Search Provider for testing and offline development.
"""

import hashlib
import logging

from backend.app.providers.search.base import SearchProvider, SearchResult

logger = logging.getLogger("stratify.providers.search.mock")


class MockSearchProvider(SearchProvider):
    """
    Deterministic mock search provider that generates grounded search evidence
    without external API dependencies or network overhead.
    """

    @property
    def provider_name(self) -> str:
        return "mock"

    async def search(self, query: str, max_results: int = 5) -> list[SearchResult]:
        """
        Generates realistic search results based on the provided query terms.
        """
        if not query or not query.strip():
            return []

        clean_query = query.strip()
        query_hash = hashlib.md5(clean_query.encode("utf-8")).hexdigest()[:8]

        sources = [
            (
                f"Global Market Sizing and 2024-2030 Projections: {clean_query}",
                f"https://mock-market-intelligence.internal/reports/{query_hash}/market-overview",
                (
                    f"Comprehensive market assessment regarding '{clean_query}'. In 2024, the sector reached "
                    f"an estimated valuation of $48.2 billion, projected to expand to $134.5 billion by 2030 "
                    f"(CAGR of 18.7%). Growth is driven by rapid technological adoption, regulatory modernization, "
                    f"and surging enterprise demand across key demographic clusters."
                ),
                0.96,
                "2024-03-15T08:00:00Z",
            ),
            (
                f"Competitive Benchmarking & Strategic Dynamics in {clean_query}",
                f"https://mock-market-intelligence.internal/reports/{query_hash}/competitive-benchmarks",
                (
                    "Competitive analysis reveals the top 3 incumbent providers control 61% of total market share, "
                    "though challenger platforms are capturing 24% year-over-year gains in mid-market accounts. "
                    "Key product differentiation focuses on AI automation, API interoperability, and flexible pricing tiers."
                ),
                0.91,
                "2024-04-02T12:30:00Z",
            ),
            (
                f"Customer Adoption Trends and Willingness to Pay: {clean_query}",
                f"https://mock-market-intelligence.internal/reports/{query_hash}/customer-insights",
                (
                    f"Empirical buyer surveys for '{clean_query}' indicate 78% of enterprise decision-makers plan "
                    f"to increase budget allocations by 15-30% over the next 18 months. Primary purchase drivers include "
                    f"operational speed (84%) and lower total cost of ownership (71%)."
                ),
                0.87,
                "2024-05-10T14:15:00Z",
            ),
            (
                f"Regulatory Compliance & Risk Landscape: {clean_query}",
                f"https://mock-market-intelligence.internal/reports/{query_hash}/regulatory-brief",
                (
                    f"Recent regulatory updates across North America and the European Union introduce enhanced "
                    f"data provenance and security requirements for '{clean_query}'. Early-compliant firms gain "
                    f"a distinct procurement advantage in highly regulated sectors."
                ),
                0.82,
                "2024-06-20T09:45:00Z",
            ),
        ]

        count = min(max_results, len(sources))
        results: list[SearchResult] = []
        for title, url, snippet, score, pub_date in sources[:count]:
            results.append(
                SearchResult(
                    title=title,
                    url=url,
                    content=snippet,
                    score=score,
                    published_date=pub_date,
                    raw_metadata={"query": clean_query, "deterministic": True},
                )
            )

        logger.info(
            f"[MockSearch] Generated {len(results)} mock evidence items for '{clean_query[:40]}'."
        )
        return results
