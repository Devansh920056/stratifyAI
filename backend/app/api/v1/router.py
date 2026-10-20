"""
API v1 Router aggregator.
"""

from fastapi import APIRouter

from backend.app.api.v1.endpoints import (
    dashboard,
    evaluations,
    health,
    jobs,
    pulse,
    recommendations,
    watchlists,
    webhooks,
)

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["Health & Readiness"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["Research Jobs"])
api_router.include_router(recommendations.router, tags=["Action Intelligence"])
api_router.include_router(dashboard.router, tags=["Market Dashboard"])
api_router.include_router(pulse.router, tags=["Market Pulse"])
api_router.include_router(watchlists.router, tags=["Competitor Watchlists & Alerts"])
api_router.include_router(evaluations.router, tags=["Decision Evaluation & Backtesting"])
api_router.include_router(webhooks.router, tags=["Webhook Notifications & Dispatcher"])
