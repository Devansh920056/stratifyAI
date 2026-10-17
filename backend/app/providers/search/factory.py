"""
Factory for instantiating search evidence providers based on configuration.
Supports live DuckDuckGo (free, zero-config), Tavily Search API, and Mock fallbacks.
"""

import logging

from backend.app.core.config import Settings, get_settings
from backend.app.providers.search.base import SearchProvider
from backend.app.providers.search.duckduckgo import DuckDuckGoSearchProvider
from backend.app.providers.search.mock import MockSearchProvider
from backend.app.providers.search.tavily import TavilySearchProvider

logger = logging.getLogger("stratify.providers.search.factory")


def get_search_provider(settings: Settings | None = None) -> SearchProvider:
    """
    Returns the configured SearchProvider instance based on application settings.
    - If provider is 'tavily': uses TavilySearchProvider if key present, else falls back to MockSearchProvider.
    - If provider is 'duckduckgo'/'real'/'web': uses DuckDuckGoSearchProvider (zero-cost real web data).
    - If provider is 'mock': uses MockSearchProvider.
    """
    active_settings = settings or get_settings()
    provider_type = (active_settings.SEARCH_PROVIDER or "mock").lower().strip()

    if provider_type == "tavily":
        if active_settings.TAVILY_API_KEY and active_settings.TAVILY_API_KEY.strip():
            logger.info("Initializing live TavilySearchProvider.")
            return TavilySearchProvider(api_key=active_settings.TAVILY_API_KEY)
        logger.warning(
            "SEARCH_PROVIDER='tavily' but TAVILY_API_KEY is unset or empty. "
            "Falling back safely to MockSearchProvider."
        )
        return MockSearchProvider()

    if provider_type in ("duckduckgo", "ddg", "real", "web"):
        logger.info("Initializing live DuckDuckGoSearchProvider (zero-cost real data).")
        return DuckDuckGoSearchProvider()

    if provider_type == "mock":
        logger.info("Initializing MockSearchProvider (SEARCH_PROVIDER='mock').")
        return MockSearchProvider()

    logger.info("Defaulting to MockSearchProvider.")
    return MockSearchProvider()
