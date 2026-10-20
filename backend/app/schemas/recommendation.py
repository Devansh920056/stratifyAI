"""
Pydantic Schemas for Action Intelligence Recommendations.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from backend.app.models.enums import RecommendationStatus, TimeHorizon


class RecommendationCreateRequest(BaseModel):
    title: str = Field(..., max_length=255, description="Clear, action-oriented title")
    description: str = Field(..., description="Actionable breakdown of what must be executed")
    rationale: str = Field(..., description="Strategic justification grounded in intelligence")
    estimated_impact: int = Field(..., ge=1, le=10, description="Projected strategic upside (1 to 10)")
    estimated_effort: int = Field(..., ge=1, le=10, description="Projected implementation cost/friction (1 to 10)")
    time_horizon: TimeHorizon = Field(default=TimeHorizon.NEAR_TERM, description="Execution timeline")
    outcome_hypothesis: str = Field(..., description="Falsifiable hypothesis of outcome")
    success_metric: str = Field(..., description="Primary KPI or metric tracked")
    target_metric_value: str | None = Field(None, description="Quantified goal (e.g., '+15% conversion')")
    evidence_ids: list[str | dict[str, Any]] = Field(default_factory=list, description="Linked citations or evidence")


class RecommendationStatusUpdateRequest(BaseModel):
    status: RecommendationStatus = Field(..., description="New lifecycle state")


class RecommendationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Recommendation UUID")
    job_id: uuid.UUID = Field(..., description="Parent Job UUID")
    title: str = Field(..., description="Action title")
    description: str = Field(..., description="Detailed description")
    rationale: str = Field(..., description="Strategic justification")
    estimated_impact: int = Field(..., description="Impact score (1-10)")
    estimated_effort: int = Field(..., description="Effort score (1-10)")
    priority_score: float = Field(..., description="Normalized priority calculation")
    time_horizon: str = Field(..., description="Execution timeline category")
    outcome_hypothesis: str = Field(..., description="Falsifiable expected result")
    success_metric: str = Field(..., description="Target KPI")
    target_metric_value: str | None = Field(None, description="Target value")
    status: str = Field(..., description="Current status: DRAFT, APPROVED, IMPLEMENTED, REVIEWED, DISMISSED")
    evidence_ids: list[Any] = Field(default_factory=list, description="Provenance evidence links")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class RecommendationListResponse(BaseModel):
    job_id: uuid.UUID
    total: int
    items: list[RecommendationResponse]
