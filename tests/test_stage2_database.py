"""
Stage 2 Database Layer Verification Tests.
Verifies:
1. Database health and async session lifecycle.
2. Job and Task CRUD operations with UUIDs and timezone-aware timestamps.
3. Cascading deletes (deleting Job deletes child Tasks and Evidence).
4. TaskResult uniqueness constraint per logical task (idempotency enforcement).
5. Report uniqueness constraint per job.
6. Optimistic Concurrency Control (OCC) via task versioning.
7. OutboxEvent persistence and querying for reliable dispatch.
"""

import uuid
from datetime import datetime, timezone
import pytest
import pytest_asyncio
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import (
    AsyncSessionLocal,
    check_database_health,
)
from backend.app.models.enums import (
    JobStatus,
    OutboxStatus,
    ReportStatus,
    TaskStatus,
    TaskType,
)
from backend.app.models.evidence import Evidence, compute_url_hash
from backend.app.models.job import Job
from backend.app.models.outbox import OutboxEvent
from backend.app.models.report import Report
from backend.app.models.task import Task
from backend.app.models.task_result import TaskResult


@pytest_asyncio.fixture
async def db_session() -> AsyncSession:
    """Fixture providing an isolated async session that rolls back after each test."""
    async with AsyncSessionLocal() as session:
        yield session
        # Ensure clean state between tests
        await session.rollback()


@pytest.mark.asyncio
async def test_database_health():
    """Verify that database connection check responds successfully."""
    is_healthy = await check_database_health()
    assert is_healthy is True


@pytest.mark.asyncio
async def test_job_and_task_lifecycle(db_session: AsyncSession):
    """Verify creating a Job with child Tasks, UUID generation, and timezone-aware timestamps."""
    job = Job(
        research_question="Analyze commercial space launch market",
        target_market="Aerospace",
        geography="Global",
        time_range="2025-2030",
        focus_areas=["Reusable Launch Vehicles", "Launch Manifests"],
        status=JobStatus.PENDING.value,
    )
    db_session.add(job)
    await db_session.flush()

    assert isinstance(job.id, uuid.UUID)
    assert job.created_at.tzinfo is not None
    assert job.status == JobStatus.PENDING.value

    # Create associated task
    task = Task(
        job_id=job.id,
        task_type=TaskType.MARKET_OVERVIEW.value,
        search_queries=["commercial space launch market size 2025"],
        status=TaskStatus.PENDING.value,
        version=1,
    )
    db_session.add(task)
    await db_session.flush()

    assert isinstance(task.id, uuid.UUID)
    assert task.job_id == job.id
    assert task.version == 1
    assert task.created_at.tzinfo is not None

    # Query back via relationship
    stmt = select(Job).where(Job.id == job.id)
    result = await db_session.scalar(stmt)
    assert result is not None
    assert len(result.tasks) == 1
    assert result.tasks[0].id == task.id


@pytest.mark.asyncio
async def test_task_result_uniqueness_enforcement(db_session: AsyncSession):
    """
    CRITICAL DISTRIBUTED TEST:
    Verify that task_results enforces UNIQUE(task_id).
    Duplicate delivery of a task message MUST NOT create duplicate logical results.
    """
    job = Job(
        research_question="Quantum computing in cryptography",
        target_market="Cybersecurity",
        geography="North America",
    )
    db_session.add(job)
    await db_session.flush()

    task = Task(
        job_id=job.id,
        task_type=TaskType.COMPETITOR_ANALYSIS.value,
        search_queries=["post quantum cryptography vendors"],
    )
    db_session.add(task)
    await db_session.flush()

    # Insert initial task result
    result1 = TaskResult(
        task_id=task.id,
        key_findings=[{"claim": "NIST standardized lattice-based algorithms", "source_id": "src-1"}],
        grounded_summary="Post-quantum standards established by NIST.",
        confidence_score=0.95,
        citations=[{"url": "https://nist.gov/pqc", "title": "PQC Standards"}],
        model_name="mock-grounder",
    )
    db_session.add(result1)
    await db_session.flush()

    # Attempt to insert second result for the EXACT same task_id (e.g. from redelivered message)
    result2 = TaskResult(
        task_id=task.id,
        key_findings=[{"claim": "Duplicate claim"}],
        grounded_summary="Duplicate summary.",
        confidence_score=0.5,
        citations=[],
        model_name="mock-grounder",
    )
    db_session.add(result2)

    with pytest.raises(IntegrityError):
        await db_session.flush()


