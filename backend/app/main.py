"""
Main FastAPI Application Entrypoint.
"""

import logging
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

    yield

    logger.info("Shutting down Stratify AI API Coordinator...")
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
    logger.error(f"Unhandled server error on {request.method} {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please try again later."},
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
