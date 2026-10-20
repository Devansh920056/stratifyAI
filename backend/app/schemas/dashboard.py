"""
Pydantic Schemas for Market Intelligence Dashboard & Visualizations.
"""

import uuid
from typing import Any

from pydantic import BaseModel, Field


class MoatCompetitorPoint(BaseModel):
    name: str = Field(..., description="Competitor or entity name")
    technological_moat: float = Field(..., ge=0, le=100, description="Technological advantage score (0-100)")
    pricing_power: float = Field(..., ge=0, le=100, description="Pricing power and market leverage (0-100)")
    quadrant: str = Field(..., description="Quadrant: Dominator, Niche Innovator, Price Leader, or Challenger")
    summary: str = Field(..., description="Short factual description of position")
    confidence: float = Field(..., description="Confidence score from evidence")
    source_url: str | None = Field(None, description="Linked citation provenance URL")


class VectorScoreItem(BaseModel):
    vector_key: str = Field(..., description="Vector identifier")
    label: str = Field(..., description="Human-readable label")
    confidence: float = Field(..., ge=0, le=1.0, description="Confidence rating (0.0 - 1.0)")
    risk_level: str = Field(..., description="Risk category: LOW, MEDIUM, HIGH")
    evidence_count: int = Field(..., description="Number of verified citations in this vector")
    summary_snippet: str = Field(..., description="Key takeaway from this vector")


class ClaimClassification(BaseModel):
    claim: str = Field(..., description="Factual claim text")
    source_url: str | None = Field(None, description="External citation URL if empirical")
    is_empirical: bool = Field(..., description="True if verified external empirical fact, False if inferred model projection")
    confidence: float = Field(..., description="Confidence score")
    vector_type: str = Field(..., description="Research vector origin")


class SourceDomainItem(BaseModel):
    domain: str = Field(..., description="Extracted web domain")
    count: int = Field(..., description="Number of citations from domain")
    percentage: float = Field(..., description="Share of total citations")


class JobDashboardResponse(BaseModel):
    job_id: uuid.UUID
    target_market: str
    geography: str
    overall_confidence: float
    moat_matrix: list[MoatCompetitorPoint]
    vector_scores: list[VectorScoreItem]
    claims_breakdown: list[ClaimClassification]
    empirical_facts_count: int
    inferred_projections_count: int
    source_domains: list[SourceDomainItem]
    total_citations: int
