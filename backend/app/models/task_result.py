"""
TaskResult Model representing validated structured AI analysis for a single task.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base, utc_now

if TYPE_CHECKING:
    from backend.app.models.task import Task


class TaskResult(Base):
    __tablename__ = "task_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    # Strictly enforce 1-to-1 relationship and uniqueness per logical task to guarantee consumer idempotency
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    key_findings: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    grounded_summary: Mapped[str] = mapped_column(Text, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    citations: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    model_name: Mapped[str] = mapped_column(String(50), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    # Relationships
    task: Mapped["Task"] = relationship("Task", back_populates="result")

    def __repr__(self) -> str:
        return f"<TaskResult id={self.id} task_id={self.task_id} confidence={self.confidence_score}>"
