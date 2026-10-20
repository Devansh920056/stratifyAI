"""
Market Intelligence Dashboard API Endpoints.
Serves 2D Competitive Moat Matrix, 4-Vector Risk & Confidence Radar,
empirical vs. inferred fact classifications, and source distribution.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_async_session
from backend.app.schemas.dashboard import JobDashboardResponse
from backend.app.services.dashboard_service import DashboardService

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_async_session)]


@router.get(
    "/jobs/{job_id}/dashboard",
    response_model=JobDashboardResponse,
    summary="Get Market Intelligence Visual Dashboard",
    description="Returns grounded 2D Moat Matrix, 4-vector risk scores, empirical vs inferred claim breakdown, and source distribution.",
)
async def get_job_dashboard(
    job_id: uuid.UUID,
    db: SessionDep,
) -> JobDashboardResponse:
    try:
        data = await DashboardService.get_dashboard_data(session=db, job_id=job_id)
        return data
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