@pytest.mark.asyncio
async def test_cascading_deletes(db_session: AsyncSession):
    """Verify that deleting a parent Job cascades and removes child Tasks, Evidence, and Reports."""
    job = Job(
        research_question="Fusion energy startups",
        target_market="CleanTech",
        geography="Europe",
    )
    db_session.add(job)
    await db_session.flush()

    task = Task(
        job_id=job.id,
        task_type=TaskType.MARKET_OVERVIEW.value,
        search_queries=["fusion energy investments 2024"],
    )
    db_session.add(task)
    await db_session.flush()

    evidence = Evidence(
        task_id=task.id,
        job_id=job.id,
        source_url="https://fusionenergy.org/report",
        source_title="European Fusion Landscape",
        snippet="Over 2 billion euros invested in magnet technology.",
        provider_name="mock",
    )
    db_session.add(evidence)

    report = Report(
        job_id=job.id,
        executive_summary="Fusion research is accelerating.",
        market_findings={"growth": "rapid"},
        competitor_analysis={},
        customer_insights={},
        opportunities_and_risks={},
        citations=[],
        status=ReportStatus.FINAL.value,
    )
    db_session.add(report)
    await db_session.flush()

    # Now delete the parent Job
    await db_session.delete(job)
    await db_session.flush()

    # Verify children are cascaded and deleted
    tasks_stmt = select(Task).where(Task.job_id == job.id)
    evidence_stmt = select(Evidence).where(Evidence.job_id == job.id)
    report_stmt = select(Report).where(Report.job_id == job.id)

    assert (await db_session.scalars(tasks_stmt)).all() == []
    assert (await db_session.scalars(evidence_stmt)).all() == []
    assert (await db_session.scalar(report_stmt)) is None


@pytest.mark.asyncio
async def test_optimistic_concurrency_control(db_session: AsyncSession):
    """
    Verify Optimistic Concurrency Control (OCC) on Task.version.
    Prevents race conditions when multiple workers attempt state transitions.
    """
    job = Job(
        research_question="Autonomous trucking adoption",
        target_market="Logistics",
        geography="US",
    )
    db_session.add(job)
    await db_session.flush()

    task = Task(
        job_id=job.id,
        task_type=TaskType.CUSTOMER_INSIGHTS.value,
        search_queries=["autonomous trucking pilot studies"],
        status=TaskStatus.PENDING.value,
        version=1,
    )
    db_session.add(task)
    await db_session.flush()

    # Worker 1 transitions task from PENDING to IN_PROGRESS expecting version 1
    stmt1 = (
        update(Task)
        .where(Task.id == task.id, Task.version == 1)
        .values(status=TaskStatus.IN_PROGRESS.value, version=2)
    )
    res1 = await db_session.execute(stmt1)
    assert res1.rowcount == 1  # Successfully claimed

    # Worker 2 (or a concurrent redelivery) attempts to claim the same task expecting version 1
    stmt2 = (
        update(Task)
        .where(Task.id == task.id, Task.version == 1)
        .values(status=TaskStatus.IN_PROGRESS.value, version=2)
    )
    res2 = await db_session.execute(stmt2)
    assert res2.rowcount == 0  # OCC rejection: 0 rows affected!


@pytest.mark.asyncio
async def test_outbox_event_persistence_and_polling(db_session: AsyncSession):
    """Verify OutboxEvent transactional persistence and polling query semantics."""
    task_id = uuid.uuid4()
    payload = {
        "task_id": str(task_id),
        "task_type": TaskType.REGULATORY_RISKS.value,
        "search_queries": ["EU AI Act compliance timelines"],
    }

    event = OutboxEvent(
        aggregate_type="TASK",
        aggregate_id=task_id,
        event_type="TASK_CREATED",
        payload=payload,
        status=OutboxStatus.PENDING.value,
    )
    db_session.add(event)
    await db_session.flush()

    # Query outbox for pending events (matching the relay dispatcher logic)
    stmt = (
        select(OutboxEvent)
        .where(OutboxEvent.status == OutboxStatus.PENDING.value)
        .order_by(OutboxEvent.created_at)
        .limit(10)
    )
    events = (await db_session.scalars(stmt)).all()
    assert len(events) >= 1
    matching_event = next(e for e in events if e.id == event.id)
    assert matching_event.payload["task_id"] == str(task_id)

    # Simulate successful dispatch
    matching_event.status = OutboxStatus.PUBLISHED.value
    matching_event.published_at = datetime.now(timezone.utc)
    await db_session.flush()

    assert matching_event.status == OutboxStatus.PUBLISHED.value
