"""
Stage 10: End-to-End Distributed Integration & Full System Verification Suite.
Validates the entire distributed pipeline:
FastAPI API -> Atomic Outbox -> RabbitMQ Broker -> Worker Consumer ->
Web Evidence (Tavily/Mock) -> LLM Synthesis (Gemini/Mock) -> PostgreSQL OCC ->
Automated Report Aggregation -> Client REST Retrieval.
"""

import asyncio

import httpx
import pytest
from sqlalchemy import select

from backend.app.db.session import AsyncSessionLocal
from backend.app.models.enums import JobStatus, ReportStatus, TaskStatus, TaskType
from backend.app.models.evidence import Evidence
from backend.app.models.job import Job
from backend.app.models.report import Report
from backend.app.models.task import Task
from backend.app.providers.llm.base import AnalysisOutput, LLMProvider
from backend.app.providers.llm.mock import MockLLMProvider
from backend.app.providers.search.mock import MockSearchProvider
from backend.app.services.outbox_relay import OutboxRelayService
from workers.consumer import WorkerConsumer

# ==============================================================================
# 1. Full Distributed System Lifecycle Test
# ==============================================================================


@pytest.mark.asyncio
async def test_e2e_full_distributed_lifecycle(api_client: httpx.AsyncClient):
    """
    Validates the complete autonomous distributed market intelligence flow:
    1. Client submits inquiry via POST /api/v1/jobs -> 202 Accepted.
    2. Atomic outbox records exist in PostgreSQL.
    3. OutboxRelayService dispatches tasks to RabbitMQ topic exchange.
    4. WorkerConsumer consumes messages with QoS prefetch, calls search & LLM providers.
    5. Persistence with OCC versioning in PostgreSQL.
    6. Consumer sends manual ACK strictly after commit.
    7. Automated ReportAggregator synthesizes FINAL report upon 4th task completion.
    8. Client retrieves grounded executive report via GET /api/v1/jobs/{id}/report.
    """
    # 1. Submit Inquiry via API
    payload = {
        "research_question": "Global commercialization timeline and Capex parity of sodium-ion grid batteries",
        "target_market": "Utility Energy Storage",
        "geography": "Global",
        "time_range": "2024-2030",
        "focus_areas": ["Cathode Chemistry", "Manufacturing Parity", "Thermal Safety"],
    }
    create_res = await api_client.post("/api/v1/jobs", json=payload)
    assert create_res.status_code == 202
    job_data = create_res.json()
    job_id = job_data["id"]
    assert job_data["status"] == "PENDING"
    assert job_data["tasks_count"] == 4

    job_detail_res = await api_client.get(f"/api/v1/jobs/{job_id}")
    assert job_detail_res.status_code == 200
    assert job_detail_res.json()["has_report"] is False

    # 2. Verify Initial 404 for report
    initial_report_res = await api_client.get(f"/api/v1/jobs/{job_id}/report")
    assert initial_report_res.status_code == 404

    # 3. Outbox Relay Dispatches to RabbitMQ
    async with AsyncSessionLocal() as session:
        relayed_count = await OutboxRelayService.relay_batch(session)
        await session.commit()
        assert relayed_count >= 4

    # 4. Run WorkerConsumer to Drain and Process RabbitMQ Queue
    mock_search = MockSearchProvider()
    mock_llm = MockLLMProvider()

    stop_event = asyncio.Event()
    consumer = WorkerConsumer(
        worker_id="test-e2e-worker",
        prefetch_count=2,
        search_provider=mock_search,
        llm_provider=mock_llm,
    )

    # Launch consumer as background task
    consumer_task = asyncio.create_task(consumer.start(stop_event=stop_event))

    # Wait for consumer to process all 4 tasks
    max_wait = 15.0
    elapsed = 0.0
    completed = False

    while elapsed < max_wait:
        await asyncio.sleep(0.5)
        elapsed += 0.5
        async with AsyncSessionLocal() as session:
            job_stmt = select(Job).where(Job.id == job_id)
            job = await session.scalar(job_stmt)
            if job and job.status in (
                JobStatus.COMPLETED.value,
                JobStatus.PARTIALLY_COMPLETED.value,
            ):
                completed = True
                break

    # Stop consumer cleanly
    stop_event.set()
    await consumer_task

    assert completed is True, f"E2E processing did not complete within {max_wait}s"

    # 5. Verify PostgreSQL State & OCC
    async with AsyncSessionLocal() as session:
        tasks_stmt = select(Task).where(Task.job_id == job_id)
        tasks = list((await session.scalars(tasks_stmt)).all())
        assert len(tasks) == 4
        for t in tasks:
            assert t.status == TaskStatus.COMPLETED.value
            assert t.version >= 2  # Incremented via OCC
            assert t.started_at is not None
            assert t.completed_at is not None

        # Verify Report exists
        report_stmt = select(Report).where(Report.job_id == job_id)
        report = await session.scalar(report_stmt)
        assert report is not None
        assert report.status == ReportStatus.FINAL.value
        assert len(report.citations) >= 4

    # 6. Retrieve Final Report via API
    report_res = await api_client.get(f"/api/v1/jobs/{job_id}/report")
    assert report_res.status_code == 200
    final_report = report_res.json()

    assert final_report["job_id"] == str(job_id)
    assert final_report["status"] == "FINAL"
    assert len(final_report["executive_summary"]) > 80
    assert final_report["market_findings"]["status"] == "COMPLETED"
    assert final_report["competitor_analysis"]["status"] == "COMPLETED"
    assert final_report["customer_insights"]["status"] == "COMPLETED"
    assert final_report["opportunities_and_risks"]["status"] == "COMPLETED"

    # Verify All Citations are clean and non-empty
    for c in final_report["citations"]:
        assert c["url"].startswith("http")
        assert "?" not in c["url"] or "utm_" not in c["url"]

    # 7. Verify Job Status Polling Endpoint
    job_status_res = await api_client.get(f"/api/v1/jobs/{job_id}")
    assert job_status_res.status_code == 200
    job_detail = job_status_res.json()
    assert job_detail["status"] == "COMPLETED"
    assert job_detail["has_report"] is True


