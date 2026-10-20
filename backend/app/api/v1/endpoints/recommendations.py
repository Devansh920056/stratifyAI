"""
Action Intelligence Recommendations API Endpoints.
Provides endpoints for retrieving, generating, and updating strategic recommendations.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_async_session
from backend.app.models.enums import RecommendationStatus
from backend.app.schemas.recommendation import (
    RecommendationListResponse,
    RecommendationResponse,
    RecommendationStatusUpdateRequest,
)
from backend.app.services.recommendation_service import RecommendationService

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_async_session)]


@router.get(
    "/jobs/{job_id}/recommendations",
    response_model=RecommendationListResponse,
    summary="Get Recommendations for Job",
    description="Fetches all synthesized strategic recommendations associated with a specific research job.",
)
async def get_job_recommendations(
    job_id: uuid.UUID,
    db: SessionDep,
) -> RecommendationListResponse:
    recs = await RecommendationService.get_recommendations_for_job(session=db, job_id=job_id)
    return RecommendationListResponse(
        job_id=job_id,
        total=len(recs),
        items=[RecommendationResponse.model_validate(r) for r in recs],
    )


@router.post(
    "/jobs/{job_id}/recommendations/generate",
    response_model=RecommendationListResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate Grounded Strategic Recommendations",
    description="Synthesizes actionable strategic initiatives with effort vs. impact scores and evidence provenance.",
)
async def generate_job_recommendations(
    job_id: uuid.UUID,
    db: SessionDep,
) -> RecommendationListResponse:
    try:
        recs = await RecommendationService.generate_recommendations_for_job(session=db, job_id=job_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    return RecommendationListResponse(
        job_id=job_id,
        total=len(recs),
        items=[RecommendationResponse.model_validate(r) for r in recs],
    )


@router.patch(
    "/recommendations/{recommendation_id}/status",
    response_model=RecommendationResponse,
    summary="Update Recommendation Lifecycle Status",
    description="Updates recommendation state: DRAFT -> APPROVED -> IMPLEMENTED -> REVIEWED, or DISMISSED.",
)
async def update_recommendation_status(
    recommendation_id: uuid.UUID,
    request: RecommendationStatusUpdateRequest,
    db: SessionDep,
) -> RecommendationResponse:
    updated = await RecommendationService.update_recommendation_status(
        session=db,
        recommendation_id=recommendation_id,
        new_status=request.status,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recommendation {recommendation_id} not found.",
        )

    return RecommendationResponse.model_validate(updated)
