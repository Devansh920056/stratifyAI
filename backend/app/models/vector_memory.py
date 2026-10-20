"""
Vector Memory & Embedding Storage Model.
Stores semantic dense vector embeddings of market signals, strategic recommendations,
research findings, and report documents for similarity search and AI insight generation.
"""

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base, utc_now


class VectorEmbedding(Base):
    __tablename__ = "vector_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    entity_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Entity category e.g. MARKET_SIGNAL, RECOMMENDATION, RESEARCH_FINDING, RESEARCH_REPORT",
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
        comment="Logical or foreign ID pointing to the referenced entity",
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Title or headline of the embedded entity",
    )
    content_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Raw or normalized text representation used to compute the embedding",
    )
    sector: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="Market sector e.g. Climate Tech, Cybersecurity",
    )
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        comment="Flexible metadata: source_domain, sentiment_score, priority_score, etc.",
    )
    dimensions: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=128,
        comment="Vector dimensions (e.g. 128 for deterministic hash embeddings, 768 for Gemini)",
    )
    embedding: Mapped[list[float]] = mapped_column(
        ARRAY(Float),
        nullable=False,
        comment="Normalized float array embedding vector",
    )
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
