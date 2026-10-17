"""
Factory for instantiating LLM reasoning providers based on application configuration.
"""

import logging

from backend.app.core.config import Settings, get_settings
from backend.app.providers.llm.base import LLMProvider
from backend.app.providers.llm.gemini import GeminiLLMProvider
from backend.app.providers.llm.mock import MockLLMProvider

logger = logging.getLogger("stratify.providers.llm.factory")


def get_llm_provider(settings: Settings | None = None) -> LLMProvider:
    """
    Returns the configured LLMProvider instance based on application settings.
    Falls back gracefully and honestly to MockLLMProvider if credentials are not configured.
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

    logger.info("Initializing MockLLMProvider (LLM_PROVIDER='mock').")
    return MockLLMProvider()
