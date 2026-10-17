"""
Factory for instantiating search evidence providers based on configuration.
"""

import logging

from backend.app.core.config import Settings, get_settings
from backend.app.providers.search.base import SearchProvider
from backend.app.providers.search.mock import MockSearchProvider
from backend.app.providers.search.tavily import TavilySearchProvider

logger = logging.getLogger("stratify.providers.search.factory")


def get_search_provider(settings: Settings | None = None) -> SearchProvider:
    """
    Returns the configured SearchProvider instance based on application settings.
    Falls back gracefully to MockSearchProvider if credentials are not configured.
    """
    active_settings = settings or get_settings()
    provider_type = (active_settings.SEARCH_PROVIDER or "mock").lower().strip()

    if provider_type == "tavily":
        if active_settings.TAVILY_API_KEY and active_settings.TAVILY_API_KEY.strip():
            logger.info("Initializing live TavilySearchProvider.")
            return TavilySearchProvider(api_key=active_settings.TAVILY_API_KEY)
        else:
            logger.warning(
                "SEARCH_PROVIDER='tavily' but TAVILY_API_KEY is unset or empty. "
                "Falling back safely to MockSearchProvider."
            )
            return MockSearchProvider()

    logger.info("Initializing MockSearchProvider (SEARCH_PROVIDER='mock').")
    return MockSearchProvider()
