"""
Reliable Task Publisher with Publisher Confirms and Persistent Delivery.
"""

import logging

import aio_pika
from aio_pika import DeliveryMode, Message

from backend.app.broker.constants import TASKS_EXCHANGE
from backend.app.broker.schemas import TaskMessage

logger = logging.getLogger("stratify.broker.publisher")


class ReliableTaskPublisher:
    """
    Publishes task messages to RabbitMQ with:
    - Publisher Confirms (ensures broker accepted message before returning)
    - Persistent Delivery Mode (forces disk fsync for durable storage)
    - Traceable metadata headers
    """

    @staticmethod
    async def publish_task(
        channel: aio_pika.abc.AbstractChannel,
        task_message: TaskMessage,
    ) -> bool:
        """
        Publishes a single task message to the topic exchange.
        Routing key: tasks.{task_type_in_lowercase}
        """
        exchange = await channel.get_exchange(TASKS_EXCHANGE, ensure=False)

        routing_key = f"tasks.{task_message.task_type.lower()}"
        body = task_message.model_dump_json().encode("utf-8")

        message = Message(
            body=body,
            delivery_mode=DeliveryMode.PERSISTENT,
            content_type="application/json",
            content_encoding="utf-8",
            message_id=str(task_message.task_id),
            correlation_id=str(task_message.job_id),
            headers=task_message.to_amqp_headers(),
        )

        # In publisher confirms mode, publish() waits for broker ACK confirmation
        await exchange.publish(
            message=message,
            routing_key=routing_key,
            mandatory=True,
        )

        logger.info(
            f"Published task {task_message.task_id} [{task_message.task_type}] "
            f"to {TASKS_EXCHANGE} with routing key '{routing_key}'"
        )
        return True