# ==============================================================================
# 2. Distributed Partial Degradation & DLQ Recovery Test
# ==============================================================================


class PartialFailingLLMProvider(LLMProvider):
    """
    Simulates a worker failure on the REGULATORY_RISKS vector,
    forcing it to exhaust retries and route to DLQ, while other 3 vectors succeed.
    """

    def __init__(self):
        self._fallback = MockLLMProvider()

    @property
    def provider_name(self) -> str:
        return "partial-failing-mock"

    @property
    def model_name(self) -> str:
        return "mock-failing-model"

    async def analyze(
        self,
        task_type: str,
        research_question: str,
        evidence_items: list[Evidence],
    ) -> AnalysisOutput:
        if task_type == TaskType.REGULATORY_RISKS.value:
            raise RuntimeError(
                "Simulated unrecoverable provider timeout on regulatory vector"
            )
        return await self._fallback.analyze(
            task_type=task_type,
            research_question=research_question,
            evidence_items=evidence_items,
        )


@pytest.mark.asyncio
async def test_e2e_partial_degradation_and_dlq_handling(api_client: httpx.AsyncClient):
    """
    Validates distributed graceful degradation:
    1. Job is created with 4 vectors.
    2. REGULATORY_RISKS task exhausts retries and is routed to Dead Letter Queue (DLQ).
    3. Other 3 vectors succeed.
    4. Aggregator detects 3 completed + 1 failed task.
    5. ReportAggregator synthesizes a PARTIAL report.
    6. API exposes status="PARTIAL" and research limitations explaining the missing vector.
    """
    # 1. Create Job
    payload = {
        "research_question": "Autonomous drone delivery regulatory hurdles and logistics economics",
        "target_market": "Last-Mile Logistics",
        "geography": "North America",
    }
    create_res = await api_client.post("/api/v1/jobs", json=payload)
    assert create_res.status_code == 202
    job_id = create_res.json()["id"]

    # 2. Outbox Relay
    async with AsyncSessionLocal() as session:
        await OutboxRelayService.relay_batch(session)
        await session.commit()

    # 3. Run consumer with partial-failing LLM provider
    failing_llm = PartialFailingLLMProvider()
    mock_search = MockSearchProvider()

    stop_event = asyncio.Event()
    consumer = WorkerConsumer(
        worker_id="test-failing-worker",
        prefetch_count=1,
        search_provider=mock_search,
        llm_provider=failing_llm,
    )

    consumer_task = asyncio.create_task(consumer.start(stop_event=stop_event))

    # Wait for completion of partial degradation
    max_wait = 18.0
    elapsed = 0.0
    finished = False

    while elapsed < max_wait:
        await asyncio.sleep(0.5)
        elapsed += 0.5
        async with AsyncSessionLocal() as session:
            job = await session.scalar(select(Job).where(Job.id == job_id))
            if job and job.status in (
                JobStatus.PARTIALLY_COMPLETED.value,
                JobStatus.COMPLETED.value,
            ):
                finished = True
                break

    stop_event.set()
    await consumer_task

    assert finished is True, (
        "Partial degradation pipeline did not settle within timeout"
    )

    # 4. Check Job Detail via API
    job_res = await api_client.get(f"/api/v1/jobs/{job_id}")
    assert job_res.status_code == 200
    job_data = job_res.json()
    assert job_data["status"] == "PARTIALLY_COMPLETED"
    assert job_data["has_report"] is True

    # 5. Check Report via API
    report_res = await api_client.get(f"/api/v1/jobs/{job_id}/report")
    assert report_res.status_code == 200
    report_data = report_res.json()

    assert report_data["status"] == "PARTIAL"
    assert report_data["opportunities_and_risks"]["status"] == "FAILED"
    assert report_data["market_findings"]["status"] == "COMPLETED"
    assert report_data["competitor_analysis"]["status"] == "COMPLETED"
    assert report_data["customer_insights"]["status"] == "COMPLETED"
    assert report_data["research_limitations"] is not None
    assert "REGULATORY_RISKS" in report_data["research_limitations"]


