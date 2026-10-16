"""
OutboxEvent Model implementing the Transactional Outbox pattern to prevent the dual-write problem.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base, utc_now
from backend.app.models.enums import OutboxStatus


class OutboxEvent(Base):
    __tablename__ = "outbox_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    aggregate_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="TASK",
        index=True,
    )
    aggregate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="TASK_CREATED",
    )
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default=OutboxStatus.PENDING.value,
        index=True,
    )
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
        index=True,
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    __table_args__ = (
        # Optimized index for high-throughput outbox dispatch polling:
        # SELECT * FROM outbox_events WHERE status = 'PENDING' ORDER BY created_at FOR UPDATE SKIP LOCKED
        Index("ix_outbox_events_status_created_at", "status", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<OutboxEvent id={self.id} agg={self.aggregate_type}:{self.aggregate_id} status={self.status}>"
