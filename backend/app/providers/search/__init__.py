"""
Search Providers package: abstractions, sanitizers, and live/mock implementations.
"""

from backend.app.providers.search.base import (
    SearchAuthError,
    SearchProvider,
    SearchProviderError,
    SearchRateLimitError,
    SearchResult,
    SearchTimeoutError,
)
from backend.app.providers.search.duckduckgo import DuckDuckGoSearchProvider
from backend.app.providers.search.factory import get_search_provider
from backend.app.providers.search.mock import MockSearchProvider
from backend.app.providers.search.sanitizer import (
    deduplicate_results,
    normalize_url,
    results_to_evidence,
    sanitize_snippet,
    validate_and_normalize_url,
    validate_url,
)
from backend.app.providers.search.tavily import TavilySearchProvider

__all__ = [
    "DuckDuckGoSearchProvider",
    "MockSearchProvider",
    "SearchAuthError",
    "SearchProvider",
    "SearchProviderError",
    "SearchRateLimitError",
    "SearchResult",
    "SearchTimeoutError",
    "TavilySearchProvider",
    "deduplicate_results",
    "get_search_provider",
    "normalize_url",
    "results_to_evidence",
    "sanitize_snippet",
    "validate_and_normalize_url",
    "validate_url",
]