# ==============================================================================
# 3. Concurrent Multi-Job Orchestration Test
# ==============================================================================


@pytest.mark.asyncio
async def test_e2e_concurrent_multi_job_orchestration(api_client: httpx.AsyncClient):
    """
    Validates concurrent multi-worker throughput:
    1. Submits 2 separate research inquiries concurrently (8 total tasks).
    2. Relays all outbox tasks.
    3. Runs 2 independent WorkerConsumer instances in parallel (worker-1 and worker-2).
    4. Both jobs complete concurrently without deadlocks, race conditions, or OCC conflicts.
    5. Both reports are synthesized and accessible via API.
    """
    # 1. Create 2 jobs concurrently
    job1_req = {
        "research_question": "Quantum computing cryptographic migration timelines",
        "target_market": "Cybersecurity",
        "geography": "Global",
    }
    job2_req = {
        "research_question": "Direct air carbon capture energy intensity and levelized cost",
        "target_market": "Climate Tech",
        "geography": "Global",
    }

    res1, res2 = await asyncio.gather(
        api_client.post("/api/v1/jobs", json=job1_req),
        api_client.post("/api/v1/jobs", json=job2_req),
    )
    assert res1.status_code == 202
    assert res2.status_code == 202
    job1_id = res1.json()["id"]
    job2_id = res2.json()["id"]

    # 2. Relay outbox events for both jobs
    async with AsyncSessionLocal() as session:
        relayed = await OutboxRelayService.relay_batch(session, limit=20)
        await session.commit()
        assert relayed >= 8

    # 3. Spawn 2 parallel consumers with prefetch=2
    mock_search = MockSearchProvider()
    mock_llm = MockLLMProvider()

    stop_event = asyncio.Event()
    worker_a = WorkerConsumer(
        worker_id="worker-cluster-alpha",
        prefetch_count=2,
        search_provider=mock_search,
        llm_provider=mock_llm,
    )
    worker_b = WorkerConsumer(
        worker_id="worker-cluster-beta",
        prefetch_count=2,
        search_provider=mock_search,
        llm_provider=mock_llm,
    )

    tasks_pool = asyncio.gather(
        worker_a.start(stop_event=stop_event),
        worker_b.start(stop_event=stop_event),
    )

    # 4. Wait for both jobs to reach terminal state
    max_wait = 20.0
    elapsed = 0.0
    all_done = False

    while elapsed < max_wait:
        await asyncio.sleep(0.5)
        elapsed += 0.5
        async with AsyncSessionLocal() as session:
            j1 = await session.scalar(select(Job).where(Job.id == job1_id))
            j2 = await session.scalar(select(Job).where(Job.id == job2_id))
            if (
                j1
                and j1.status
                in (JobStatus.COMPLETED.value, JobStatus.PARTIALLY_COMPLETED.value)
                and j2
                and j2.status
                in (JobStatus.COMPLETED.value, JobStatus.PARTIALLY_COMPLETED.value)
            ):
                all_done = True
                break

    stop_event.set()
    await tasks_pool

    assert all_done is True, "Concurrent job processing did not complete within timeout"

    # 5. Verify both reports exist and are accessible
    r1_res, r2_res = await asyncio.gather(
        api_client.get(f"/api/v1/jobs/{job1_id}/report"),
        api_client.get(f"/api/v1/jobs/{job2_id}/report"),
    )
    assert r1_res.status_code == 200
    assert r2_res.status_code == 200
    assert r1_res.json()["status"] == "FINAL"
    assert r2_res.json()["status"] == "FINAL"
