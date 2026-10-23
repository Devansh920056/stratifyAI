"""
Stage 4 RabbitMQ & Reliable Dispatch Integration Tests.
Verifies:
1. AMQP topology declaration (Exchanges, Queues, DLX, DLQ, Bindings).
2. Reliable publishing with Publisher Confirms and Persistent Delivery (mode=2).
3. Transactional Outbox atomic dispatch and task state transition (PENDING -> DISPATCHED).
4. Dead Letter Queue (DLQ) routing upon rejection (requeue=False).
5. Message redelivery detection (redelivered=True flag).
6. Broker outage resilience (outbox events remain safely PENDING in DB when broker is unreachable).
"""

from contextlib import suppress
import json
import uuid

import aio_pika
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.broker.connection import get_broker_channel
from backend.app.broker.constants import (
    DEAD_LETTER_EXCHANGE,
    DEAD_LETTER_QUEUE,
    DEAD_LETTER_ROUTING_KEY,
    TASKS_EXCHANGE,
    TASKS_QUEUE,
)
from backend.app.broker.publisher import ReliableTaskPublisher
from backend.app.broker.schemas import TaskMessage
from backend.app.broker.topology import setup_broker_topology
from backend.app.core.config import get_settings
from backend.app.db.session import AsyncSessionLocal
from backend.app.models.enums import OutboxStatus, TaskStatus, TaskType
from backend.app.models.outbox import OutboxEvent
from backend.app.models.task import Task
from backend.app.schemas.job import JobCreateRequest
from backend.app.services.job_service import JobService
from backend.app.services.outbox_relay import OutboxRelayService

settings = get_settings()


@pytest_asyncio.fixture
async def broker_channel():
    """Provides a RabbitMQ robust channel with topology initialized, and purges test queues after."""
    async with get_broker_channel(
        publisher_confirms=True, ensure_topology=True
    ) as channel:
        yield channel
        # Cleanup: purge test queues
        with suppress(Exception):
            tasks_queue = await channel.get_queue(TASKS_QUEUE, ensure=False)
            await tasks_queue.purge()
            dlq = await channel.get_queue(DEAD_LETTER_QUEUE, ensure=False)
            await dlq.purge()


@pytest_asyncio.fixture
async def db_session() -> AsyncSession:
    """Fixture providing an async database session."""
    async with AsyncSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.mark.asyncio
async def test_topology_declaration(broker_channel):
    """Verify that exchanges, queues, and dead-letter configurations exist in RabbitMQ."""
    topology = await setup_broker_topology(broker_channel)
    assert topology["tasks_exchange"].name == TASKS_EXCHANGE
    assert topology["tasks_queue"].name == TASKS_QUEUE
    assert topology["dlx"].name == DEAD_LETTER_EXCHANGE
    assert topology["dlq"].name == DEAD_LETTER_QUEUE

    # Verify queue arguments for dead lettering
    queue_declaration = await broker_channel.get_queue(TASKS_QUEUE)
    assert (
        queue_declaration.arguments.get("x-dead-letter-exchange")
        == DEAD_LETTER_EXCHANGE
    )
    assert (
        queue_declaration.arguments.get("x-dead-letter-routing-key")
        == DEAD_LETTER_ROUTING_KEY
    )


@pytest.mark.asyncio
async def test_reliable_publishing_and_consumption(broker_channel):
    """
    Verify Publisher Confirms, Persistent Delivery Mode (mode=2),
    and message header propagation.
    """
    task_id = uuid.uuid4()
    job_id = uuid.uuid4()

    task_msg = TaskMessage(
        task_id=task_id,
        job_id=job_id,
        task_type=TaskType.MARKET_OVERVIEW.value,
        search_queries=["commercial space launch size 2026"],
        version=1,
        retry_count=0,
    )

    # 1. Publish with publisher confirmation
    published = await ReliableTaskPublisher.publish_task(
        channel=broker_channel,
        task_message=task_msg,
    )
    assert published is True

    # 2. Consume from the durable queue
    queue = await broker_channel.get_queue(TASKS_QUEUE)
    incoming_message = await queue.get(timeout=5.0)
    assert incoming_message is not None

    # Verify message durability and headers
    assert incoming_message.delivery_mode == aio_pika.DeliveryMode.PERSISTENT
    assert incoming_message.message_id == str(task_id)
    assert incoming_message.correlation_id == str(job_id)
    assert incoming_message.headers.get("x-task-id") == str(task_id)
    assert incoming_message.headers.get("x-retry-count") == 0

    # Verify payload
    payload = json.loads(incoming_message.body.decode("utf-8"))
    assert payload["task_id"] == str(task_id)
    assert payload["task_type"] == TaskType.MARKET_OVERVIEW.value

    # Manual Ack
    await incoming_message.ack()


