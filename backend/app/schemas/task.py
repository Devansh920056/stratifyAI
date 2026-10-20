"""
Pydantic Schemas for Task Entities and Progress Tracking.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TaskResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    grounded_summary: str = Field(..., description="Synthesized vector summary")
    key_findings: list[dict[str, Any]] = Field(
        default_factory=list, description="Factual claims with citation links"
    )
    confidence_score: float = Field(
        default=1.0, description="Confidence score between 0.0 and 1.0"
    )
    citations: list[dict[str, Any]] = Field(
        default_factory=list, description="Verified citations supporting this task"
    )
    model_name: str = Field(..., description="Model or engine that produced the result")


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
        None, description="Detailed task results if completed"
    )

    @classmethod
    def from_task(cls, t: Any) -> "TaskSummaryResponse":
        """Safely constructs TaskSummaryResponse without triggering async lazy-loading IO."""
        result_obj = None
        res = (
            t.__dict__.get("result")
            if hasattr(t, "__dict__")
            else getattr(t, "result", None)
        )
        if res is not None:
            result_obj = TaskResultResponse(
                grounded_summary=res.grounded_summary,
                key_findings=res.key_findings,
                confidence_score=res.confidence_score,
                citations=res.citations,
                model_name=res.model_name,
            )

        return cls(
            id=t.id,
            job_id=t.job_id,
            task_type=t.task_type,
            search_queries=t.search_queries,
            status=t.status,
            attempt_count=t.attempt_count,
            version=t.version,
            started_at=t.started_at,
            completed_at=t.completed_at,
            error_details=t.error_details,
            created_at=t.created_at,
            result=result_obj,
        )
