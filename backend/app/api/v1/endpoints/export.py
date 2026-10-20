"""
REST API Endpoints for Executive Intelligence Export & Governance Audit Trail (Stage 11).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_async_session
from backend.app.schemas.export import (
    AuditHistoryResponse,
    DossierExportRequest,
    DossierExportResponse,
)
from backend.app.services.export_service import ExecutiveExportService

router = APIRouter(prefix="/export", tags=["Executive Export & Governance"])

SessionDep = Annotated[AsyncSession, Depends(get_async_session)]


@router.post(
    "/dossier",
    response_model=DossierExportResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate Executive Intelligence Dossier",
    description=(
        "Compiles multi-vector market intelligence, dialectic debate verdicts, "
        "and primary SEC EDGAR citations into an institutional dossier with SHA-256 cryptographic provenance."
    ),
)
async def generate_dossier(
    request: DossierExportRequest,
    session: SessionDep,
):
    try:
        return await ExecutiveExportService.generate_dossier(session, request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate executive dossier: {str(e)}",
        )


@router.get(
    "/audit/{entity_name}",
    response_model=AuditHistoryResponse,
    summary="Get Governance Provenance Audit History",
    description="Retrieves chronological cryptographic SHA-256 audit digests for regulatory compliance.",
)
async def get_audit_history(
    entity_name: str,
    session: SessionDep,
):
    return await ExecutiveExportService.get_audit_history(session, entity_name)
