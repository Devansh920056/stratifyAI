"""
Factory for instantiating search evidence providers based on configuration.
Only live providers are supported: DuckDuckGo/Wikipedia (free, no key) and Tavily (API key).
"""

import logging

from backend.app.core.config import Settings, get_settings
from backend.app.providers.search.base import SearchProvider
from backend.app.providers.search.duckduckgo import DuckDuckGoSearchProvider
from backend.app.providers.search.tavily import TavilySearchProvider

logger = logging.getLogger("stratify.providers.search.factory")

_DDG_ALIASES = ("duckduckgo", "ddg", "real", "web")


def get_search_provider(settings: Settings | None = None) -> SearchProvider:
    """
    Returns the configured SearchProvider.
    - 'tavily': TavilySearchProvider when TAVILY_API_KEY is set, otherwise the free live
      DuckDuckGo provider (a warning is logged; no synthetic data is ever substituted).
    - 'duckduckgo' / 'ddg' / 'real' / 'web': DuckDuckGoSearchProvider.
    Any other value raises ValueError so misconfiguration is never silently masked.
    """
    active_settings = settings or get_settings()
    provider_type = (active_settings.SEARCH_PROVIDER or "duckduckgo").lower().strip()

    if provider_type == "tavily":
        key = (active_settings.TAVILY_API_KEY or "").strip()
        if key:
            logger.info("Initializing live TavilySearchProvider.")
            return TavilySearchProvider(api_key=key)
        logger.warning(
            "SEARCH_PROVIDER='tavily' but TAVILY_API_KEY is empty. Using live DuckDuckGo search instead."
        )
        return DuckDuckGoSearchProvider()

    if provider_type in _DDG_ALIASES:
        logger.info("Initializing live DuckDuckGoSearchProvider.")
        return DuckDuckGoSearchProvider()

    raise ValueError(
        f"Unsupported SEARCH_PROVIDER '{active_settings.SEARCH_PROVIDER}'. "
        "Use 'duckduckgo' or 'tavily'."
    )
