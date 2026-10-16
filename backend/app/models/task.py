"""
Task Model representing an independent unit of research dispatched to RabbitMQ.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.base import Base, utc_now
from backend.app.models.enums import TaskStatus

if TYPE_CHECKING:
    from backend.app.models.evidence import Evidence
    from backend.app.models.job import Job
    from backend.app.models.task_result import TaskResult


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    search_queries: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default=TaskStatus.PENDING.value,
        index=True,
    )
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=3)

    # Version column for Optimistic Concurrency Control (OCC) during state updates
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    error_details: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    # Relationships with selectin loading
    job: Mapped["Job"] = relationship("Job", back_populates="tasks")
    evidence: Mapped[list["Evidence"]] = relationship(
        "Evidence",
        back_populates="task",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    result: Mapped[Optional["TaskResult"]] = relationship(
        "TaskResult",
        back_populates="task",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Task id={self.id} type={self.task_type} status={self.status} version={self.version}>"
