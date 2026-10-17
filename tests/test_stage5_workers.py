"""
Stage 5 Independent Workers Integration Tests.
Verifies:
1. End-to-end task processing by worker processor (idempotency, evidence, results).
2. Idempotency under duplicate message delivery (no duplicate DB rows, no exceptions).
3. Concurrent processing with Two Independent Workers consuming from RabbitMQ.
4. Terminal task failure and dead-letter routing when max retries are exceeded.
"""

import asyncio
import uuid
from contextlib import suppress

import pytest
import pytest_asyncio
from sqlalchemy import select

from backend.app.broker.connection import get_broker_channel
from backend.app.broker.constants import DEAD_LETTER_QUEUE, TASKS_QUEUE
from backend.app.broker.schemas import TaskMessage
from backend.app.db.session import AsyncSessionLocal
from backend.app.models.enums import TaskStatus, TaskType
from backend.app.models.evidence import Evidence
from backend.app.models.job import Job
from backend.app.models.task import Task
from backend.app.models.task_result import TaskResult
from backend.app.schemas.job import JobCreateRequest
from backend.app.services.job_service import JobService
from backend.app.services.outbox_relay import OutboxRelayService
from workers.consumer import WorkerConsumer
from workers.processor import TaskProcessor


@pytest_asyncio.fixture
async def broker_channel():
    """Provides a RabbitMQ robust channel with topology initialized, and purges test queues before and after."""
    async with get_broker_channel(
        publisher_confirms=True, ensure_topology=True
    ) as channel:
        with suppress(Exception):
            tasks_queue = await channel.get_queue(TASKS_QUEUE, ensure=False)
            await tasks_queue.purge()
            dlq = await channel.get_queue(DEAD_LETTER_QUEUE, ensure=False)
            await dlq.purge()

        yield channel

        with suppress(Exception):
            tasks_queue = await channel.get_queue(TASKS_QUEUE, ensure=False)
            await tasks_queue.purge()
            dlq = await channel.get_queue(DEAD_LETTER_QUEUE, ensure=False)
            await dlq.purge()


@pytest.mark.asyncio
async def test_worker_task_processor_success():
    """
    Verify TaskProcessor successfully claims task, executes mock research,
    and commits Evidence and TaskResult to PostgreSQL.
    """
    async with AsyncSessionLocal() as session:
        job = Job(
            research_question="Next-generation geothermal energy drilling technology",
            target_market="Renewable Energy",
            geography="North America",
        )
        session.add(job)
        await session.flush()

        task = Task(
            job_id=job.id,
            task_type=TaskType.MARKET_OVERVIEW.value,
            search_queries=["superhot deep geothermal drilling cost"],
            status=TaskStatus.DISPATCHED.value,
            version=1,
        )
        session.add(task)
        await session.commit()

        task_msg = TaskMessage(
            task_id=task.id,
            job_id=job.id,
            task_type=task.task_type,
            search_queries=task.search_queries,
            version=task.version,
        )

        success, reason = await TaskProcessor.process_task(
            session=session, task_message=task_msg
        )
        assert success is True
        assert reason == "completed"

        # Verify task state in database
        updated_task = await session.scalar(select(Task).where(Task.id == task.id))
        assert updated_task.status == TaskStatus.COMPLETED.value
        assert updated_task.started_at is not None
        assert updated_task.completed_at is not None
        assert updated_task.attempt_count == 1
        assert updated_task.version == 2

        # Verify evidence persisted
        evidence_items = (
            await session.scalars(select(Evidence).where(Evidence.task_id == task.id))
        ).all()
        assert len(evidence_items) >= 1
        assert evidence_items[0].provider_name in ("mock", "duckduckgo")
        assert (
            "internal" in evidence_items[0].source_url
            or "http" in evidence_items[0].source_url
        )

        # Verify task result persisted
        result = await session.scalar(
            select(TaskResult).where(TaskResult.task_id == task.id)
        )
        assert result is not None
        assert result.confidence_score > 0.8
        assert result.model_name.startswith(("mock-grounder", "stratify-grounder"))


@pytest.mark.asyncio
async def test_worker_idempotency_on_redelivery():
    """
    CRITICAL DISTRIBUTED TEST:
    Verify that if RabbitMQ redelivers the same message,
    TaskProcessor detects the existing TaskResult, skips reprocessing,
    and returns already_completed without throwing IntegrityError.
    """
    async with AsyncSessionLocal() as session:
        job = Job(
            research_question="Synthetic diamond wafer semiconductor applications",
            target_market="Semiconductors",
            geography="Global",
        )
        session.add(job)
        await session.flush()

        task = Task(
            job_id=job.id,
            task_type=TaskType.COMPETITOR_ANALYSIS.value,
            search_queries=["diamond substrate chip cooling"],
            status=TaskStatus.DISPATCHED.value,
            version=1,
        )
        session.add(task)
        await session.commit()

        task_msg = TaskMessage(
            task_id=task.id,
            job_id=job.id,
            task_type=task.task_type,
            search_queries=task.search_queries,
            version=task.version,
        )

        # First delivery -> processes to completion
        success1, reason1 = await TaskProcessor.process_task(
            session=session, task_message=task_msg
        )
        assert success1 is True
        assert reason1 == "completed"

        # Second delivery (simulating broker redelivery after unacknowledged timeout)
        success2, reason2 = await TaskProcessor.process_task(
            session=session, task_message=task_msg
        )
        assert success2 is True
        assert reason2 == "already_completed"

        # Verify exactly one result exists in PostgreSQL
        results = (
            await session.scalars(
                select(TaskResult).where(TaskResult.task_id == task.id)
            )
        ).all()
        assert len(results) == 1


