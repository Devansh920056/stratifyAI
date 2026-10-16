"""
Transactional Outbox Relay Service.
Polls PENDING outbox events with FOR UPDATE SKIP LOCKED, publishes them to
RabbitMQ with Publisher Confirms, and transitions them to PUBLISHED.
"""

import asyncio
import logging
import uuid
from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.broker.connection import get_broker_channel
from backend.app.broker.publisher import ReliableTaskPublisher
from backend.app.broker.schemas import TaskMessage
from backend.app.core.config import get_settings
from backend.app.db.base import utc_now
from backend.app.db.session import AsyncSessionLocal
from backend.app.models.enums import OutboxStatus, TaskStatus
from backend.app.models.outbox import OutboxEvent
from backend.app.models.task import Task

logger = logging.getLogger("stratify.services.outbox_relay")
settings = get_settings()


class OutboxRelayService:
    @staticmethod
    async def relay_batch(db: AsyncSession, limit: int = 50) -> int:
        """
        Polls a batch of pending events using SELECT ... FOR UPDATE SKIP LOCKED,
        publishes them to RabbitMQ with publisher confirms, and marks them PUBLISHED.
        Returns the number of successfully relayed events.
        """
        stmt = (
            select(OutboxEvent)
            .where(OutboxEvent.status == OutboxStatus.PENDING.value)
            .order_by(OutboxEvent.created_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        result = await db.scalars(stmt)
        events = list(result.all())

        if not events:
            return 0

        logger.info(f"Outbox relay claimed {len(events)} pending events for dispatch.")
        dispatched_count = 0

        # Open publisher-confirms channel to RabbitMQ
        async with get_broker_channel(publisher_confirms=True, ensure_topology=True) as channel:
            for event in events:
                try:
                    payload = event.payload
                    task_msg = TaskMessage(
                        task_id=uuid.UUID(payload["task_id"]),
                        job_id=uuid.UUID(payload["job_id"]),
                        task_type=payload["task_type"],
                        search_queries=payload["search_queries"],
                        version=payload.get("version", 1),
                        retry_count=event.retry_count,
                    )

                    # Publish with publisher confirmation
                    await ReliableTaskPublisher.publish_task(
                        channel=channel,
                        task_message=task_msg,
                    )

                    # Update outbox event state
                    event.status = OutboxStatus.PUBLISHED.value
                    event.published_at = utc_now()

                    # Update corresponding task state to DISPATCHED
                    await db.execute(
                        update(Task)
                        .where(Task.id == task_msg.task_id)
                        .values(status=TaskStatus.DISPATCHED.value)
                    )

                    dispatched_count += 1
                except Exception as exc:
                    logger.error(f"Failed to publish outbox event {event.id}: {str(exc)}")
                    event.retry_count += 1
                    # Stop batch on broker error to maintain order and avoid spamming broken broker
                    break

        await db.flush()
        return dispatched_count

    @classmethod
    async def run_relay_loop(
        cls,
        poll_interval: Optional[float] = None,
        stop_event: Optional[asyncio.Event] = None,
    ):
        """
        Continuous background relay runner loop.
        """
        interval = poll_interval or settings.OUTBOX_POLL_INTERVAL_SECONDS
        logger.info(f"Starting Outbox Relay runner loop (poll interval: {interval}s)...")

        while stop_event is None or not stop_event.is_set():
            try:
                async with AsyncSessionLocal() as session:
                    async with session.begin():
                        dispatched = await cls.relay_batch(db=session)
                        if dispatched > 0:
                            logger.info(f"Relayed {dispatched} tasks to RabbitMQ.")
            except Exception as exc:
                logger.warning(f"Outbox relay loop encounter: {str(exc)}. Retrying in {interval}s...")

            await asyncio.sleep(interval)
