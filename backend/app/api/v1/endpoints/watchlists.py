"""
Competitor Watchlists and Alerting Engine API Endpoints.
Provides RESTful APIs for managing monitored competitor entities, alert feeds,
and manual/automated signal threshold triggers.
"""

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_async_session
from backend.app.schemas.watchlist import (
    AlertListResponse,
    AlertMarkReadRequest,
    AlertResponse,
    AlertSimulateRequest,
    WatchlistCreateRequest,
    WatchlistListResponse,
    WatchlistResponse,
)
from backend.app.services.watchlist_service import WatchlistService

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_async_session)]


@router.get(
    "/watchlists",
    response_model=WatchlistListResponse,
    summary="List Competitor Watchlists",
    description="Retrieves all active competitor watchlists with associated alert counters.",
)
async def list_watchlists(db: SessionDep) -> WatchlistListResponse:
    return await WatchlistService.list_watchlists(session=db)


@router.post(
    "/watchlists",
    response_model=WatchlistResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Competitor Watchlist",
    description="Registers a new competitor watchlist with tracked entities and alert thresholds.",
)
async def create_watchlist(
    request: WatchlistCreateRequest,
    db: SessionDep,
) -> WatchlistResponse:
    return await WatchlistService.create_watchlist(session=db, req=request)


@router.get(
    "/watchlists/{watchlist_id}",
    response_model=WatchlistResponse,
    summary="Get Watchlist Details",
    description="Fetches a specific watchlist with its recent triggered alerts.",
)
async def get_watchlist(
    watchlist_id: uuid.UUID,
    db: SessionDep,
) -> WatchlistResponse:
    wl = await WatchlistService.get_watchlist(session=db, watchlist_id=watchlist_id)
    if not wl:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Watchlist '{watchlist_id}' not found.",
        )
    return wl


@router.delete(
    "/watchlists/{watchlist_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Watchlist",
    description="Deletes a watchlist and all linked alerts.",
)
async def delete_watchlist(
    watchlist_id: uuid.UUID,
    db: SessionDep,
) -> None:
    deleted = await WatchlistService.delete_watchlist(session=db, watchlist_id=watchlist_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Watchlist '{watchlist_id}' not found.",
        )


@router.get(
    "/alerts",
    response_model=AlertListResponse,
    summary="Get Market Anomaly Alerts",
    description="Fetches real-time alerts generated across watchlists with severity and read status filters.",
)
async def get_alerts(
    db: SessionDep,
    unread_only: bool = Query(False, description="Filter for unread alerts only"),
    severity: Optional[str] = Query(None, description="Filter by severity: INFO, WARNING, CRITICAL"),
    watchlist_id: Optional[uuid.UUID] = Query(None, description="Filter by specific watchlist"),
    limit: int = Query(50, ge=1, le=100, description="Max alerts to retrieve"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> AlertListResponse:
    return await WatchlistService.get_alerts(
        session=db,
        unread_only=unread_only,
        severity=severity,
        watchlist_id=watchlist_id,
        limit=limit,
        offset=offset,
    )


@router.patch(
    "/alerts/{alert_id}/read",
    response_model=AlertResponse,
    summary="Mark Alert Read Status",
    description="Updates the acknowledgment / read status of a specific alert.",
)
async def mark_alert_read(
    alert_id: uuid.UUID,
    request: AlertMarkReadRequest,
    db: SessionDep,
) -> AlertResponse:
    alert = await WatchlistService.mark_alert_read(
        session=db, alert_id=alert_id, is_read=request.is_read
    )
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert '{alert_id}' not found.",
        )
    return alert


@router.post(
    "/alerts/simulate",
    response_model=AlertResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Simulate Market Alert",
    description="Triggers a synthetic market or competitor alert for verification and simulation.",
)
async def simulate_alert(
    request: AlertSimulateRequest,
    db: SessionDep,
) -> AlertResponse:
    return await WatchlistService.simulate_alert(session=db, req=request)
