"""
Pydantic Schemas for Executive Intelligence Export & Governance Audit Trail (Stage 11).
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DossierExportRequest(BaseModel):
    entity_name: str = Field(..., min_length=2, max_length=150, description="Target company or topic")
    job_id: Optional[UUID] = Field(default=None, description="Optional active research job ID to incorporate")
    debate_id: Optional[UUID] = Field(default=None, description="Optional dialectic debate ID to incorporate")
    format: str = Field(default="MARKDOWN", description="Output format: MARKDOWN, HTML, or JSON")
    include_citations: bool = Field(default=True, description="Whether to include full provenance citation index")


class GovernanceAuditRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    dossier_id: UUID
    entity_name: str
    sha256_hash: str = Field(..., description="Cryptographic SHA-256 fingerprint for governance and compliance verification")
    content_length_bytes: int
    total_citations: int
    sec_accessions: List[str] = Field(default_factory=list)
    arxiv_ids: List[str] = Field(default_factory=list)
    gdelt_sources: List[str] = Field(default_factory=list)
    arbiter_verdict: Optional[str] = None
    conviction_score: Optional[float] = None
    dqs_score: Optional[float] = None
    generated_at: datetime


class DossierExportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    dossier_id: UUID
    entity_name: str
    format: str
    filename: str
    content: str
    governance_audit: GovernanceAuditRecord


class AuditHistoryResponse(BaseModel):
    entity_name: str
    audit_records: List[GovernanceAuditRecord]
    total: int
