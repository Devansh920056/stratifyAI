"""
Tavily Search API Provider implementation using httpx.
"""

import logging
from typing import Any

import httpx

from backend.app.providers.search.base import (
    SearchAuthError,
    SearchProvider,
    SearchProviderError,
    SearchRateLimitError,
    SearchResult,
    SearchTimeoutError,
)

logger = logging.getLogger("stratify.providers.search.tavily")

TAVILY_API_ENDPOINT = "https://api.tavily.com/search"


class TavilySearchProvider(SearchProvider):
    """
    Live web search evidence provider using the Tavily Search API.
    Retrieves grounded, clean snippets and metadata tailored for LLM synthesis.
    """

    def __init__(
        self,
        api_key: str,
        timeout_seconds: float = 15.0,
        search_depth: str = "advanced",
        client: httpx.AsyncClient | None = None,
    ):
        if not api_key or not api_key.strip():
            raise SearchAuthError("Tavily API key cannot be empty.")
        self._api_key = api_key.strip()
        self._timeout = timeout_seconds
        self._search_depth = search_depth
        self._client = client

    @property
    def provider_name(self) -> str:
        return "tavily"

    async def search(self, query: str, max_results: int = 5) -> list[SearchResult]:
        """
        Executes a Tavily search query and returns standardized SearchResult items.
        """
        if not query or not query.strip():
            return []

        payload: dict[str, Any] = {
            "api_key": self._api_key,
            "query": query.strip(),
            "search_depth": self._search_depth,
            "include_answer": False,
            "include_images": False,
            "include_raw_content": False,
            "max_results": max(1, min(max_results, 20)),
        }

        try:
            if self._client:
                response = await self._client.post(
                    TAVILY_API_ENDPOINT,
                    json=payload,
                    timeout=self._timeout,
                )
            else:
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    response = await client.post(
                        TAVILY_API_ENDPOINT,
                        json=payload,
                    )

            if response.status_code == 200:
                data = response.json()
                results: list[SearchResult] = []
                for item in data.get("results", []):
                    results.append(
                        SearchResult(
                            title=item.get("title", ""),
                            url=item.get("url", ""),
                            content=item.get("content", ""),
                            score=float(item.get("score", 0.0)),
                            published_date=item.get("published_date"),
                            raw_metadata={
                                "query": query,
                                "response_time": data.get("response_time"),
                            },
                        )
                    )
                logger.info(
                    f"[Tavily] Query '{query[:40]}' retrieved {len(results)} results."
                )
                return results

            elif response.status_code in (401, 403):
                raise SearchAuthError(
                    f"Tavily authentication failed ({response.status_code}): {response.text}"
                )
            elif response.status_code == 429:
                raise SearchRateLimitError(
                    f"Tavily rate limit exceeded (429): {response.text}"
                )
            elif response.status_code >= 500:
                raise SearchProviderError(
                    f"Tavily server error ({response.status_code}): {response.text}"
                )
            else:
                raise SearchProviderError(
                    f"Tavily unexpected error ({response.status_code}): {response.text}"
                )

        except httpx.TimeoutException as exc:
            logger.warning(
                f"[Tavily] Request for query '{query[:40]}' timed out after {self._timeout}s"
            )
            raise SearchTimeoutError(
                f"Tavily search timed out for query '{query}'"
            ) from exc
        except (SearchAuthError, SearchRateLimitError, SearchTimeoutError):
            raise
        except Exception as exc:
            logger.error(
                f"[Tavily] Network/request error for query '{query[:40]}': {exc!s}"
            )
            raise SearchProviderError(f"Tavily request failed: {exc!s}") from exc
