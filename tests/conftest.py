"""
Pytest configuration and global fixtures for Stratify AI test suite.
"""

import pytest_asyncio
from sqlalchemy import text

from backend.app.db.session import async_engine


@pytest_asyncio.fixture(autouse=True)
async def clean_database_tables():
    """
    Autouse fixture that runs before each test to ensure a clean database state.
    Truncates all tables with CASCADE so tests are completely isolated.
    """
    async with async_engine.begin() as conn:
        await conn.execute(text("TRUNCATE TABLE jobs, outbox_events CASCADE;"))
    yield
