"""
Decision Evaluation & Historical Backtesting API Endpoints.
Provides RESTful APIs for logging real-world execution outcomes, computing Decision Quality Scores (DQS),
and running historical market backtests.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_async_session
from backend.app.schemas.evaluation import (
    BacktestResultResponse,
    BacktestSimulationRequest,
    DecisionAnalyticsSummaryResponse,
    DecisionEvaluationCreateRequest,
    DecisionEvaluationListResponse,
    DecisionEvaluationResponse,
)
from backend.app.services.evaluation_service import EvaluationService

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_async_session)]


@router.post(
    "/recommendations/{recommendation_id}/evaluations",
    response_model=DecisionEvaluationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record Recommendation Outcome Evaluation",
    description="Logs empirical execution results, impact delta, and metric validation for a recommendation.",
)
async def record_evaluation(
    recommendation_id: uuid.UUID,
    request: DecisionEvaluationCreateRequest,
    db: SessionDep,
) -> DecisionEvaluationResponse:
    eval_resp = await EvaluationService.record_evaluation(
        session=db, recommendation_id=recommendation_id, req=request
    )
    if not eval_resp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recommendation '{recommendation_id}' not found.",
        )
    return eval_resp


@router.get(
    "/recommendations/{recommendation_id}/evaluations",
    response_model=list[DecisionEvaluationResponse],
    summary="Get Evaluations for Recommendation",
    description="Retrieves historical outcome audit logs and validation history for a recommendation.",
)
async def get_evaluations_for_recommendation(
    recommendation_id: uuid.UUID,
    db: SessionDep,
) -> list[DecisionEvaluationResponse]:
    return await EvaluationService.get_evaluations_for_recommendation(
        session=db, recommendation_id=recommendation_id
    )


@router.get(
    "/evaluations",
    response_model=DecisionEvaluationListResponse,
    summary="List All Decision Evaluations",
    description="Lists all recorded decision evaluations with optional outcome status filtering.",
)
async def list_evaluations(
    db: SessionDep,
    outcome_status: str | None = Query(None, description="VALIDATED, PARTIALLY_VALIDATED, INVALIDATED, IN_PROGRESS"),
    limit: int = Query(50, ge=1, le=100, description="Max evaluations to retrieve"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> DecisionEvaluationListResponse:
    return await EvaluationService.list_evaluations(
        session=db, outcome_status=outcome_status, limit=limit, offset=offset
    )


@router.get(
    "/evaluations/analytics",
    response_model=DecisionAnalyticsSummaryResponse,
    summary="Get Decision Analytics & Quality Metrics",
    description="Computes organizational Decision Quality Score, validation success rate, and mean impact delta.",
)
async def get_decision_analytics(db: SessionDep) -> DecisionAnalyticsSummaryResponse:
    return await EvaluationService.get_decision_analytics(session=db)


@router.post(
    "/evaluations/backtest",
    response_model=BacktestResultResponse,
    summary="Run Historical Recommendation Backtest",
    description="Evaluates historical recommendation hypotheses against subsequent market signals and trends.",
)
async def run_backtest_simulation(
    request: BacktestSimulationRequest,
    db: SessionDep,
) -> BacktestResultResponse:
    return await EvaluationService.run_backtest_simulation(session=db, req=request)
