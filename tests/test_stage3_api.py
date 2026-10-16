"""
Stage 3 FastAPI API and Job Lifecycle Integration Tests.
Verifies:
1. Health and readiness probe endpoints.
2. HTTP 202 Accepted response on job creation.
3. Automatic 4-vector task decomposition.
4. Input validation and 422 responses on malformed requests.
5. Job retrieval, task list inspection, and 404 behavior.
6. Honest 404 response on /report before report aggregation.
7. OpenAPI documentation generation.
"""

import uuid

import httpx
import pytest
import pytest_asyncio

from backend.app.main import app
from backend.app.models.enums import TaskType


@pytest_asyncio.fixture
async def api_client():
    """Async HTTP test client bound directly to the FastAPI ASGI application."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.mark.asyncio
async def test_health_liveness(api_client: httpx.AsyncClient):
    """Verify /api/v1/health/live returns 200 and healthy status."""
    response = await api_client.get("/api/v1/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["version"] == "0.1.0"


@pytest.mark.asyncio
async def test_health_readiness(api_client: httpx.AsyncClient):
    """Verify /api/v1/health/ready checks database connection and returns 200."""
    response = await api_client.get("/api/v1/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["components"]["database"] == "healthy"


@pytest.mark.asyncio
async def test_create_research_job_success(api_client: httpx.AsyncClient):
    """
    CRITICAL TEST:
    Submitting valid research question returns HTTP 202 Accepted,
    a Location header, and persists 4 decomposed tasks.
    """
    payload = {
        "research_question": "Analyze commercial supersonic passenger flight market viability",
        "target_market": "Aviation",
        "geography": "Transatlantic & Transpacific",
        "time_range": "2026-2035",
        "focus_areas": ["Boom Supersonic", "Noise Regulations", "Fuel Economics"],
    }

    response = await api_client.post("/api/v1/jobs", json=payload)
    assert response.status_code == 202
    assert "Location" in response.headers

    data = response.json()
    assert "id" in data
    job_id = data["id"]
    assert response.headers["Location"] == f"/api/v1/jobs/{job_id}"
    assert data["status"] == "PENDING"
    assert data["tasks_count"] == 4
    assert data["target_market"] == "Aviation"

    # Now verify the job can be polled via GET /api/v1/jobs/{job_id}
    detail_res = await api_client.get(f"/api/v1/jobs/{job_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == job_id
    assert detail["has_report"] is False
    assert len(detail["tasks"]) == 4

    # Verify that all 4 orthogonal task types were generated
    task_types = {t["task_type"] for t in detail["tasks"]}
    expected_types = {
        TaskType.MARKET_OVERVIEW.value,
        TaskType.COMPETITOR_ANALYSIS.value,
        TaskType.CUSTOMER_INSIGHTS.value,
        TaskType.REGULATORY_RISKS.value,
    }
    assert task_types == expected_types

    # Verify search queries inside the tasks include target market and focus context
    market_overview_task = next(
        t for t in detail["tasks"] if t["task_type"] == TaskType.MARKET_OVERVIEW.value
    )
    assert len(market_overview_task["search_queries"]) >= 2
    assert any("Aviation" in q for q in market_overview_task["search_queries"])


@pytest.mark.asyncio
async def test_create_research_job_validation_errors(api_client: httpx.AsyncClient):
    """Verify input validation returns 422 on invalid, missing, or whitespace payloads."""
    # 1. Question too short (< 10 chars)
    res1 = await api_client.post(
        "/api/v1/jobs",
        json={
            "research_question": "Too short",
            "target_market": "Tech",
            "geography": "Global",
        },
    )
    assert res1.status_code == 422

    # 2. Missing required field target_market
    res2 = await api_client.post(
        "/api/v1/jobs",
        json={
            "research_question": "Valid research question about markets",
            "geography": "Global",
        },
    )
    assert res2.status_code == 422

    # 3. Whitespace-only string
    res3 = await api_client.post(
        "/api/v1/jobs",
        json={
            "research_question": "   ",
            "target_market": "Tech",
            "geography": "Global",
        },
    )
    assert res3.status_code == 422


@pytest.mark.asyncio
async def test_get_job_tasks_endpoint(api_client: httpx.AsyncClient):
    """Verify /api/v1/jobs/{job_id}/tasks returns list of tasks."""
    # Create job
    create_res = await api_client.post(
        "/api/v1/jobs",
        json={
            "research_question": "Examine solid state battery commercialization",
            "target_market": "Energy Storage",
            "geography": "Global",
        },
    )
    job_id = create_res.json()["id"]

    # Query tasks
    tasks_res = await api_client.get(f"/api/v1/jobs/{job_id}/tasks")
    assert tasks_res.status_code == 200
    tasks = tasks_res.json()
    assert isinstance(tasks, list)
    assert len(tasks) == 4
    for task in tasks:
        assert task["job_id"] == job_id
        assert task["status"] == "PENDING"
        assert task["attempt_count"] == 0
        assert task["version"] == 1


@pytest.mark.asyncio
async def test_report_endpoint_honest_404_before_ready(api_client: httpx.AsyncClient):
    """
    CRITICAL RULE TEST:
    No fake functionality or premature reports.
    Querying /report on an incomplete job MUST return 404 with honest explanation.
    """
    create_res = await api_client.post(
        "/api/v1/jobs",
        json={
            "research_question": "Direct lithium extraction technology landscape",
            "target_market": "Mining & Materials",
            "geography": "South America",
        },
    )
    job_id = create_res.json()["id"]

    report_res = await api_client.get(f"/api/v1/jobs/{job_id}/report")
    assert report_res.status_code == 404
    data = report_res.json()
    assert "Report is not ready yet" in data["detail"]
    assert "PENDING" in data["detail"]


@pytest.mark.asyncio
async def test_non_existent_job_returns_404(api_client: httpx.AsyncClient):
    """Querying a non-existent UUID returns 404."""
    random_uuid = uuid.uuid4()
    res = await api_client.get(f"/api/v1/jobs/{random_uuid}")
    assert res.status_code == 404
    assert f"Research job '{random_uuid}' not found" in res.json()["detail"]


@pytest.mark.asyncio
async def test_list_jobs_endpoint(api_client: httpx.AsyncClient):
    """Verify /api/v1/jobs returns paginated list of jobs."""
    # Create a job first to ensure data exists independently of test ordering
    await api_client.post(
        "/api/v1/jobs",
        json={
            "research_question": "Examine carbon capture and storage market economics",
            "target_market": "Climate Tech",
            "geography": "Global",
        },
    )

    res = await api_client.get("/api/v1/jobs?limit=10&offset=0")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "tasks_count" in data[0]


@pytest.mark.asyncio
async def test_openapi_docs_available(api_client: httpx.AsyncClient):
    """Verify OpenAPI schema is successfully generated."""
    res = await api_client.get("/openapi.json")
    assert res.status_code == 200
    openapi = res.json()
    assert (
        openapi["info"]["title"]
        == "Stratify AI — Distributed Market Intelligence Coordinator"
    )
    assert "/api/v1/jobs" in openapi["paths"]
