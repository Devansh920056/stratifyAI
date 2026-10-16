"""
Evidence Model representing untrusted raw text retrieved from external web sources.
"""

import hashlib
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.base import Base, utc_now

if TYPE_CHECKING:
    from backend.app.models.task import Task


def compute_url_hash(url: str) -> str:
    """Compute deterministic SHA256 hash of source URL for deduplication."""
    return hashlib.sha256(url.strip().encode("utf-8")).hexdigest()


class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    source_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    snippet: Mapped[str] = mapped_column(Text, nullable=False)
    retrieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    provider_name: Mapped[str] = mapped_column(
        String(50), nullable=False, default="mock"
    )
    provider_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # URL hash allows fast index lookups and deduplication within the task
    url_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    # Relationships
    task: Mapped["Task"] = relationship("Task", back_populates="evidence")

    __table_args__ = (Index("ix_evidence_task_url_hash", "task_id", "url_hash"),)

    def __init__(self, **kwargs):
        if "source_url" in kwargs and "url_hash" not in kwargs:
            kwargs["url_hash"] = compute_url_hash(kwargs["source_url"])
        super().__init__(**kwargs)

    def __repr__(self) -> str:
        return (
            f"<Evidence id={self.id} task_id={self.task_id} url={self.source_url[:30]}>"
        )
