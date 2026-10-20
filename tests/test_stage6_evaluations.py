"""
Stage 6 Decision Evaluation, Outcome Auditing, and Backtesting Tests.
Verifies:
1. DecisionEvaluation model persistence, JSONB metrics, and cascade deletion.
2. Lifecycle status transitions when outcomes are logged.
3. Decision analytics aggregation (Validation Rate, Mean Impact Delta, DQS).
4. Historical market backtesting simulation engine.
5. REST API endpoints:
   - POST /api/v1/recommendations/{id}/evaluations
   - GET /api/v1/recommendations/{id}/evaluations
   - GET /api/v1/evaluations
   - GET /api/v1/evaluations/analytics
   - POST /api/v1/evaluations/backtest
"""

import uuid
import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.base import utc_now
from backend.app.db.session import AsyncSessionLocal
from backend.app.main import app
from backend.app.models.decision_evaluation import DecisionEvaluation
from backend.app.models.enums import DecisionOutcomeStatus, JobStatus, RecommendationStatus, TimeHorizon
from backend.app.models.job import Job
from backend.app.models.recommendation import Recommendation
from backend.app.schemas.evaluation import BacktestSimulationRequest, DecisionEvaluationCreateRequest
from backend.app.services.evaluation_service import EvaluationService


@pytest_asyncio.fixture
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def api_client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def _create_test_job_and_recommendation(session: AsyncSession) -> tuple[Job, Recommendation]:
    job = Job(
        research_question=f"Test Evaluation Inquiry {uuid.uuid4().hex[:6]}",
        target_market="Energy Grid",
        geography="Global",
        status=JobStatus.COMPLETED.value,
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)

    rec = Recommendation(
        job_id=job.id,
        title="Deploy Grid Modular Inverters",
        description="Replace central substations with distributed inverters.",
        rationale="Lower latency and reduced single point of failure risk.",
        estimated_impact=8,
        estimated_effort=4,
        priority_score=4.4,
        time_horizon=TimeHorizon.NEAR_TERM.value,
        outcome_hypothesis="Reduces thermal downtime by 25% within 60 days.",
        success_metric="Thermal Downtime Reduction",
        target_metric_value=">= 25%",
        status=RecommendationStatus.DRAFT.value,
        evidence_ids=[],
    )
    session.add(rec)
    await session.commit()
    await session.refresh(rec)
    return job, rec


@pytest.mark.asyncio
async def test_decision_evaluation_model_crud_and_cascades(db_session: AsyncSession):
    """Test creating a DecisionEvaluation linked to a Recommendation, with cascade deletion."""
    job, rec = await _create_test_job_and_recommendation(db_session)

    evaluation = DecisionEvaluation(
        recommendation_id=rec.id,
        outcome_status=DecisionOutcomeStatus.VALIDATED.value,
        evaluator_notes="Pilot cluster operated for 60 days with zero thermal faults.",
        actual_outcome="Thermal downtime reduced by 28%, exceeding 25% target.",
        actual_metric_value="28%",
        impact_delta=1.5,
        confidence_score=0.95,
        metric_evidence=[
            {"metric": "Thermal Downtime", "projected": "25%", "actual": "28%", "status": "EXCEEDED"}
        ],
        linked_signal_ids=[],
        evaluated_at=utc_now(),
    )
    db_session.add(evaluation)
    await db_session.commit()
    await db_session.refresh(evaluation)

    assert evaluation.id is not None
    assert evaluation.recommendation_id == rec.id
    assert evaluation.impact_delta == 1.5

    # Delete recommendation and verify cascade deletion of evaluation
    await db_session.delete(rec)
    await db_session.commit()

    deleted = await db_session.scalar(
        select(DecisionEvaluation).where(DecisionEvaluation.id == evaluation.id)
    )
    assert deleted is None


@pytest.mark.asyncio
async def test_evaluation_service_lifecycle_transition(db_session: AsyncSession):
    """Verify recording an evaluation auto-updates the parent recommendation status to REVIEWED."""
    job, rec = await _create_test_job_and_recommendation(db_session)
    assert rec.status == RecommendationStatus.DRAFT.value

    req = DecisionEvaluationCreateRequest(
        outcome_status="VALIDATED",
        evaluator_notes="Successful production rollout across 10 substations.",
        actual_outcome="Reliability improved across all nodes.",
        actual_metric_value="31% reduction",
        impact_delta=2.0,
        confidence_score=0.9,
    )

    resp = await EvaluationService.record_evaluation(
        session=db_session, recommendation_id=rec.id, req=req
    )
    assert resp is not None
    assert resp.outcome_status == "VALIDATED"
    assert resp.impact_delta == 2.0

    # Verify recommendation was updated
    await db_session.refresh(rec)
    assert rec.status == RecommendationStatus.REVIEWED.value


