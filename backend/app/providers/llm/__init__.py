"""
LLM Providers package: interfaces, prompt guardrails, and Gemini/mock implementations.
"""

from backend.app.providers.llm.base import (
    AnalysisOutput,
    Citation,
    KeyFinding,
    LLMAuthError,
    LLMProvider,
    LLMProviderError,
    LLMRateLimitError,
    LLMSchemaValidationError,
    LLMTimeoutError,
)
from backend.app.providers.llm.factory import get_llm_provider
from backend.app.providers.llm.gemini import GeminiLLMProvider
from backend.app.providers.llm.mock import MockLLMProvider
from backend.app.providers.llm.prompt import (
    SYSTEM_PROMPT,
    build_analysis_prompt,
    validate_and_sanitize_grounding,
)

__all__ = [
    "SYSTEM_PROMPT",
    "AnalysisOutput",
    "Citation",
    "GeminiLLMProvider",
    "KeyFinding",
    "LLMAuthError",
    "LLMProvider",
    "LLMProviderError",
    "LLMRateLimitError",
    "LLMSchemaValidationError",
    "LLMTimeoutError",
    "MockLLMProvider",
    "build_analysis_prompt",
    "get_llm_provider",
    "validate_and_sanitize_grounding",
]
