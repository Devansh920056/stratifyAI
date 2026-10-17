"""
Pytest configuration and global fixtures for Stratify AI test suite.
"""

import pytest_asyncio
from sqlalchemy import text

from backend.app.db.session import async_engine


@pytest_asyncio.fixture(autouse=True)
async def clean_database_tables():
    """
    Autouse fixture that runs before each test to ensure a clean database and broker state.
    Truncates all tables with CASCADE and purges test queues.
    """
    async with async_engine.begin() as conn:
        await conn.execute(text("TRUNCATE TABLE jobs, outbox_events CASCADE;"))

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

    yield
