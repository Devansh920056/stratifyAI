"""
Pydantic Schemas Package.
"""

from backend.app.schemas.dashboard import (
    ClaimClassification,
    JobDashboardResponse,
    MoatCompetitorPoint,
    SourceDomainItem,
    VectorScoreItem,
)
from backend.app.schemas.health import HealthResponse, TelemetryResponse
from backend.app.schemas.job import (
    JobCreateRequest,
    JobDetailResponse,
    JobResponse,
)
from backend.app.schemas.pulse import (
    DomainStatItem,
    MarketPulseResponse,
    MarketPulseStatsResponse,
    MarketPulseSyncRequest,
    MarketSignalItem,
    SectorStatItem,
)
from backend.app.schemas.recommendation import (
    RecommendationCreateRequest,
    RecommendationListResponse,
    RecommendationResponse,
    RecommendationStatusUpdateRequest,
)
from backend.app.schemas.evaluation import (
    BacktestFindingItem,
    BacktestResultResponse,
    BacktestSimulationRequest,
    DecisionAnalyticsSummaryResponse,
    DecisionEvaluationCreateRequest,
    DecisionEvaluationListResponse,
    DecisionEvaluationResponse,
    MetricEvidenceItem,
)
from backend.app.schemas.report import CitationItem, ReportResponse
from backend.app.schemas.task import TaskSummaryResponse
from backend.app.schemas.watchlist import (
    AlertListResponse,
    AlertMarkReadRequest,
    AlertResponse,
    AlertSimulateRequest,
    WatchlistCreateRequest,
    WatchlistListResponse,
    WatchlistResponse,
)

__all__ = [
    "AlertListResponse",
    "AlertMarkReadRequest",
    "AlertResponse",
    "AlertSimulateRequest",
    "BacktestFindingItem",
    "BacktestResultResponse",
    "BacktestSimulationRequest",
    "CitationItem",
    "ClaimClassification",
    "DecisionAnalyticsSummaryResponse",
    "DecisionEvaluationCreateRequest",
    "DecisionEvaluationListResponse",
    "DecisionEvaluationResponse",
    "DomainStatItem",
    "HealthResponse",
    "JobCreateRequest",
    "JobDashboardResponse",
    "JobDetailResponse",
    "JobResponse",
    "MarketPulseResponse",
    "MarketPulseStatsResponse",
    "MarketPulseSyncRequest",
    "MarketSignalItem",
    "MetricEvidenceItem",
    "MoatCompetitorPoint",
    "RecommendationCreateRequest",
    "RecommendationListResponse",
    "RecommendationResponse",
    "RecommendationStatusUpdateRequest",
    "ReportResponse",
    "SectorStatItem",
    "SourceDomainItem",
    "TaskSummaryResponse",
    "TelemetryResponse",
    "VectorScoreItem",
    "WatchlistCreateRequest",
    "WatchlistListResponse",
    "WatchlistResponse",
]