@pytest.mark.asyncio
async def test_outbox_atomic_dispatch(broker_channel):
    """
    CRITICAL DISTRIBUTED TEST:
    Verify that OutboxRelayService claims PENDING events,
    publishes them to RabbitMQ, marks them PUBLISHED, and updates Tasks to DISPATCHED.
    """
    async with AsyncSessionLocal() as session:
        # Create Job which inserts 4 tasks and 4 outbox events atomically
        request = JobCreateRequest(
            research_question="Assess maritime hydrogen propulsion adoption",
            target_market="Green Shipping",
            geography="Europe",
            time_range="2025-2030",
            focus_areas=["Fuel Cell Systems", "Bunkering Ports"],
        )
        job = await JobService.create_job(db=session, request=request)
        await session.commit()

        # Run outbox relay to dispatch the 4 events
        dispatched_count = await OutboxRelayService.relay_batch(db=session, limit=10)
        await session.commit()
        assert dispatched_count == 4

        # Verify OutboxEvent statuses are now PUBLISHED
        outbox_stmt = select(OutboxEvent).where(
            OutboxEvent.aggregate_id.in_([t.id for t in job.tasks])
        )
        outbox_events = (await session.scalars(outbox_stmt)).all()
        assert len(outbox_events) == 4
        for ev in outbox_events:
            assert ev.status == OutboxStatus.PUBLISHED.value
            assert ev.published_at is not None

        # Verify Task statuses are now DISPATCHED
        tasks_stmt = select(Task).where(Task.job_id == job.id)
        tasks = (await session.scalars(tasks_stmt)).all()
        assert len(tasks) == 4
        for t in tasks:
            assert t.status == TaskStatus.DISPATCHED.value

    # Verify all 4 messages arrived in RabbitMQ
    queue = await broker_channel.get_queue(TASKS_QUEUE)
    for _ in range(4):
        msg = await queue.get(timeout=5.0)
        assert msg is not None
        await msg.ack()


@pytest.mark.asyncio
async def test_dead_letter_queue_routing(broker_channel):
    """
    Verify Poison Message handling:
    When a worker rejects a message with requeue=False, RabbitMQ must route it to stratify.tasks.dlq.
    """
    task_id = uuid.uuid4()
    job_id = uuid.uuid4()

    task_msg = TaskMessage(
        task_id=task_id,
        job_id=job_id,
        task_type="POISON_TASK",
        search_queries=["unparseable syntax"],
    )

    await ReliableTaskPublisher.publish_task(broker_channel, task_msg)

    # Dequeue from primary queue and REJECT with requeue=False
    tasks_queue = await broker_channel.get_queue(TASKS_QUEUE)
    incoming = await tasks_queue.get(timeout=5.0)
    assert incoming is not None

    # Reject without requeue triggers dead-lettering
    await incoming.reject(requeue=False)

    # Now verify the message arrived in stratify.tasks.dlq
    dlq = await broker_channel.get_queue(DEAD_LETTER_QUEUE)
    dead_msg = await dlq.get(timeout=5.0)
    assert dead_msg is not None
    assert dead_msg.message_id == str(task_id)

    # Inspect RabbitMQ x-death headers
    assert "x-death" in dead_msg.headers
    x_death = dead_msg.headers["x-death"]
    assert len(x_death) >= 1
    assert x_death[0]["queue"] == TASKS_QUEUE
    assert x_death[0]["reason"] == "rejected"

    await dead_msg.ack()


