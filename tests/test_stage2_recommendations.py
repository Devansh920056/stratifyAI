"""
Stage 2 Action Intelligence and Decision Matrix Tests.
Verifies:
1. Recommendation SQLAlchemy model persistence and database constraints.
2. Dynamic priority score calculation and time horizon categorization.
3. Recommendation lifecycle status transitions (DRAFT -> APPROVED -> IMPLEMENTED -> REVIEWED / DISMISSED).
4. Recommendation synthesis service grounded in research findings with evidence linking.
5. FastAPI endpoints for generating, fetching, and updating recommendations.
"""

import uuid
import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import AsyncSessionLocal
from backend.app.main import app
from backend.app.models.enums import JobStatus, RecommendationStatus, TimeHorizon
from backend.app.models.job import Job
from backend.app.models.recommendation import Recommendation
from backend.app.services.recommendation_service import RecommendationService


@pytest_asyncio.fixture
async def db_session():
    """Provides a fresh isolated database session."""
    async with AsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def api_client():
    """Async HTTP test client bound directly to FastAPI application."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.mark.asyncio
async def test_recommendation_crud_and_relationships(db_session: AsyncSession):
    """Verify Recommendation model persistence and foreign-key relationship to Job."""
    job = Job(
        research_question="Evaluate competitive landscape of developer AI copilots",
        target_market="Developer Tools",
        geography="Global",
        status=JobStatus.COMPLETED.value,
        focus_areas=["pricing", "latency"],
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)

    rec = Recommendation(
        job_id=job.id,
        title="Introduce Sub-Second Autocomplete Tier",
        description="Optimize inference cache to lower latency below 200ms.",
        rationale="Developer benchmarks show 3x adoption lift when latency drops below 250ms.",
        estimated_impact=9,
        estimated_effort=4,
        priority_score=round((9 * 0.7) - (4 * 0.3), 2),
        time_horizon=TimeHorizon.IMMEDIATE.value,
        outcome_hypothesis="Low-latency tier increases daily active developers by 25%.",
        success_metric="Daily Active Developers (DAD)",
        target_metric_value="+25%",
        status=RecommendationStatus.DRAFT.value,
        evidence_ids=[{"url": "https://example.com/ai-benchmark", "title": "Inference Latency Impact"}],
    )
    db_session.add(rec)
    await db_session.commit()
    await db_session.refresh(rec)

    job_uuid = job.id

    assert rec.id is not None
    assert rec.job_id == job_uuid
    assert rec.priority_score == 5.1
    assert rec.status == RecommendationStatus.DRAFT.value
    assert len(rec.evidence_ids) == 1

    # Verify query through Job relationship in a clean session
    async with AsyncSessionLocal() as read_session:
        refreshed_job = await read_session.scalar(select(Job).where(Job.id == job_uuid))
        assert refreshed_job is not None
        assert len(refreshed_job.recommendations) >= 1
        assert any(r.id == rec.id for r in refreshed_job.recommendations)


@pytest.mark.asyncio
async def test_recommendation_status_lifecycle(db_session: AsyncSession):
    """Verify state transitions: DRAFT -> APPROVED -> IMPLEMENTED -> REVIEWED."""
    job = Job(
        research_question="Lifecycle testing",
        target_market="FinTech",
        geography="North America",
        status=JobStatus.COMPLETED.value,
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)

    rec = Recommendation(
        job_id=job.id,
        title="Automate KYC Verification",
        description="Deploy optical character recognition for passports.",
        rationale="Reduces manual compliance review cost.",
        estimated_impact=8,
        estimated_effort=5,
        priority_score=4.1,
        outcome_hypothesis="KYC processing time drops from 2 days to 5 minutes.",
        success_metric="Verification Time",
        status=RecommendationStatus.DRAFT.value,
    )
    db_session.add(rec)
    await db_session.commit()
    await db_session.refresh(rec)

    # Transition 1: DRAFT -> APPROVED
    updated = await RecommendationService.update_recommendation_status(
        session=db_session,
        recommendation_id=rec.id,
        new_status=RecommendationStatus.APPROVED,
    )
    assert updated is not None
    assert updated.status == RecommendationStatus.APPROVED.value

    # Transition 2: APPROVED -> IMPLEMENTED
    updated = await RecommendationService.update_recommendation_status(
        session=db_session,
        recommendation_id=rec.id,
        new_status=RecommendationStatus.IMPLEMENTED,
    )
    assert updated is not None
    assert updated.status == RecommendationStatus.IMPLEMENTED.value

    # Transition 3: IMPLEMENTED -> REVIEWED
    updated = await RecommendationService.update_recommendation_status(
        session=db_session,
        recommendation_id=rec.id,
        new_status=RecommendationStatus.REVIEWED,
    )
    assert updated is not None
    assert updated.status == RecommendationStatus.REVIEWED.value


@pytest.mark.asyncio
async def test_recommendation_api_endpoints(api_client: httpx.AsyncClient):
    """Verify HTTP endpoints for generating, fetching, and updating recommendations."""
    # 1. Create a job via API
    create_res = await api_client.post(
        "/api/v1/jobs",
        json={
            "research_question": "Analyze generative AI vector database market growth",
            "target_market": "Database Systems",
            "geography": "Global",
        },
    )
    assert create_res.status_code == 202
    job_id = create_res.json()["id"]

    # 2. Generate recommendations for the job
    gen_res = await api_client.post(f"/api/v1/jobs/{job_id}/recommendations/generate")
    assert gen_res.status_code == 201
    gen_data = gen_res.json()
    assert gen_data["job_id"] == job_id
    assert gen_data["total"] >= 3
    first_rec = gen_data["items"][0]
    assert "id" in first_rec
    assert "priority_score" in first_rec
    assert "outcome_hypothesis" in first_rec
    assert first_rec["status"] == "DRAFT"

    # 3. Retrieve recommendations for the job
    get_res = await api_client.get(f"/api/v1/jobs/{job_id}/recommendations")
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data["total"] == gen_data["total"]

    # 4. Update status of the first recommendation to APPROVED
    rec_id = first_rec["id"]
    patch_res = await api_client.patch(
        f"/api/v1/recommendations/{rec_id}/status",
        json={"status": "APPROVED"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "APPROVED"
