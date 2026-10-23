"""
Main FastAPI Application Entrypoint.
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.api.v1.router import api_router
from backend.app.core.config import get_settings
from backend.app.db.session import async_engine, check_database_health

settings = get_settings()

# Configure logging
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("stratify.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle management."""
    logger.info(f"Starting Stratify AI API Coordinator [Env: {settings.ENVIRONMENT}]")
    db_ok = await check_database_health()
    if db_ok:
        logger.info("Database connectivity verified on startup.")
    else:
        logger.warning("Database connectivity check failed on startup!")

    # Attempt to assert broker topology on startup if RabbitMQ is reachable
    try:
        import aio_pika

        from backend.app.broker.connection import get_broker_channel

        async with get_broker_channel(ensure_topology=True) as _:
            logger.info("RabbitMQ broker topology asserted on startup.")
    except (aio_pika.exceptions.AMQPException, OSError, TimeoutError) as broker_err:
        logger.warning(
            f"RabbitMQ connection not available on startup: {broker_err}. Outbox relay will retry."
        )

    relay_task = None
    worker_task = None
    stop_event = asyncio.Event()

    # Automatically run integrated outbox relay loop and worker consumer in background
    if (
        settings.AUTO_START_WORKERS
        and settings.ENVIRONMENT != "test"
        and not os.environ.get("PYTEST_CURRENT_TEST")
    ):
        from backend.app.services.outbox_relay import OutboxRelayService
        from workers.consumer import WorkerConsumer

        logger.info("Spawning integrated Outbox Relay loop...")
        relay_task = asyncio.create_task(
            OutboxRelayService.run_relay_loop(stop_event=stop_event),
            name="outbox-relay-loop",
        )

        consumer = WorkerConsumer(
            worker_id="embedded-worker",
            prefetch_count=settings.WORKER_CONCURRENCY,
        )

        async def run_resilient_consumer():
            while not stop_event.is_set():
                try:
                    await consumer.start(stop_event=stop_event)
                    break
                except asyncio.CancelledError:
                    break
                except Exception as exc:
                    logger.warning(
                        f"Embedded worker broker connection deferred: {exc}. Retrying in 3s..."
                    )
                    try:
                        await asyncio.wait_for(stop_event.wait(), timeout=3.0)
                    except asyncio.TimeoutError:
                        pass

        logger.info("Spawning integrated Worker Consumer...")
        worker_task = asyncio.create_task(
            run_resilient_consumer(),
            name="worker-consumer-loop",
        )

    yield

    logger.info("Shutting down Stratify AI API Coordinator...")
    stop_event.set()
    if relay_task:
        relay_task.cancel()
    if worker_task:
        worker_task.cancel()
    if relay_task or worker_task:
        tasks = [t for t in (relay_task, worker_task) if t is not None]
        await asyncio.gather(*tasks, return_exceptions=True)

    await async_engine.dispose()
    logger.info("Database engine connections disposed.")


app = FastAPI(
    title="Stratify AI — Distributed Market Intelligence Coordinator",
    description=(
        "Production-grade distributed market intelligence platform. "
        "Accepts market inquiries, decomposes them into orthogonal research tasks, "
        "persists reliable state, and coordinates distributed worker execution."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Cross-Origin Resource Sharing (CORS) Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|\d+\.\d+\.\d+\.\d+)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch-all exception handler preventing uncaught stack traces or secrets
    from leaking to the client in HTTP 500 responses.
    """
    logger.error(
        f"Unhandled server error on {request.method} {request.url.path}: {exc!s}",
        exc_info=exc,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal server error occurred. Please try again later."
        },
    )


@app.get("/", tags=["Root"])
async def root():
    """Root info endpoint providing service metadata and documentation links."""
    return {
        "service": "Stratify AI Coordinator API",
        "version": "0.1.0",
        "docs_url": "/docs",
        "health_check": "/api/v1/health/ready",
    }


# Mount API v1 router
app.include_router(api_router, prefix="/api/v1")
