"""
Pydantic Schemas for Multi-Agent Dialectic Debate & Cross-Vector Synthesis (Stage 10).
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from backend.app.models.enums import (
    AgentDebateRole,
    ArbiterVerdict,
    ArgumentType,
    DebateStatus,
)


class DebateInitiateRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=300, description="Debate topic thesis")
    entity_name: str = Field(..., min_length=2, max_length=150, description="Target company or sector")
    focus_areas: list[str] | None = Field(default=None, description="Optional focus vectors (e.g. Yield, Regulatory, Margin)")
    rounds_count: int = Field(default=3, ge=1, le=5, description="Number of dialectic argument rounds")


class EvidenceCitationItem(BaseModel):
    source_type: str = Field(..., description="SEC_EDGAR, ARXIV_PREPRINT, or COMMERCIAL_NEWS")
    title: str = Field(..., description="Filing or article title")
    reference_id: str | None = Field(default=None, description="Accession number, arXiv ID, or URL")
    url: str | None = Field(default=None, description="Direct URL")
    reconciliation_impact: str | None = Field(default=None, description="Why this evidence supports or refutes the claim")


class DebateMessageItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    debate_id: UUID
    agent_role: AgentDebateRole
    agent_name: str
    round_number: int
    argument_type: ArgumentType
    content: str
    evidence_citations: list[dict[str, Any]] = Field(default_factory=list)
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    created_at: datetime


class DebateSynthesisMatrix(BaseModel):
    bull_score: float = Field(..., ge=0.0, le=1.0, description="Bull vector strength")
    bear_score: float = Field(..., ge=0.0, le=1.0, description="Bear vector strength")
    regulatory_risk_score: float = Field(..., ge=0.0, le=1.0, description="Regulatory risk weight")
    primary_growth_vector: str = Field(..., description="Top expansion catalyst")
    primary_vulnerability: str = Field(..., description="Top operational or legal bottleneck")
    tripwires: list[str] = Field(default_factory=list, description="Conditional tripwires that trigger verdict downgrades")


class DebateListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    topic: str
    entity_name: str
    status: DebateStatus
    rounds_count: int
    arbiter_verdict: ArbiterVerdict | None = None
    conviction_score: float | None = None
    executive_summary: str | None = None
    created_at: datetime


class DebateDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    topic: str
    entity_name: str
    status: DebateStatus
    rounds_count: int
    arbiter_verdict: ArbiterVerdict | None = None
    conviction_score: float | None = None
    executive_summary: str | None = None
    synthesis_matrix: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    messages: list[DebateMessageItem] = Field(default_factory=list)


class DebateListResponse(BaseModel):
    debates: list[DebateListItem]
    total: int
