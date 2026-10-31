"""
Factory for instantiating LLM reasoning providers based on application configuration.
Only real providers are supported: Gemini (API key) and the extractive SmartWeb grounder.
"""

import logging

from backend.app.core.config import Settings, get_settings
from backend.app.providers.llm.base import LLMProvider
from backend.app.providers.llm.gemini import GeminiLLMProvider
from backend.app.providers.llm.smart_web import SmartWebLLMProvider

logger = logging.getLogger("stratify.providers.llm.factory")

_SMART_ALIASES = ("smart", "smart-extractor", "smart_web", "real", "web")


def get_llm_provider(settings: Settings | None = None) -> LLMProvider:
    """
    Returns the configured LLMProvider.
    - 'gemini': GeminiLLMProvider when GEMINI_API_KEY is set; otherwise the extractive
      SmartWebLLMProvider (quotes real evidence only, never generates text).
    - 'smart' (and aliases): SmartWebLLMProvider.
    Any other value raises ValueError so misconfiguration is never silently masked.
    """
    active_settings = settings or get_settings()
    provider_type = (active_settings.LLM_PROVIDER or "smart").lower().strip()

    if provider_type == "gemini":
        key = (active_settings.GEMINI_API_KEY or "").strip()
        if key:
            logger.info(f"Initializing live GeminiLLMProvider (model={active_settings.LLM_MODEL}).")
            return GeminiLLMProvider(api_key=key, model=active_settings.LLM_MODEL)
        logger.warning(
            "LLM_PROVIDER='gemini' but GEMINI_API_KEY is empty. Using the extractive SmartWebLLMProvider."
        )
        return SmartWebLLMProvider()

    if provider_type in _SMART_ALIASES:
        logger.info("Initializing SmartWebLLMProvider (extractive, grounded in retrieved evidence).")
        return SmartWebLLMProvider()

    raise ValueError(
        f"Unsupported LLM_PROVIDER '{active_settings.LLM_PROVIDER}'. Use 'gemini' or 'smart'."
    )
