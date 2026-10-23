"""
Pydantic Schemas for Multi-Source Evidence Fusion & Regulatory Filing Reconciliation.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class EvidenceQueryRequest(BaseModel):
    entity_name: str = Field(
        ...,
        min_length=2,
        max_length=150,
        description="Company name or research topic e.g. 'Tesla', 'CrowdStrike', 'Solid-State Batteries'",
    )
    topic: str | None = Field(
        default=None,
        description="Optional technical focus e.g. 'Battery yields', 'Kernel drivers', 'Cybersecurity'",
    )
    include_sec: bool = Field(
        default=True,
        description="Query SEC EDGAR statutory filings (10-K, 10-Q, 8-K)",
    )
    include_arxiv: bool = Field(
        default=True,
        description="Query arXiv scientific & technical preprints",
    )
    reconcile: bool = Field(
        default=True,
        description="Run cross-source divergence & contradiction analysis against commercial claims",
    )


class FusedEvidenceItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Evidence UUID")
    entity_name: str = Field(..., description="Company or topic name")
    source_type: str = Field(..., description="SEC_EDGAR, ARXIV_PREPRINT, etc.")
    filing_type: str = Field(..., description="10-K, 10-Q, 8-K, ARXIV_PAPER")
    title: str = Field(..., description="Filing headline or paper title")
    content_excerpt: str = Field(..., description="Item 1A Risk Factors or abstract text")
    source_url: str = Field(..., description="Direct link to source document")
    reliability_score: float = Field(..., description="Evidence Reliability Index (0.0 to 1.0)")
    divergence_status: str = Field(..., description="ALIGNED, DIVERGENT, CONTRADICTORY, UNVERIFIED")
    reconciliation_notes: str | None = Field(default=None, description="Discrepancy explanation")
    fiscal_period: str | None = Field(default=None, description="Fiscal year, quarter, or date")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Metadata dictionary")
    created_at: datetime = Field(..., description="Ingestion timestamp")


class EvidenceReconciliationSummary(BaseModel):
    entity_name: str = Field(..., description="Evaluated entity name")
    total_fused_sources: int = Field(..., description="Total multi-source items evaluated")
    sec_filings_count: int = Field(default=0, description="SEC statutory filings found")
    arxiv_preprints_count: int = Field(default=0, description="arXiv academic preprints found")
    divergent_claims_count: int = Field(default=0, description="Claims exhibiting moderate divergence")
    contradictory_claims_count: int = Field(default=0, description="Direct commercial vs statutory contradictions")
    evidence_reliability_index: float = Field(..., description="Overall weighted reliability (0.0 to 1.0)")
    reconciliation_takeaway: str = Field(..., description="Executive reconciliation summary")


class FusedEvidenceListResponse(BaseModel):
    entity_name: str = Field(..., description="Queried entity or topic")
    items: list[FusedEvidenceItem] = Field(default_factory=list, description="Retrieved secondary evidence items")
    total: int = Field(..., description="Total count")
    summary: EvidenceReconciliationSummary | None = Field(
        default=None, description="Cross-source reconciliation summary"
    )
