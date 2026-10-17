"""
Pydantic Schemas for Task Entities and Progress Tracking.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TaskResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    grounded_summary: str = Field(..., description="LLM synthesized grounded summary")
    key_findings: list[dict[str, Any]] = Field(
        default_factory=list, description="Extracted factual claims with citations"
    )
    confidence_score: float = Field(
        1.0, description="Confidence assessment score between 0.0 and 1.0"
    )
    citations: list[dict[str, Any]] = Field(
        default_factory=list, description="Verified web citations supporting findings"
    )
    model_name: str = Field(..., description="LLM model used for synthesis")


class TaskSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Unique Task UUID")
    job_id: uuid.UUID = Field(..., description="Parent Job UUID")
    task_type: str = Field(..., description="Orthogonal research task category")
    search_queries: list[str] = Field(
        ..., description="Targeted web search queries generated for this task"
    )
    status: str = Field(
        ...,
        description="Current state: PENDING, DISPATCHED, IN_PROGRESS, COMPLETED, FAILED",
    )
    attempt_count: int = Field(..., description="Number of execution attempts")
    version: int = Field(..., description="Optimistic concurrency control version")
    started_at: datetime | None = Field(
        None, description="Timestamp when worker began processing"
    )
    completed_at: datetime | None = Field(
        None, description="Timestamp when worker completed processing"
    )
    error_details: str | None = Field(
        None, description="Diagnostic error details if failed"
    )
    created_at: datetime = Field(..., description="Creation timestamp")
    result: TaskResultResponse | None = Field(
        None, description="Detailed task findings and summary if completed"
    )
