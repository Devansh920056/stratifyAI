"""
API v1 Router aggregator.
"""

from fastapi import APIRouter

from backend.app.api.v1.endpoints import (
    dashboard,
    debates,
    evaluations,
    export,
    fusion,
    health,
    jobs,
    pulse,
    recommendations,
    semantic,
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
api_router.include_router(semantic.router, tags=["Semantic Intelligence & Vector Memory"])
api_router.include_router(fusion.router, tags=["Multi-Source Evidence Fusion & SEC Reconciliation"])
api_router.include_router(debates.router, tags=["Dialectic Debate Engine"])
api_router.include_router(export.router, tags=["Executive Export & Governance"])
