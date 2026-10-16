"""
API v1 Router aggregator.
"""

from fastapi import APIRouter
from backend.app.api.v1.endpoints import health, jobs

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["Health & Readiness"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["Research Jobs"])
