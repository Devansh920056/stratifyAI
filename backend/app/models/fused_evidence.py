"""
FusedEvidence Model representing secondary intelligence sources:
SEC EDGAR filings (10-K, 10-Q, 8-K), arXiv preprints, and reconciled disclosures.
"""

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, Float, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base, utc_now
from backend.app.models.enums import DivergenceStatus, EvidenceSourceType


class FusedEvidence(Base):
    __tablename__ = "fused_evidence"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    entity_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        index=True,
        comment="Tracked company or topic e.g. 'Tesla', 'CrowdStrike', 'Solid-State Batteries'",
    )
    source_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        default=EvidenceSourceType.SEC_EDGAR.value,
        comment="Source origin: SEC_EDGAR, ARXIV_PREPRINT, FINANCIAL_DISCLOSURE, COMMERCIAL_NEWS",
    )
    filing_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        default="10-K",
        comment="Specific document type: 10-K, 10-Q, 8-K, ARXIV_PAPER, PRESS_RELEASE",
    )
    title: Mapped[str] = mapped_column(
        String(300),
        nullable=False,
        comment="Filing headline, item title, or academic paper title",
    )
    content_excerpt: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Verifiable excerpt from Item 1A Risk Factors, MD&A, or technical abstract",
    )
    source_url: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Direct link to SEC EDGAR submission or arXiv abstract page",
    )
    reliability_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.95,
        comment="Evidence Reliability Index (ERI): 0.0 to 1.0 based on statutory rigor",
    )
    divergence_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default=DivergenceStatus.ALIGNED.value,
        index=True,
        comment="Reconciliation status: ALIGNED, DIVERGENT, CONTRADICTORY, UNVERIFIED",
    )
    reconciliation_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Analytical explanation of divergence between commercial PR and statutory risk disclosures",
    )
    fiscal_period: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Fiscal period e.g. FY 2024, Q3 2024, or publication year",
    )
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        comment="Structured metadata: CIK, accession_number, arXiv authors, category codes",
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

    def __repr__(self) -> str:
        return f"<FusedEvidence id={self.id} entity='{self.entity_name}' type='{self.filing_type}' divergence='{self.divergence_status}'>"
