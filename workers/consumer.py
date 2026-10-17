"""
Asynchronous RabbitMQ Worker Consumer.
Manages queue subscription, bounded QoS concurrency (prefetch), manual acknowledgments,
and safe ACK ordering after database persistence.
"""

import asyncio
import logging

import aio_pika
from aio_pika.abc import AbstractIncomingMessage

from backend.app.broker.connection import get_broker_connection
from backend.app.broker.constants import TASKS_QUEUE
from backend.app.broker.schemas import TaskMessage
from backend.app.broker.topology import setup_broker_topology
from backend.app.core.config import get_settings
from backend.app.db.session import AsyncSessionLocal
from workers.processor import TaskProcessor

logger = logging.getLogger("stratify.workers.consumer")
settings = get_settings()


from backend.app.providers.search.base import SearchProvider


class WorkerConsumer:
    """
    Subscribes to RabbitMQ tasks queue and processes messages with bounded concurrency.
    """

    def __init__(
        self,
        worker_id: str = "worker-1",
        prefetch_count: int | None = None,
        search_provider: SearchProvider | None = None,
    ):
        self.worker_id = worker_id
        self.prefetch_count = prefetch_count or settings.WORKER_CONCURRENCY
        self.search_provider = search_provider
        self._connection: aio_pika.RobustConnection | None = None
        self._channel: aio_pika.RobustChannel | None = None
        self._consumer_tag: str | None = None
        self._is_running = False

    async def start(self, stop_event: asyncio.Event | None = None):
        """
        Starts the worker consumption loop with manual acknowledgments.
        """
        self._connection = await get_broker_connection()
        self._channel = await self._connection.channel()

        # Ensure topology exists
        await setup_broker_topology(self._channel)

        # Set QoS prefetch count to enforce bounded concurrency and fair distribution
        await self._channel.set_qos(prefetch_count=self.prefetch_count)
        logger.info(
            f"[{self.worker_id}] Initialized with QoS prefetch_count={self.prefetch_count}"
        )

        queue = await self._channel.get_queue(TASKS_QUEUE, ensure=False)

        self._is_running = True
        logger.info(f"[{self.worker_id}] Listening for tasks on '{TASKS_QUEUE}'...")

        # Start consuming messages with auto_ack=False
        self._consumer_tag = await queue.consume(
            self._on_message,
            no_ack=False,
        )

        if stop_event:
            await stop_event.wait()
            await self.stop()

    async def _on_message(self, message: AbstractIncomingMessage):
        """
        Processes a dequeued message and issues manual ACK strictly after DB persistence.
        """
        logger.info(
            f"[{self.worker_id}] Received message {message.message_id} (delivery_tag: {message.delivery_tag})"
        )

        try:
            # Parse and validate task message schema
            task_msg = TaskMessage.model_validate_json(message.body.decode("utf-8"))
        except Exception as parse_err:  # noqa: BLE001
            logger.critical(
                f"[{self.worker_id}] Poison message payload unparseable: {parse_err!s}. "
                f"Rejecting to Dead Letter Queue."
            )
            await message.reject(requeue=False)
            return

        async with AsyncSessionLocal() as session:
            try:
                success, reason = await TaskProcessor.process_task(
                    session=session,
                    task_message=task_msg,
                    search_provider=self.search_provider,
                )

                if success:
                    # SAFE ACKNOWLEDGMENT ORDERING:
                    # Acknowledge message only AFTER DB transaction has committed
                    await message.ack()
                    logger.info(
                        f"[{self.worker_id}] Message {message.message_id} ACKed. Reason: {reason}"
                    )
                elif reason == "retry":
                    # Bounded retry: return to queue for backoff/retry
                    await message.reject(requeue=True)
                    logger.warning(
                        f"[{self.worker_id}] Message {message.message_id} REJECTED with requeue=True (retry)."
                    )
                else:  # dead_letter
                    # Terminal failure: route directly to DLQ
                    await message.reject(requeue=False)
                    logger.error(
                        f"[{self.worker_id}] Message {message.message_id} REJECTED to DLQ (max retries reached)."
                    )

            except Exception:
                logger.exception(
                    f"[{self.worker_id}] Unhandled error processing {message.message_id}. Requeueing message."
                )
                await message.reject(requeue=True)

    async def stop(self):
        """
        Executes graceful shutdown: cancels queue consumer and closes channels.
        """
        if not self._is_running:
            return

        logger.info(f"[{self.worker_id}] Shutting down gracefully...")
        self._is_running = False

        if self._channel and self._consumer_tag:
            from contextlib import suppress

            with suppress(Exception):
                await self._channel.basic_cancel(self._consumer_tag)
                logger.info(
                    f"[{self.worker_id}] Consumer cancelled. Waiting for in-flight tasks..."
                )

        if self._channel and not self._channel.is_closed:
            await self._channel.close()

        if self._connection and not self._connection.is_closed:
            await self._connection.close()

        logger.info(f"[{self.worker_id}] Worker shutdown complete.")
