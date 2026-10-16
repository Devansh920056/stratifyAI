"""
Async Database Session & Engine Management using SQLAlchemy 2.x and Psycopg 3.
"""

from typing import AsyncGenerator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from backend.app.core.config import get_settings

settings = get_settings()

# Create async engine with connection pooling and pre-ping validation
async_engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    echo=(settings.LOG_LEVEL == "DEBUG"),
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,      # Tests connection liveness before checking out from pool
    pool_recycle=1800,       # Recycles connections every 30 minutes to prevent server timeouts
    connect_args={"connect_timeout": 10},
)

# Async session factory with expire_on_commit=False for asynchronous attribute access
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency and context provider for asynchronous database sessions.
    Guarantees rollback on unhandled exceptions and cleans up sessions.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_database_health() -> bool:
    """
    Executes a lightweight ping to verify database responsiveness.
    Used by health/readiness endpoints.
    """
    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1;"))
            return True
    except Exception:
        return False
