"""
REST API Endpoints for Multi-Agent Dialectic Debate & Cross-Vector Synthesis (Stage 10).
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_async_session
from backend.app.schemas.debate import (
    DebateDetailResponse,
    DebateInitiateRequest,
    DebateListResponse,
)
from backend.app.services.debate_service import MultiAgentDebateService

router = APIRouter(prefix="/debates", tags=["Dialectic Debate Engine"])

SessionDep = Annotated[AsyncSession, Depends(get_async_session)]


@router.post(
    "/initiate",
    response_model=DebateDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Initiate Multi-Agent Dialectic Debate",
    description=(
        "Launches a multi-round cross-vector debate between Bull Growth Specialist, "
        "Bear Risk Officer, Regulatory Auditor, and Principal Arbiter with empirical citations."
    ),
)
async def initiate_debate(
    request: DebateInitiateRequest,
    session: SessionDep,
):
    try:
        return await MultiAgentDebateService.initiate_debate(session, request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute dialectic debate: {e!s}",
        )


@router.get(
    "",
    response_model=DebateListResponse,
    summary="List Dialectic Debates",
    description="Retrieves a list of concluded and in-progress multi-agent debates.",
)
async def list_debates(
    session: SessionDep,
    entity_name: str | None = Query(None, description="Filter by company or entity"),
    limit: int = Query(20, ge=1, le=100, description="Max debates to return"),
):
    return await MultiAgentDebateService.list_debates(
        session, entity_name=entity_name, limit=limit
    )


@router.get(
    "/{debate_id}",
    response_model=DebateDetailResponse,
    summary="Get Dialectic Debate Details",
    description="Fetches full transcript, rounds, citations, and arbitrated decision matrix.",
)
async def get_debate(
    debate_id: uuid.UUID,
    session: SessionDep,
):
    debate = await MultiAgentDebateService.get_debate(session, debate_id)
    if not debate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Debate with ID '{debate_id}' not found.",
        )
    return debate
