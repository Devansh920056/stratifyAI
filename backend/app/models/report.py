"""
Report Model representing the aggregated intelligence report for a completed or partially completed job.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional
from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base, utc_now
from backend.app.models.enums import ReportStatus

if TYPE_CHECKING:
    from backend.app.models.job import Job


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    # 1-to-1 relationship with Job; each research job generates at most one aggregated report
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    executive_summary: Mapped[str] = mapped_column(Text, nullable=False)
    market_findings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    competitor_analysis: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    customer_insights: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    opportunities_and_risks: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    citations: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    research_limitations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default=ReportStatus.DRAFT.value,
        index=True,
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

    # Relationships
    job: Mapped["Job"] = relationship("Job", back_populates="report")

    def __repr__(self) -> str:
        return f"<Report id={self.id} job_id={self.job_id} status={self.status}>"