@pytest.mark.asyncio
async def test_decision_analytics_calculation(db_session: AsyncSession):
    """Test Decision Analytics summary calculations."""
    job, rec = await _create_test_job_and_recommendation(db_session)

    # Record 1 VALIDATED and 1 INVALIDATED evaluation
    ev1 = DecisionEvaluation(
        recommendation_id=rec.id,
        outcome_status=DecisionOutcomeStatus.VALIDATED.value,
        evaluator_notes="Met projection.",
        actual_outcome="Achieved results.",
        impact_delta=1.0,
        confidence_score=0.9,
        evaluated_at=utc_now(),
    )
    ev2 = DecisionEvaluation(
        recommendation_id=rec.id,
        outcome_status=DecisionOutcomeStatus.INVALIDATED.value,
        evaluator_notes="Missed target due to supplier bottleneck.",
        actual_outcome="Deployment stalled.",
        impact_delta=-2.0,
        confidence_score=0.8,
        evaluated_at=utc_now(),
    )
    db_session.add_all([ev1, ev2])
    await db_session.commit()

    analytics = await EvaluationService.get_decision_analytics(session=db_session)
    assert analytics.total_evaluated >= 2
    assert analytics.validated_count >= 1
    assert analytics.invalidated_count >= 1
    assert 0.0 <= analytics.validation_rate <= 100.0


@pytest.mark.asyncio
async def test_backtest_simulation_engine(db_session: AsyncSession):
    """Test backtesting recommendations against continuous market signals."""
    job, rec = await _create_test_job_and_recommendation(db_session)

    req = BacktestSimulationRequest(job_id=job.id, lookback_days=30)
    backtest = await EvaluationService.run_backtest_simulation(session=db_session, req=req)

    assert backtest.total_recommendations >= 1
    assert 0.0 <= backtest.alignment_score <= 100.0
    finding = backtest.findings[0]
    assert finding.recommendation_id == rec.id
    assert finding.backtest_verdict in ("STRONGLY_ALIGNED", "MODERATELY_ALIGNED", "DIVERGENT", "NEUTRAL")


@pytest.mark.asyncio
async def test_api_evaluation_endpoints(api_client: httpx.AsyncClient, db_session: AsyncSession):
    """Test REST API endpoints for logging evaluations, analytics, and backtests."""
    job, rec = await _create_test_job_and_recommendation(db_session)

    # 1. POST evaluation
    payload = {
        "outcome_status": "VALIDATED",
        "evaluator_notes": "API test evaluation notes.",
        "actual_outcome": "API test measured results.",
        "actual_metric_value": "15%",
        "impact_delta": 0.5,
        "confidence_score": 0.88,
    }
    post_res = await api_client.post(
        f"/api/v1/recommendations/{rec.id}/evaluations",
        json=payload,
    )
    assert post_res.status_code == 201
    ev_data = post_res.json()
    assert ev_data["outcome_status"] == "VALIDATED"
    assert ev_data["impact_delta"] == 0.5

    # 2. GET evaluations for recommendation
    get_res = await api_client.get(f"/api/v1/recommendations/{rec.id}/evaluations")
    assert get_res.status_code == 200
    evals = get_res.json()
    assert len(evals) >= 1
    assert evals[0]["id"] == ev_data["id"]

    # 3. GET all evaluations
    list_res = await api_client.get("/api/v1/evaluations")
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1

    # 4. GET analytics
    analytics_res = await api_client.get("/api/v1/evaluations/analytics")
    assert analytics_res.status_code == 200
    assert "validation_rate" in analytics_res.json()

    # 5. POST backtest
    bt_res = await api_client.post(
        "/api/v1/evaluations/backtest",
        json={"job_id": str(job.id), "lookback_days": 60},
    )
    assert bt_res.status_code == 200
    assert "alignment_score" in bt_res.json()