@pytest.mark.asyncio
async def test_two_workers_concurrent_processing(broker_channel):
    """
    CRITICAL MULTI-WORKER TEST:
    Verify that TWO independently running workers (worker-alpha and worker-beta)
    concurrently consume and complete separate tasks from the shared queue.
    """
    async with AsyncSessionLocal() as session:
        # Create Job with 4 tasks
        request = JobCreateRequest(
            research_question="Small modular nuclear reactor commercial deployment",
            target_market="Nuclear Energy",
            geography="North America",
            time_range="2026-2035",
            focus_areas=["NRC Licensing", "Microreactors"],
        )
        job = await JobService.create_job(db=session, request=request)
        await session.commit()

        # Dispatch all 4 tasks to RabbitMQ via outbox relay
        dispatched = await OutboxRelayService.relay_batch(db=session, limit=10)
        await session.commit()
        assert dispatched == 4

    # Spin up two distinct workers with QoS prefetch_count=1
    stop_event = asyncio.Event()
    worker_alpha = WorkerConsumer(worker_id="worker-alpha", prefetch_count=1)
    worker_beta = WorkerConsumer(worker_id="worker-beta", prefetch_count=1)

    task_alpha = asyncio.create_task(worker_alpha.start(stop_event=stop_event))
    task_beta = asyncio.create_task(worker_beta.start(stop_event=stop_event))

    # Poll PostgreSQL until all 4 tasks are COMPLETED (or timeout after 15 seconds)
    all_completed = False
    for _ in range(30):
        await asyncio.sleep(0.5)
        async with AsyncSessionLocal() as session:
            tasks_stmt = select(Task).where(Task.job_id == job.id)
            tasks = (await session.scalars(tasks_stmt)).all()
            completed_count = sum(
                1 for t in tasks if t.status == TaskStatus.COMPLETED.value
            )
            if completed_count == 4:
                all_completed = True
                break

    # Stop both workers gracefully
    stop_event.set()
    await asyncio.gather(task_alpha, task_beta, return_exceptions=True)

    assert all_completed is True, (
        "All 4 tasks should have been processed to completion by the 2 workers"
    )

    # Verify all 4 tasks have results and evidence
    async with AsyncSessionLocal() as session:
        tasks = (await session.scalars(select(Task).where(Task.job_id == job.id))).all()
        assert len(tasks) == 4
        for t in tasks:
            assert t.status == TaskStatus.COMPLETED.value
            assert t.result is not None
            assert len(t.evidence) >= 1


@pytest.mark.asyncio
async def test_poison_task_routes_to_dlq_on_max_retries():
    """
    Verify that when a task fails repeatedly and reaches MAX_RETRIES (3),
    TaskProcessor marks it FAILED in the DB and returns 'dead_letter',
    instructing the consumer to route it to the Dead Letter Queue.
    """
    task_id = uuid.uuid4()
    job_id = uuid.uuid4()

    async with AsyncSessionLocal() as session:
        job = Job(
            id=job_id,
            research_question="Quantum gravity propulsion systems",
            target_market="Theoretical Physics",
            geography="Global",
        )
        session.add(job)

        # Task already at attempt_count 3 (max_attempts = 3)
        task = Task(
            id=task_id,
            job_id=job_id,
            task_type="UNSUPPORTED_TYPE",
            search_queries=["syntax error"],
            status=TaskStatus.IN_PROGRESS.value,
            attempt_count=3,
            max_attempts=3,
            version=3,
        )
        session.add(task)
        await session.commit()

        task_msg = TaskMessage(
            task_id=task_id,
            job_id=job_id,
            task_type="UNSUPPORTED_TYPE",
            search_queries=["syntax error"],
            version=3,
        )

        success, reason = await TaskProcessor._handle_failure(
            task_message=task_msg,
            error_msg="Forced unrecoverable provider timeout",
        )
        assert success is False
        assert reason == "dead_letter"

        # Check DB state - refresh since _handle_failure committed in an independent session
        await session.refresh(task)
        assert task.status == TaskStatus.FAILED.value
        assert "Exceeded max attempts" in task.error_details
