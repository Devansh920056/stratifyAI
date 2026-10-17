"""
Factory for instantiating LLM reasoning providers based on application configuration.
"""

import logging

from backend.app.core.config import Settings, get_settings
from backend.app.providers.llm.base import LLMProvider
from backend.app.providers.llm.gemini import GeminiLLMProvider
from backend.app.providers.llm.mock import MockLLMProvider
from backend.app.providers.llm.smart_web import SmartWebLLMProvider

logger = logging.getLogger("stratify.providers.llm.factory")


def get_llm_provider(settings: Settings | None = None) -> LLMProvider:
    """
    Returns the configured LLMProvider instance based on application settings.
    - 'gemini': uses GeminiLLMProvider if key is set; falls back to MockLLMProvider if key missing.
    - 'smart' / 'smart-extractor' / 'real': uses SmartWebLLMProvider for zero-cost real web extraction.
    - 'mock': explicitly returns MockLLMProvider.
    """
    active_settings = settings or get_settings()
    provider_type = (active_settings.LLM_PROVIDER or "mock").lower().strip()

    if provider_type == "gemini":
        if active_settings.GEMINI_API_KEY and active_settings.GEMINI_API_KEY.strip():
            logger.info(
                f"Initializing live GeminiLLMProvider (model={active_settings.LLM_MODEL})."
            )
            return GeminiLLMProvider(
                api_key=active_settings.GEMINI_API_KEY,
                model=active_settings.LLM_MODEL,
            )
        else:
            logger.warning(
                "LLM_PROVIDER='gemini' but GEMINI_API_KEY is unset or empty. "
                "Falling back safely to MockLLMProvider."
            )
            return MockLLMProvider()

    if provider_type in ("smart", "smart-extractor", "smart_web", "real", "web"):
        logger.info(
            "Initializing SmartWebLLMProvider (grounded real-web synthesis at zero API cost)."
        )
        return SmartWebLLMProvider()

    if provider_type == "mock":
        logger.info("Initializing MockLLMProvider (LLM_PROVIDER='mock').")
        return MockLLMProvider()

    if active_settings.GEMINI_API_KEY and active_settings.GEMINI_API_KEY.strip():
        return GeminiLLMProvider(
            api_key=active_settings.GEMINI_API_KEY,
            model=active_settings.LLM_MODEL,
        )

    logger.info("Defaulting to MockLLMProvider.")
    return MockLLMProvider()
