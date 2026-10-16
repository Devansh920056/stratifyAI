"""
RabbitMQ Topology Declaration and Verification.
Sets up durable exchanges, durable queues, bindings, and dead-letter routing.
"""

import logging
import aio_pika
from aio_pika import ExchangeType
from backend.app.broker.constants import (
    DEAD_LETTER_EXCHANGE,
    DEAD_LETTER_QUEUE,
    DEAD_LETTER_ROUTING_KEY,
    TASKS_EXCHANGE,
    TASKS_QUEUE,
    TASKS_ROUTING_KEY_ALL,
)

logger = logging.getLogger("stratify.broker.topology")


async def setup_broker_topology(channel: aio_pika.abc.AbstractChannel) -> dict:
    """
    Idempotently declares exchanges, queues, bindings, and DLQ configurations.
    Returns a dictionary of declared exchange and queue objects.
    """
    logger.info("Declaring RabbitMQ topology...")

    # 1. Declare Dead Letter Exchange (DLX)
    dlx = await channel.declare_exchange(
        name=DEAD_LETTER_EXCHANGE,
        type=ExchangeType.DIRECT,
        durable=True,
    )

    # 2. Declare Dead Letter Queue (DLQ)
    dlq = await channel.declare_queue(
        name=DEAD_LETTER_QUEUE,
        durable=True,
    )

    # 3. Bind DLQ to DLX
    await dlq.bind(exchange=dlx, routing_key=DEAD_LETTER_ROUTING_KEY)

    # 4. Declare Primary Tasks Topic Exchange
    tasks_exchange = await channel.declare_exchange(
        name=TASKS_EXCHANGE,
        type=ExchangeType.TOPIC,
        durable=True,
    )

    # 5. Declare Primary Tasks Work Queue with Dead-Letter Arguments
    # When a message in tasks_queue is rejected with requeue=False (or TTL expires),
    # RabbitMQ automatically forwards it to the DLX.
    tasks_queue = await channel.declare_queue(
        name=TASKS_QUEUE,
        durable=True,
        arguments={
            "x-dead-letter-exchange": DEAD_LETTER_EXCHANGE,
            "x-dead-letter-routing-key": DEAD_LETTER_ROUTING_KEY,
        },
    )

    # 6. Bind Primary Queue to Primary Exchange (routing key: tasks.*)
    await tasks_queue.bind(exchange=tasks_exchange, routing_key=TASKS_ROUTING_KEY_ALL)

    logger.info("RabbitMQ topology asserted successfully.")
    return {
        "dlx": dlx,
        "dlq": dlq,
        "tasks_exchange": tasks_exchange,
        "tasks_queue": tasks_queue,
    }
