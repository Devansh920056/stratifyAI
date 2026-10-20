"""
Stage 3 Market Intelligence Dashboard & Visualizations Tests.
Verifies:
1. Extraction of 2D Competitive Moat Matrix with Tech Moat and Pricing Power coordinates.
2. 4-Vector risk posture and confidence calibration.
3. Strict classification of empirical verified facts vs inferred model projections.
4. Provenance source domain aggregation and distribution.
5. FastAPI endpoint GET /api/v1/jobs/{job_id}/dashboard.
"""

import uuid
import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import AsyncSessionLocal
from backend.app.main import app
from backend.app.models.enums import JobStatus, ReportStatus
from backend.app.models.job import Job
from backend.app.models.report import Report
from backend.app.services.dashboard_service import DashboardService


@pytest_asyncio.fixture
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def api_client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.mark.asyncio
async def test_dashboard_service_extraction(db_session: AsyncSession):
    """Verify DashboardService extracts grounded moat matrix, vector scores, and claims."""
    job = Job(
        research_question="Analyze enterprise autonomous vehicle fleet software market",
        target_market="Autonomous Mobility",
        geography="North America",
        status=JobStatus.COMPLETED.value,
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)

    report = Report(
        job_id=job.id,
        executive_summary="Executive briefing on autonomous mobility software landscape.",
        market_findings={
            "summary": "High TAM growth with verified commercial deployments.",
            "confidence": 0.93,
            "citations": [{"url": "https://reuters.com/mobility-news", "title": "Mobility Trends"}],
            "key_findings": [
                {
                    "claim": "Autonomous fleet software market projected to reach $45B by 2030.",
                    "confidence": 0.95,
                    "source_url": "https://reuters.com/mobility-news",
                }
            ],
        },
        competitor_analysis={
            "summary": "Key players consolidating high-compute platforms.",
            "confidence": 0.89,
            "citations": [
                {"url": "https://bloomberg.com/av-leaders", "title": "AV Market Leaders"},
                {"url": "https://techcrunch.com/mobility-startups", "title": "Startups in AV"},
            ],
            "key_findings": [
                {
                    "claim": "Top 3 Tier-1 suppliers hold 65% of OEM platform integrations.",
                    "confidence": 0.91,
                    "source_url": "https://bloomberg.com/av-leaders",
                }
            ],
        },
        customer_insights={
            "summary": "Fleet operators require guaranteed 99.999% uptime SLAs.",
            "confidence": 0.87,
            "citations": [],
            "key_findings": [
                {
                    "claim": "Tier-1 enterprise buyers prioritize safety validation over per-seat pricing.",
                    "confidence": 0.88,
                    "source_url": None,
                }
            ],
        },
        opportunities_and_risks={
            "summary": "Regulatory approvals vary significantly across state jurisdictions.",
            "confidence": 0.82,
            "citations": [{"url": "https://dot.gov/av-guidelines", "title": "DOT Guidance"}],
            "key_findings": [
                {
                    "claim": "Federal safety frameworks remain pending legislative review.",
                    "confidence": 0.85,
                    "source_url": "https://dot.gov/av-guidelines",
                }
            ],
        },
        citations=[
            {"url": "https://reuters.com/mobility-news", "title": "Mobility Trends"},
            {"url": "https://bloomberg.com/av-leaders", "title": "AV Market Leaders"},
            {"url": "https://techcrunch.com/mobility-startups", "title": "Startups in AV"},
            {"url": "https://dot.gov/av-guidelines", "title": "DOT Guidance"},
        ],
        status=ReportStatus.FINAL.value,
    )
    db_session.add(report)
    await db_session.commit()

    # Call Dashboard Service
    data = await DashboardService.get_dashboard_data(session=db_session, job_id=job.id)

    # 1. Moat Matrix assertions
    assert len(data.moat_matrix) == 4
    for pt in data.moat_matrix:
        assert 0.0 <= pt.technological_moat <= 100.0
        assert 0.0 <= pt.pricing_power <= 100.0
        assert pt.quadrant in ("Market Dominators", "Niche Innovators", "Price Leaders", "Disrupted Challengers")

    # 2. Vector Scores assertions
    assert len(data.vector_scores) == 4
    for vs in data.vector_scores:
        assert 0.0 <= vs.confidence <= 1.0
        assert vs.risk_level in ("LOW", "MEDIUM", "HIGH")

    # 3. Claims classification assertions (empirical vs inferred)
    assert data.empirical_facts_count >= 1
    assert data.inferred_projections_count >= 1

    # 4. Source domain distribution
    domains = [d.domain for d in data.source_domains]
    assert "reuters.com" in domains or "bloomberg.com" in domains


@pytest.mark.asyncio
async def test_dashboard_api_endpoint(api_client: httpx.AsyncClient):
    """Verify HTTP GET /api/v1/jobs/{job_id}/dashboard returns full visual intelligence response."""
    # Create Job
    res = await api_client.post(
        "/api/v1/jobs",
        json={
            "research_question": "Analyze cybersecurity quantum-safe encryption transition",
            "target_market": "Cybersecurity",
            "geography": "Global",
        },
    )
    assert res.status_code == 202
    job_id = res.json()["id"]

    # Request dashboard data
    dash_res = await api_client.get(f"/api/v1/jobs/{job_id}/dashboard")
    assert dash_res.status_code == 200
    dash_data = dash_res.json()

    assert dash_data["job_id"] == job_id
    assert dash_data["target_market"] == "Cybersecurity"
    assert "moat_matrix" in dash_data
    assert "vector_scores" in dash_data
    assert "claims_breakdown" in dash_data
    assert "source_domains" in dash_data


@pytest.mark.asyncio
async def test_dashboard_api_404_invalid_job(api_client: httpx.AsyncClient):
    """Verify 404 response when querying dashboard for non-existent job."""
    fake_id = uuid.uuid4()
    res = await api_client.get(f"/api/v1/jobs/{fake_id}/dashboard")
    assert res.status_code == 404
