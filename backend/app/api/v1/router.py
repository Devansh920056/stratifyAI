"""
API v1 Router aggregator.
"""

from fastapi import APIRouter

from backend.app.api.v1.endpoints import dashboard, health, jobs, recommendations

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["Health & Readiness"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["Research Jobs"])
api_router.include_router(recommendations.router, tags=["Action Intelligence"])
api_router.include_router(dashboard.router, tags=["Market Dashboard"])
