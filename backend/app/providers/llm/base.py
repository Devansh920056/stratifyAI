"""
Data Contracts and Abstract Base Class for LLM Providers.
"""

from abc import ABC, abstractmethod

from pydantic import BaseModel, Field

from backend.app.models.evidence import Evidence


class KeyFinding(BaseModel):
    """An individual grounded claim citing a verified external evidence source."""

    claim: str = Field(..., description="Fact-based finding synthesized from evidence")
    source_url: str = Field(..., description="Exact URL of the source evidence item")
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Evidence-support score for this finding (0-1)"
    )


class Citation(BaseModel):
    """Source reference for evidence grounding."""

    url: str = Field(..., description="Source URL")
    title: str = Field(..., description="Document or page title")


class AnalysisOutput(BaseModel):
    """Structured, verified AI synthesis output for a research task."""

    key_findings: list[KeyFinding] = Field(
        ..., min_length=1, description="Synthesized key claims with citations"
    )
    grounded_summary: str = Field(
        ..., min_length=20, description="Comprehensive evidence-grounded summary"
    )
    confidence_score: float = Field(
        ..., ge=0.0, le=1.0, description="Overall evidence-support score for the task (0-1)"
    )
    citations: list[Citation] = Field(
        ..., min_length=1, description="List of unique evidence citations"
    )
    model_name: str = Field(..., description="LLM model identifier used for analysis")


# ------------------------------------------------------------------------------
# Exceptions Hierarchy
# ------------------------------------------------------------------------------


class LLMProviderError(Exception):
    """Base exception for LLM provider execution failures."""


class LLMAuthError(LLMProviderError):
    """Authentication or authorization failure (e.g. invalid API key)."""


class LLMRateLimitError(LLMProviderError):
    """Provider rate limit or quota exceeded (HTTP 429)."""


class LLMTimeoutError(LLMProviderError):
    """LLM request timed out."""


class LLMSchemaValidationError(LLMProviderError):
    """LLM output failed JSON schema validation or contained ungrounded hallucinated citations."""


# ------------------------------------------------------------------------------
# Provider Interface
# ------------------------------------------------------------------------------


class LLMProvider(ABC):
    """Abstract interface defining the contract for all AI reasoning providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Identifying name of the LLM provider (e.g. 'gemini', 'smart-extractor')."""

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Name of the model being invoked (e.g. 'gemini-1.5-flash')."""

    @abstractmethod
    async def analyze(
        self,
        task_type: str,
        research_question: str,
        evidence_items: list[Evidence],
    ) -> AnalysisOutput:
        """
        Synthesizes research findings and grounded summaries strictly based on provided evidence.

        :param task_type: Research dimension (e.g. MARKET_OVERVIEW, COMPETITOR_ANALYSIS)
        :param research_question: High-level market research inquiry
        :param evidence_items: List of retrieved external evidence records
        :return: Validated AnalysisOutput with citations
        """
