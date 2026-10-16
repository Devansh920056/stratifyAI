"""
RabbitMQ Asynchronous Connection & Channel Factory using aio-pika.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional
import aio_pika
from aio_pika.abc import AbstractRobustChannel, AbstractRobustConnection
from backend.app.core.config import get_settings
from backend.app.broker.topology import setup_broker_topology

settings = get_settings()


async def get_broker_connection() -> AbstractRobustConnection:
    """
    Creates a robust, self-healing connection to RabbitMQ.
    Automatically reconnects upon transient network drops.
    """
    return await aio_pika.connect_robust(
        url=settings.RABBITMQ_URL,
        timeout=10.0,
    )


@asynccontextmanager
async def get_broker_channel(
    publisher_confirms: bool = False,
    ensure_topology: bool = True,
) -> AsyncGenerator[AbstractRobustChannel, None]:
    """
    Async context manager providing a RabbitMQ channel.
    Optionally enables publisher confirms and ensures exchange/queue topology.
    """
    connection = await get_broker_connection()
    try:
        channel = await connection.channel(publisher_confirms=publisher_confirms)
        if ensure_topology:
            await setup_broker_topology(channel)
        yield channel
        await channel.close()
    finally:
        await connection.close()
