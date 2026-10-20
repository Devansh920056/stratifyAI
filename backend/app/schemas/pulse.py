"""
Pydantic Schemas for Market Pulse Continuous Ingestion Pipeline.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class MarketSignalItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Signal UUID")
    market_sector: str = Field(..., description="Market sector (e.g. Climate Tech, Cybersecurity)")
    headline: str = Field(..., description="Signal or news headline")
    summary: str = Field(..., description="Brief factual summary")
    source_url: str = Field(..., description="Direct article or press release link")
    canonical_url: str = Field(..., description="Sanitized deduplicated canonical URL")
    source_domain: str = Field(..., description="Publisher domain")
    sentiment_score: float = Field(..., description="Tone / sentiment rating (-1.0 to +1.0)")
    relevance_score: float = Field(..., description="Sector relevance (0.0 to 1.0)")
    signal_type: str = Field(..., description="Signal category: COMPETITOR_MOVE, REGULATORY_UPDATE, etc.")
    published_at: datetime = Field(..., description="Publication timestamp")
    created_at: datetime = Field(..., description="Ingestion timestamp")


class MarketPulseResponse(BaseModel):
    signals: list[MarketSignalItem]
    total: int
    sector: str | None = None
    signal_type: str | None = None


class SectorStatItem(BaseModel):
    sector: str
    count: int
    avg_sentiment: float


class DomainStatItem(BaseModel):
    domain: str
    count: int


class MarketPulseStatsResponse(BaseModel):
    total_signals: int
    positive_signals: int
    neutral_signals: int
    negative_signals: int
    average_sentiment: float
    top_sectors: list[SectorStatItem]
    top_domains: list[DomainStatItem]


class MarketPulseSyncRequest(BaseModel):
    sector: str = Field(default="Climate Tech", description="Target market sector for real-time signal sync")
    max_signals: int = Field(default=15, ge=1, le=50, description="Max signals to ingest")