@pytest.mark.asyncio
async def test_redelivery_flag_detection(broker_channel):
    """
    Verify At-Least-Once redelivery:
    When a worker rejects with requeue=True (simulating crash before ack),
    the next delivery has message.redelivered == True.
    """
    task_id = uuid.uuid4()
    job_id = uuid.uuid4()

    task_msg = TaskMessage(
        task_id=task_id,
        job_id=job_id,
        task_type=TaskType.MARKET_OVERVIEW.value,
        search_queries=["redelivery test query"],
    )

    await ReliableTaskPublisher.publish_task(broker_channel, task_msg)

    queue = await broker_channel.get_queue(TASKS_QUEUE)
    first_delivery = await queue.get(timeout=5.0)
    assert first_delivery is not None
    assert first_delivery.redelivered is False

    # Simulate worker crash: reject with requeue=True
    await first_delivery.reject(requeue=True)

    # Second delivery arrives
    second_delivery = await queue.get(timeout=5.0)
    assert second_delivery is not None
    assert second_delivery.message_id == str(task_id)
    assert second_delivery.redelivered is True

    await second_delivery.ack()


@pytest.mark.asyncio
async def test_broker_outage_resilience(monkeypatch):
    """
    CRITICAL RELIABILITY TEST:
    Verify that if RabbitMQ is unreachable or fails during dispatch:
    1. OutboxRelayService catches the outage, returns 0, and leaves events safely PENDING in DB.
    2. Zero tasks are lost or prematurely marked as published.
    3. Once the broker recovers, the next relay execution successfully dispatches the pending events.
    """
    from contextlib import asynccontextmanager

    async with AsyncSessionLocal() as session:
        # Create a Job with 4 tasks and 4 outbox events
        request = JobCreateRequest(
            research_question="Resilience test inquiry for broker outage",
            target_market="Distributed Systems",
            geography="Global",
        )
        job = await JobService.create_job(db=session, request=request)
        await session.commit()

        # Check initial state: 4 events in PENDING
        stmt = select(OutboxEvent).where(
            OutboxEvent.aggregate_id.in_([t.id for t in job.tasks])
        )
        events_before = (await session.scalars(stmt)).all()
        assert len(events_before) == 4
        assert all(e.status == OutboxStatus.PENDING.value for e in events_before)

        # 1. SIMULATE BROKER OUTAGE
        @asynccontextmanager
        async def mock_broken_channel(*args, **kwargs):
            raise ConnectionRefusedError(
                "[Errno 61] Connection refused: RabbitMQ broker is offline"
            )
            yield  # pragma: no cover

        monkeypatch.setattr(
            "backend.app.services.outbox_relay.get_broker_channel", mock_broken_channel
        )

        # Attempt relay while broker is down
        dispatched_during_outage = await OutboxRelayService.relay_batch(db=session)
        assert dispatched_during_outage == 0

        # Verify that all 4 events remain safely in PENDING status in the database
        events_during = (await session.scalars(stmt)).all()
        assert len(events_during) == 4
        assert all(e.status == OutboxStatus.PENDING.value for e in events_during)
        assert all(e.published_at is None for e in events_during)

        # 2. SIMULATE BROKER RECOVERY
        monkeypatch.undo()

        # Re-run relay now that broker is healthy
        dispatched_after_recovery = await OutboxRelayService.relay_batch(db=session)
        await session.commit()
        assert dispatched_after_recovery == 4

        # Verify that all 4 events are now marked PUBLISHED and tasks are DISPATCHED
        events_after = (await session.scalars(stmt)).all()
        assert len(events_after) == 4
        assert all(e.status == OutboxStatus.PUBLISHED.value for e in events_after)
        assert all(e.published_at is not None for e in events_after)

        tasks_stmt = select(Task).where(Task.job_id == job.id)
        tasks_after = (await session.scalars(tasks_stmt)).all()
        assert all(t.status == TaskStatus.DISPATCHED.value for t in tasks_after)
