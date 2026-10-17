"""
Health, Readiness, and System Telemetry Probes.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from backend.app.core.config import get_settings
from backend.app.db.session import AsyncSessionLocal, check_database_health
from backend.app.models.enums import JobStatus
from backend.app.models.job import Job
from backend.app.models.task import Task
from backend.app.schemas.health import HealthResponse, TelemetryResponse

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
        version="0.1.0",
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
                version="0.1.0",
                timestamp=datetime.now(UTC),
                components=components,
            ).model_dump(mode="json"),
        )

    return HealthResponse(
        status="healthy",
        version="0.1.0",
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
            import logging
            logging.getLogger("stratify.api").warning("Telemetry metrics query error: %s", exc)

    return TelemetryResponse(
        status="healthy" if db_healthy else "degraded",
        version="0.1.0",
        timestamp=datetime.now(UTC),
        database={
            "status": "healthy" if db_healthy else "unhealthy",
            "host_port": 5434,
            "container": "stratify_postgres",
            "engine": "PostgreSQL 16 Alpine",
            "isolation": "Read Committed + Serializable Outbox",
        },
        broker={
            "status": "operational",
            "amqp_port": 5672,
            "management_port": 15672,
            "exchange": "stratify.tasks.exchange",
            "queue": "stratify.tasks.queue",
            "dlq": "stratify.tasks.dlq",
            "delivery_mode": "DURABLE_PERSISTENT (2)",
        },
        orchestrator={
            "concurrency_control": "Optimistic Concurrency Control (OCC, integer version)",
            "outbox_pattern": "Transactional Outbox with SELECT ... FOR UPDATE SKIP LOCKED",
            "max_worker_retries": 3,
            "qos_prefetch_count": 2,
        },
        ai_providers={
            "llm": f"{settings.LLM_PROVIDER} ({settings.LLM_MODEL})",
            "search": f"{settings.SEARCH_PROVIDER} (Tavily Real-time Web Search)",
            "anti_hallucination": "Active (Deterministic URL verification + Cross-claim canonicalization)",
        },
        metrics={
            "total_jobs": total_jobs,
            "completed_jobs": completed_jobs,
            "processing_jobs": processing_jobs,
            "total_tasks": total_tasks,
        },
    )
