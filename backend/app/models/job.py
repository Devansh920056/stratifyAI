"""
Job Model representing a high-level user research request.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.base import Base, utc_now
from backend.app.models.enums import JobStatus

if TYPE_CHECKING:
    from backend.app.models.report import Report
    from backend.app.models.task import Task


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    research_question: Mapped[str] = mapped_column(Text, nullable=False)
    target_market: Mapped[str] = mapped_column(String(100), nullable=False)
    geography: Mapped[str] = mapped_column(String(100), nullable=False)
    time_range: Mapped[str | None] = mapped_column(String(50), nullable=True)
    focus_areas: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default=JobStatus.PENDING.value,
        index=True,
    )
    error_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships configured with lazy="selectin" for clean async loading
    tasks: Mapped[list["Task"]] = relationship(
        "Task",
        back_populates="job",
        cascade="all, delete-orphan",
        order_by="Task.created_at",
        lazy="selectin",
    )
    report: Mapped[Optional["Report"]] = relationship(
        "Report",
        back_populates="job",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Job id={self.id} status={self.status} market={self.target_market}>"
