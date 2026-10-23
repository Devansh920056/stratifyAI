"""
Pydantic Schemas for Competitor Watchlists and Real-Time Alerting Engine.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Alert UUID")
    watchlist_id: uuid.UUID = Field(..., description="Parent Watchlist UUID")
    signal_id: uuid.UUID | None = Field(None, description="Linked Market Signal UUID, if triggered by ingestion")
    title: str = Field(..., description="Alert headline/summary")
    message: str = Field(..., description="Detailed alert context or trigger reason")
    severity: str = Field(..., description="INFO, WARNING, or CRITICAL")
    is_read: bool = Field(..., description="Read/unread acknowledgment status")
    triggered_at: datetime = Field(..., description="Timestamp alert was triggered")
    watchlist_name: str | None = Field(None, description="Associated watchlist name for cross-feed display")


class AlertListResponse(BaseModel):
    alerts: list[AlertResponse]
    total: int
    unread_count: int


class AlertMarkReadRequest(BaseModel):
    is_read: bool = Field(default=True, description="Mark as read (true) or unread (false)")


class WatchlistCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, description="Watchlist label e.g. Direct Competitors")
    sector: str = Field(..., min_length=2, max_length=100, description="Industry sector e.g. Climate Tech")
    target_entities: list[str] = Field(default_factory=list, description="List of competitor names or tracked brands")
    alert_threshold: float = Field(default=-0.2, ge=-1.0, le=1.0, description="Sentiment delta trigger threshold")
    is_active: bool = Field(default=True, description="Active polling status")


class WatchlistResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Watchlist UUID")
    name: str = Field(..., description="Watchlist name")
    sector: str = Field(..., description="Sector")
    target_entities: list[str] = Field(default_factory=list, description="Tracked entities")
    alert_threshold: float = Field(..., description="Alert sentiment threshold")
    is_active: bool = Field(..., description="Active status")
    created_at: datetime = Field(..., description="Created timestamp")
    updated_at: datetime = Field(..., description="Updated timestamp")
    alert_count: int = Field(default=0, description="Total alerts triggered for this watchlist")
    unread_alert_count: int = Field(default=0, description="Unread alerts count")
    recent_alerts: list[AlertResponse] = Field(default_factory=list, description="Recent alerts for this watchlist")


class WatchlistListResponse(BaseModel):
    watchlists: list[WatchlistResponse]
    total: int


class AlertSimulateRequest(BaseModel):
    watchlist_id: uuid.UUID | None = Field(None, description="Target watchlist; uses first active if None")
    title: str | None = Field(None, description="Optional custom title")
    message: str | None = Field(None, description="Optional custom message")
    severity: str | None = Field("WARNING", description="INFO, WARNING, or CRITICAL")
