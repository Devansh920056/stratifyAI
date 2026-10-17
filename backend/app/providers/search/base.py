"""
Abstract Base Classes and Data Contracts for Search Providers.
"""

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class SearchResult:
    """Standardized search evidence item retrieved from external sources."""

    title: str
    url: str
    content: str
    score: float = 0.0
    published_date: str | None = None
    raw_metadata: dict[str, Any] = field(default_factory=dict)


class SearchProviderError(Exception):
    """Base exception for search provider failures."""


class SearchAuthError(SearchProviderError):
    """Authentication or API key authorization failure."""


class SearchRateLimitError(SearchProviderError):
    """Provider rate limit or quota exceeded (HTTP 429)."""


class SearchTimeoutError(SearchProviderError):
    """Search request timed out before response was received."""


class SearchProvider(ABC):
    """Abstract interface defining required contract for all search providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Identifying name of the provider (e.g. 'tavily', 'mock')."""

    @abstractmethod
    async def search(self, query: str, max_results: int = 5) -> list[SearchResult]:
        """
        Executes a search query and returns standardized search results.

        :param query: Natural language or keyword query string
        :param max_results: Maximum results to retrieve (default: 5)
        :return: List of SearchResult items
        """

    async def search_batch(
        self, queries: list[str], max_results_per_query: int = 5
    ) -> list[SearchResult]:
        """
        Executes multiple search queries concurrently and aggregates results.

        :param queries: List of query strings
        :param max_results_per_query: Results to retrieve per query
        :return: Aggregated list of SearchResult items
        """
        if not queries:
            return []

        tasks = [self.search(q, max_results=max_results_per_query) for q in queries]
        nested_results = await asyncio.gather(*tasks, return_exceptions=False)
        return [item for sublist in nested_results for item in sublist]
