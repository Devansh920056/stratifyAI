"""
Recommendation Model representing strategic action items generated from intelligence findings.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.base import Base, utc_now
from backend.app.models.enums import RecommendationStatus, TimeHorizon

if TYPE_CHECKING:
    from backend.app.models.decision_evaluation import DecisionEvaluation
    from backend.app.models.job import Job


class Recommendation(Base):
    __tablename__ = "recommendations"

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
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)

    # Strategic Prioritization Matrix
    estimated_impact: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 to 10
    estimated_effort: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 to 10
    priority_score: Mapped[float] = mapped_column(Float, nullable=False)  # (impact * 0.7) - (effort * 0.3)
    time_horizon: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default=TimeHorizon.NEAR_TERM.value,
        index=True,
    )

    # Hypothesis & Evaluation
    outcome_hypothesis: Mapped[str] = mapped_column(Text, nullable=False)
    success_metric: Mapped[str] = mapped_column(String(255), nullable=False)
    target_metric_value: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default=RecommendationStatus.DRAFT.value,
        index=True,
    )

    # Grounded Provenance (evidence citations or findings IDs)
    evidence_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

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
    job: Mapped["Job"] = relationship("Job", back_populates="recommendations")
    evaluations: Mapped[list["DecisionEvaluation"]] = relationship(
        "DecisionEvaluation",
        back_populates="recommendation",
        cascade="all, delete-orphan",
        order_by="DecisionEvaluation.evaluated_at.desc()",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Recommendation id={self.id} job_id={self.job_id} title='{self.title[:30]}' status={self.status}>"
