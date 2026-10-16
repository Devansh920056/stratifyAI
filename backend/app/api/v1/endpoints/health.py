"""
Health and Readiness Probes.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from backend.app.db.session import check_database_health
from backend.app.schemas.health import HealthResponse

router = APIRouter()


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
