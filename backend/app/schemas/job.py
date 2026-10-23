"""
Pydantic Schemas for Research Job Submission and Lifecycle Tracking.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.app.schemas.task import TaskSummaryResponse


class JobCreateRequest(BaseModel):
    """
    User request schema for submitting a new market research question.
    Enforces strict field boundaries and sanitization.
    """

    research_question: str = Field(
        ...,
        min_length=10,
        max_length=500,
        description="Core market research inquiry (e.g. 'Analyze commercial space launch market')",
        examples=[
            "Analyze the competitive landscape of Quick Commerce dark stores and delivery unit economics in India"
        ],
    )
    target_market: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Industry or market sector",
        examples=["Fintech & Digital Payments"],
    )
    geography: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Geographic region of focus",
        examples=["India (Pan-India)"],
    )
    time_range: str | None = Field(
        default="2025-2028",
        max_length=50,
        description="Temporal scope of the market intelligence",
        examples=["2025-2028"],
    )
    focus_areas: list[str] = Field(
        default_factory=list,
        max_length=10,
        description="Specific topics or sub-sectors to prioritize",
        examples=[
            ["RBI Regulations", "UPI Integration", "Unit Economics (₹)"]
        ],
    )

    @field_validator("research_question", "target_market", "geography")
    @classmethod
    def sanitize_string(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Field must not be empty or whitespace only.")
        return cleaned


class JobResponse(BaseModel):
    """
    Compact Job summary returned immediately with HTTP 202 upon submission.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Unique Job identifier")
    research_question: str = Field(...)
    target_market: str = Field(...)
    geography: str = Field(...)
    time_range: str | None = Field(None)
    focus_areas: list[str] = Field(default_factory=list)
    status: str = Field(
        ...,
        description="Job lifecycle status: PENDING, PROCESSING, COMPLETED, PARTIALLY_COMPLETED, FAILED",
    )
    tasks_count: int = Field(
        default=0, description="Total number of decomposed research tasks"
    )
    error_summary: str | None = Field(None)
    created_at: datetime = Field(...)
    updated_at: datetime = Field(...)
    completed_at: datetime | None = Field(None)


class JobDetailResponse(JobResponse):
    """
    Comprehensive Job detail including individual task statuses and report availability.
    """

    has_report: bool = Field(
        default=False, description="Whether a synthesized report is ready for this job"
    )
    tasks: list[TaskSummaryResponse] = Field(
        default_factory=list, description="Sub-tasks progress details"
    )
