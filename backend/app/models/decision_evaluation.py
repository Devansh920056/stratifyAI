"""
Decision Evaluation Model representing historical outcome tracking and backtesting validation.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.base import Base, utc_now
from backend.app.models.enums import DecisionOutcomeStatus

if TYPE_CHECKING:
    from backend.app.models.recommendation import Recommendation


class DecisionEvaluation(Base):
    __tablename__ = "decision_evaluations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    recommendation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("recommendations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    outcome_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default=DecisionOutcomeStatus.IN_PROGRESS.value,
        index=True,
    )
    evaluator_notes: Mapped[str] = mapped_column(Text, nullable=False)
    actual_outcome: Mapped[str] = mapped_column(Text, nullable=False)
    actual_metric_value: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    impact_delta: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.85)

    # Structured empirical proof: [{"metric": "...", "projected": "...", "actual": "...", "status": "..."}]
    metric_evidence: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    # Links to MarketSignal UUIDs that serve as external proof
    linked_signal_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    evaluated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
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
    recommendation: Mapped["Recommendation"] = relationship(
        "Recommendation", back_populates="evaluations"
    )

    def __repr__(self) -> str:
        return f"<DecisionEvaluation id={self.id} rec_id={self.recommendation_id} status={self.outcome_status}>"
