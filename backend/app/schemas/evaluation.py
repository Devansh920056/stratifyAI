"""
Pydantic Schemas for Decision Evaluation, Outcome Auditing, and Historical Backtesting.
"""

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class MetricEvidenceItem(BaseModel):
    metric: str = Field(..., description="Target KPI or metric name, e.g. Customer Churn")
    projected: str = Field(..., description="Projected target e.g. -15%")
    actual: str = Field(..., description="Empirical measured value e.g. -18%")
    status: str = Field(..., description="MET, EXCEEDED, MISSED, or IN_PROGRESS")


class DecisionEvaluationCreateRequest(BaseModel):
    outcome_status: str = Field(
        default="VALIDATED",
        description="VALIDATED, PARTIALLY_VALIDATED, INVALIDATED, IN_PROGRESS, or INCONCLUSIVE",
    )
    evaluator_notes: str = Field(..., min_length=3, description="Qualitative evaluation notes or post-mortem")
    actual_outcome: str = Field(..., min_length=3, description="Observed real-world result after execution")
    actual_metric_value: Optional[str] = Field(None, description="Measured metric e.g. +22% ARR")
    impact_delta: float = Field(default=0.0, ge=-10.0, le=10.0, description="Actual impact vs estimated delta")
    confidence_score: float = Field(default=0.85, ge=0.0, le=1.0, description="Confidence in this evaluation")
    metric_evidence: list[dict[str, Any]] = Field(default_factory=list, description="Structured metric proofs")
    linked_signal_ids: list[str] = Field(default_factory=list, description="MarketSignal UUIDs as corroborating proof")


class DecisionEvaluationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Evaluation UUID")
    recommendation_id: uuid.UUID = Field(..., description="Parent recommendation UUID")
    outcome_status: str = Field(..., description="Outcome status")
    evaluator_notes: str = Field(..., description="Evaluator notes")
    actual_outcome: str = Field(..., description="Actual outcome narrative")
    actual_metric_value: Optional[str] = Field(None, description="Actual metric value")
    impact_delta: float = Field(..., description="Impact delta")
    confidence_score: float = Field(..., description="Confidence score")
    metric_evidence: list[dict[str, Any]] = Field(default_factory=list)
    linked_signal_ids: list[str] = Field(default_factory=list)
    evaluated_at: datetime = Field(..., description="Evaluation timestamp")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Updated timestamp")
    recommendation_title: Optional[str] = Field(None, description="Associated recommendation title")


class DecisionEvaluationListResponse(BaseModel):
    evaluations: list[DecisionEvaluationResponse]
    total: int


class DecisionAnalyticsSummaryResponse(BaseModel):
    total_evaluated: int = Field(..., description="Total decisions evaluated")
    validated_count: int = Field(..., description="Validated hypotheses count")
    partially_validated_count: int = Field(..., description="Partially validated count")
    invalidated_count: int = Field(..., description="Invalidated count")
    in_progress_count: int = Field(..., description="Decisions still measuring in progress")
    validation_rate: float = Field(..., description="Validation success percentage (0-100%)")
    average_impact_delta: float = Field(..., description="Mean impact delta across evaluated decisions")
    average_confidence: float = Field(..., description="Mean confidence score (0-1.0)")
    top_validated_hypotheses: list[str] = Field(default_factory=list)
    top_failing_hypotheses: list[str] = Field(default_factory=list)


class BacktestFindingItem(BaseModel):
    recommendation_id: uuid.UUID
    title: str
    original_hypothesis: str
    estimated_impact: int
    market_signal_count: int
    market_sentiment_trend: float
    backtest_verdict: str  # STRONGLY_ALIGNED, MODERATELY_ALIGNED, DIVERGENT, NEUTRAL
    confidence: float
    key_market_evidence: list[str]


class BacktestSimulationRequest(BaseModel):
    job_id: Optional[uuid.UUID] = Field(None, description="Target job to backtest; defaults to latest completed job")
    lookback_days: int = Field(default=60, ge=7, le=365, description="Lookback window for signals")


class BacktestResultResponse(BaseModel):
    total_recommendations: int
    aligned_recommendations: int
    divergent_recommendations: int
    alignment_score: float  # 0.0 to 100.0%
    findings: list[BacktestFindingItem]
