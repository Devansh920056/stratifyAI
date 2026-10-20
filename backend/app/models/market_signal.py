"""
MarketSignal Model representing real-time ingested signals, news events, and competitor shifts.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base, utc_now
from backend.app.models.enums import SignalType


class MarketSignal(Base):
    __tablename__ = "market_signals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    market_sector: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    headline: Mapped[str] = mapped_column(String(500), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    canonical_url: Mapped[str] = mapped_column(Text, nullable=False, unique=True, index=True)
    source_domain: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    sentiment_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    relevance_score: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    signal_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=SignalType.MARKET_SHIFT.value,
        index=True,
    )
    published_at: Mapped[datetime] = mapped_column(
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

    def __repr__(self) -> str:
        return f"<MarketSignal id={self.id} sector='{self.market_sector}' headline='{self.headline[:30]}...'>"
