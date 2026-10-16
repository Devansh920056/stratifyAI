"""
AMQP Message Contracts for RabbitMQ Task Dispatch.
"""

import uuid
from datetime import datetime, timezone
from typing import List
from pydantic import BaseModel, Field


class TaskMessage(BaseModel):
    """
    Validated payload serialized into RabbitMQ task queue messages.
    """
    task_id: uuid.UUID = Field(..., description="Unique task UUID")
    job_id: uuid.UUID = Field(..., description="Parent job UUID")
    task_type: str = Field(..., description="Category: MARKET_OVERVIEW, COMPETITOR_ANALYSIS, etc.")
    search_queries: List[str] = Field(..., description="List of search queries to execute")
    version: int = Field(default=1, description="Expected OCC version of task")
    retry_count: int = Field(default=0, description="Current retry attempt number")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of message creation",
    )

    def to_amqp_headers(self) -> dict:
        """Export essential tracing metadata as AMQP message headers."""
        return {
            "x-task-id": str(self.task_id),
            "x-job-id": str(self.job_id),
            "x-task-type": self.task_type,
            "x-retry-count": self.retry_count,
            "x-version": self.version,
        }
