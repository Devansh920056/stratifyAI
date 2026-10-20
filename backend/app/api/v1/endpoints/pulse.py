"""
Market Pulse Continuous Ingestion API Endpoints.
Provides real-time signal stream, live sync triggers, and volume velocity stats.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_async_session
from backend.app.schemas.pulse import (
    MarketPulseResponse,
    MarketPulseStatsResponse,
    MarketPulseSyncRequest,
    MarketSignalItem,
)
from backend.app.services.pulse_service import MarketPulseService

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_async_session)]


@router.get(
    "/pulse",
    response_model=MarketPulseResponse,
    summary="Get Continuous Market Pulse Signals",
    description="Retrieves ingested news signals and competitor shifts filtered by sector and signal type.",
)
async def get_market_signals(
    db: SessionDep,
    sector: str | None = Query(None, description="Filter by sector (e.g. Climate Tech, Developer Productivity)"),
    signal_type: str | None = Query(None, description="Filter by category (COMPETITOR_MOVE, REGULATORY_UPDATE, etc.)"),
    limit: int = Query(30, ge=1, le=100, description="Max signals to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> MarketPulseResponse:
    signals, total = await MarketPulseService.get_signals(
        session=db,
        sector=sector,
        signal_type=signal_type,
        limit=limit,
        offset=offset,
    )
    return MarketPulseResponse(
        signals=[MarketSignalItem.model_validate(s) for s in signals],
        total=total,
        sector=sector,
        signal_type=signal_type,
    )


@router.post(
    "/pulse/sync",
    response_model=MarketPulseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Sync Latest Live Market Signals",
    description="Triggers real-time signal ingestion from GDELT DOC API and canonical news feeds.",
)
async def sync_market_signals(
    request: MarketPulseSyncRequest,
    db: SessionDep,
) -> MarketPulseResponse:
    signals = await MarketPulseService.ingest_live_signals(
        session=db,
        sector=request.sector,
        max_records=request.max_signals,
    )
    return MarketPulseResponse(
        signals=[MarketSignalItem.model_validate(s) for s in signals],
        total=len(signals),
        sector=request.sector,
    )


@router.get(
    "/pulse/stats",
    response_model=MarketPulseStatsResponse,
    summary="Get Market Pulse Signal Stats",
    description="Returns aggregate signal velocity, positive/negative sentiment breakdown, and top domains.",
)
async def get_pulse_stats(
    db: SessionDep,
) -> MarketPulseStatsResponse:
    return await MarketPulseService.get_stats(session=db)
