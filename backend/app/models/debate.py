"""
Debate & DebateMessage Models representing dialectic multi-agent reasoning:
Bull Thesis vs Bear Antithesis vs Regulatory Auditor vs Principal Arbiter.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.base import Base, utc_now
from backend.app.models.enums import (
    DebateStatus,
)


class Debate(Base):
    __tablename__ = "debates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    topic: Mapped[str] = mapped_column(
        String(300),
        nullable=False,
        comment="Strategic thesis topic, e.g. 'Tesla Robotaxi & 4680 In-House Scaling'",
    )
    entity_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        index=True,
        comment="Target company or sector ticker, e.g. 'Tesla', 'CrowdStrike'",
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        default=DebateStatus.IN_PROGRESS.value,
        comment="State: IN_PROGRESS, CONCLUDED, ARCHIVED",
    )
    rounds_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=3,
        comment="Total completed argument rounds in this debate",
    )
    arbiter_verdict: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
        comment="Final verdict: STRONG_BUY, STRATEGIC_ACCUMULATE, NEUTRAL_HOLD, DEFENSIVE_HEDGE, DIVEST_AVOID",
    )
    conviction_score: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        comment="Arbiter conviction index from 0.00 to 1.00",
    )
    executive_summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Consolidated synthesis and executive decision briefing",
    )
    synthesis_matrix: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        comment="Structured scorecard: bull/bear vector weights, tripwires, upside vs downside",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    # Relationships
    messages: Mapped[list["DebateMessage"]] = relationship(
        "DebateMessage",
        back_populates="debate",
        cascade="all, delete-orphan",
        order_by="DebateMessage.created_at",
    )


class DebateMessage(Base):
    __tablename__ = "debate_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    debate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("debates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    agent_role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Role: BULL_SPECIALIST, BEAR_RISK_OFFICER, REGULATORY_AUDITOR, PRINCIPAL_ARBITER",
    )
    agent_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        comment="Display name of persona e.g. 'Marcus Vance (Growth Specialist)'",
    )
    round_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
        comment="Debate round number: 1, 2, 3",
    )
    argument_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Type: THESIS, ANTITHESIS, REBUTTAL, REGULATORY_CHALLENGE, SYNTHESIS",
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Full dialectic argument content formatted in markdown",
    )
    evidence_citations: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        comment="Array of verified citations linking to SEC EDGAR accessions, arXiv IDs, or news signals",
    )
    confidence_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.85,
        comment="Agent's self-assessed argument confidence (0.0 to 1.0)",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    # Relationships
    debate: Mapped["Debate"] = relationship("Debate", back_populates="messages")
