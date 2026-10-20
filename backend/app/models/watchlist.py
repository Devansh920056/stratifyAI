"""
Watchlist and Alert Models representing monitored competitor targets and automated notifications.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.base import Base, utc_now
from backend.app.models.enums import AlertSeverity


class Watchlist(Base):
    __tablename__ = "watchlists"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    sector: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    target_entities: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    alert_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=-0.2)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

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
    alerts: Mapped[list["Alert"]] = relationship(
        "Alert",
        back_populates="watchlist",
        cascade="all, delete-orphan",
        order_by="Alert.triggered_at.desc()",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Watchlist id={self.id} name='{self.name}' sector='{self.sector}'>"


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    watchlist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("watchlists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    signal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=AlertSeverity.INFO.value,
        index=True,
    )
    is_read: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
    )
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
        index=True,
    )

    # Relationships
    watchlist: Mapped["Watchlist"] = relationship("Watchlist", back_populates="alerts")

    def __repr__(self) -> str:
        return f"<Alert id={self.id} severity={self.severity} read={self.is_read}>"
