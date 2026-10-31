"""
Health, Readiness, and System Telemetry Probes.
"""

import asyncio
import logging
from datetime import UTC, datetime

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from backend.app.broker.connection import get_broker_channel
from backend.app.broker.constants import DEAD_LETTER_QUEUE, TASKS_QUEUE
from backend.app.core.config import get_settings
from backend.app.core import APP_VERSION
from backend.app.db.session import AsyncSessionLocal, check_database_health
from backend.app.models.enums import JobStatus
from backend.app.models.job import Job
from backend.app.models.task import Task
from backend.app.schemas.health import HealthResponse, TelemetryResponse

logger = logging.getLogger("stratify.api.health")
router = APIRouter()
settings = get_settings()


@router.get(
    "/live",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Liveness Probe",
    description="Returns 200 OK if the FastAPI process is alive and responding.",
)
async def liveness_probe() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        version=APP_VERSION,
        timestamp=datetime.now(UTC),
        components={"api": "healthy"},
    )


@router.get(
    "/ready",
    response_model=HealthResponse,
    summary="Readiness Probe",
    description="Tests downstream storage connectivity (PostgreSQL) before accepting traffic.",
)
async def readiness_probe():
    db_healthy = await check_database_health()
    components = {"database": "healthy" if db_healthy else "unhealthy"}

    if not db_healthy:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=HealthResponse(
                status="unhealthy",
                version=APP_VERSION,
                timestamp=datetime.now(UTC),
                components=components,
            ).model_dump(mode="json"),
        )

    return HealthResponse(
        status="healthy",
        version=APP_VERSION,
        timestamp=datetime.now(UTC),
        components=components,
    )


@router.get(
    "/telemetry",
    response_model=TelemetryResponse,
    summary="System Telemetry & Architecture Invariants",
    description="Returns deep diagnostic metadata covering PostgreSQL, RabbitMQ, OCC versioning, and execution counters.",
)
async def system_telemetry() -> TelemetryResponse:
    db_healthy = await check_database_health()

    # Query aggregate execution metrics from DB
    total_jobs = 0
    completed_jobs = 0
    processing_jobs = 0
    total_tasks = 0

    if db_healthy:
        try:
            async with AsyncSessionLocal() as session:
                total_jobs = (await session.scalar(select(func.count(Job.id)))) or 0
                completed_jobs = (
                    await session.scalar(
                        select(func.count(Job.id)).where(
                            Job.status.in_(
                                [
                                    JobStatus.COMPLETED.value,
                                    JobStatus.PARTIALLY_COMPLETED.value,
                                ]
                            )
                        )
                    )
                ) or 0
                processing_jobs = (
                    await session.scalar(
                        select(func.count(Job.id)).where(
                            Job.status.in_(
                                [
                                    JobStatus.PENDING.value,
                                    JobStatus.PROCESSING.value,
                                ]
                            )
                        )
                    )
                ) or 0
                total_tasks = (await session.scalar(select(func.count(Task.id)))) or 0
        except (SQLAlchemyError, OSError) as exc:
            logger.warning("Telemetry metrics query error: %s", exc)

    broker_ok = await _check_broker()
    llm = settings.LLM_PROVIDER.lower()
    search = settings.SEARCH_PROVIDER.lower()
    return TelemetryResponse(
        status="healthy" if (db_healthy and broker_ok) else "degraded",
        version=APP_VERSION,
        timestamp=datetime.now(UTC),
        database={
            "status": "healthy" if db_healthy else "unhealthy",
            "host": settings.POSTGRES_HOST,
            "port": settings.POSTGRES_PORT,
            "database": settings.POSTGRES_DB,
        },
        broker={
            "status": "operational" if broker_ok else "unreachable",
            "host": settings.RABBITMQ_HOST,
            "amqp_port": settings.RABBITMQ_PORT,
            "management_port": settings.RABBITMQ_MANAGEMENT_PORT,
            "queue": TASKS_QUEUE,
            "dlq": DEAD_LETTER_QUEUE,
        },
        orchestrator={
            "max_worker_retries": settings.MAX_TASK_RETRIES,
            "qos_prefetch_count": settings.WORKER_CONCURRENCY,
            "task_timeout_seconds": settings.TASK_TIMEOUT_SECONDS,
            "embedded_workers": settings.AUTO_START_WORKERS,
        },
        ai_providers={
            "llm": (
                f"Gemini ({settings.LLM_MODEL})"
                if llm == "gemini" and (settings.GEMINI_API_KEY or "").strip()
                else "Extractive grounder (quotes retrieved evidence; no generative model)"
            ),
            "search": (
                "Tavily"
                if search == "tavily" and (settings.TAVILY_API_KEY or "").strip()
                else "DuckDuckGo / Wikipedia"
            ),
            "grounding_check": "URLs returned by the LLM must match retrieved evidence; others are dropped",
        },
        metrics={
            "total_jobs": total_jobs,
            "completed_jobs": completed_jobs,
            "processing_jobs": processing_jobs,
            "total_tasks": total_tasks,
        },
    )


async def _check_broker() -> bool:
    """True when a RabbitMQ connection can be opened within 3 seconds."""
    try:
        async with asyncio.timeout(3):
            async with get_broker_channel(publisher_confirms=False, ensure_topology=False):
                return True
    except Exception as exc:
        logger.info("Broker health check failed: %s", exc)
        return False
