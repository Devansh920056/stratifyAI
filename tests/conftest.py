"""
Pytest configuration and global fixtures for Stratify AI test suite.
"""

import pytest_asyncio
from sqlalchemy import text

from backend.app.db.session import async_engine


async def _purge_broker_queues():
    """Purge all test queues in RabbitMQ, suppressing any connectivity errors."""
    from contextlib import suppress

    with suppress(Exception):
        from backend.app.broker.connection import get_broker_channel
        from backend.app.broker.constants import DEAD_LETTER_QUEUE, TASKS_QUEUE

        async with get_broker_channel(
            publisher_confirms=False, ensure_topology=True
        ) as channel:
            tq = await channel.get_queue(TASKS_QUEUE, ensure=False)
            await tq.purge()
            dlq = await channel.get_queue(DEAD_LETTER_QUEUE, ensure=False)
            await dlq.purge()


@pytest_asyncio.fixture(autouse=True)
async def clean_database_tables():
    """
    Autouse fixture that purges both the database and RabbitMQ queues
    BEFORE each test (setup) and AFTER each test (teardown).
    This eliminates ordering flakiness caused by in-flight worker messages
    from previous test cases contaminating the next test's queue state.
    """
    # --- SETUP: clean slate before test ---
    async with async_engine.begin() as conn:
        await conn.execute(text("TRUNCATE TABLE jobs, outbox_events CASCADE;"))
    await _purge_broker_queues()

    yield

    # --- TEARDOWN: purge stale messages left by background workers ---
    await _purge_broker_queues()


@pytest_asyncio.fixture
async def api_client():
    """Async HTTP test client bound directly to the FastAPI ASGI application."""
    import httpx

    from backend.app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
