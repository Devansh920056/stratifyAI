"""
Evidence Fusion & Statutory Filing Reconciliation API Endpoints.
Provides RESTful APIs for querying SEC EDGAR filings, arXiv technical preprints,
and evaluating commercial vs regulatory claim divergences.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_async_session
from backend.app.schemas.fusion import (
    EvidenceQueryRequest,
    FusedEvidenceListResponse,
)
from backend.app.services.fusion_service import EvidenceFusionService

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_async_session)]


@router.post(
    "/fusion/query",
    response_model=FusedEvidenceListResponse,
    status_code=status.HTTP_200_OK,
    summary="Multi-Source Evidence Query & Fusion",
    description="Acquires SEC EDGAR filings and arXiv technical preprints, persists them, and runs claim contradiction analysis.",
)
async def query_and_fuse_evidence(
    request: EvidenceQueryRequest,
    db: SessionDep,
) -> FusedEvidenceListResponse:
    return await EvidenceFusionService.query_and_fuse_evidence(
        session=db,
        entity_name=request.entity_name,
        topic=request.topic,
        include_sec=request.include_sec,
        include_arxiv=request.include_arxiv,
        reconcile=request.reconcile,
    )


@router.get(
    "/fusion/evidence",
    response_model=FusedEvidenceListResponse,
    summary="List Stored Fused Evidence",
    description="Retrieves persisted secondary evidence items with optional filtering by entity, source type, or divergence status.",
)
async def list_fused_evidence(
    db: SessionDep,
    entity: str | None = Query(None, description="Optional entity name filter"),
    source_type: str | None = Query(None, description="SEC_EDGAR, ARXIV_PREPRINT, etc."),
    divergence: str | None = Query(None, description="ALIGNED, DIVERGENT, CONTRADICTORY"),
    limit: int = Query(50, ge=1, le=100),
) -> FusedEvidenceListResponse:
    return await EvidenceFusionService.get_fused_evidence(
        session=db,
        entity_name=entity,
        source_type=source_type,
        divergence_status=divergence,
        limit=limit,
    )


@router.get(
    "/fusion/reconcile/{entity_name}",
    response_model=FusedEvidenceListResponse,
    summary="Reconcile Corporate Claims vs Disclosures",
    description="Executes deep cross-source reconciliation comparing commercial claims against Item 1A Risk Factors for a company.",
)
async def reconcile_entity(
    entity_name: str,
    db: SessionDep,
) -> FusedEvidenceListResponse:
    return await EvidenceFusionService.query_and_fuse_evidence(
        session=db,
        entity_name=entity_name,
        include_sec=True,
        include_arxiv=True,
        reconcile=True,
    )
