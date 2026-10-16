"""
Pydantic Schemas for Aggregated Market Intelligence Reports.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class CitationItem(BaseModel):
    url: str = Field(..., description="Source web URL")
    title: str | None = Field(None, description="Title of the source publication")
    retrieved_at: datetime | None = Field(
        None, description="Timestamp of evidence retrieval"
    )
    claim_id: str | None = Field(
        None, description="Claim identifier supported by this source"
    )


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Unique Report UUID")
    job_id: uuid.UUID = Field(..., description="Associated Job UUID")
    executive_summary: str = Field(
        ..., description="Synthesized executive intelligence summary"
    )
    market_findings: dict[str, Any] = Field(
        ..., description="Market sizing, growth rates, and structural dynamics"
    )
    competitor_analysis: dict[str, Any] = Field(
        ..., description="Key players, market share, and positioning"
    )
    customer_insights: dict[str, Any] = Field(
        ..., description="Buyer sentiment, price sensitivity, and adoption drivers"
    )
    opportunities_and_risks: dict[str, Any] = Field(
        ..., description="Market opportunities, threats, and regulatory barriers"
    )
    citations: list[dict[str, Any]] = Field(
        default_factory=list, description="Verifiable external citations"
    )
    research_limitations: str | None = Field(
        None, description="Gaps, missing data, or provider failures"
    )
    status: str = Field(..., description="Report status: DRAFT, FINAL, PARTIAL, FAILED")
    created_at: datetime = Field(..., description="Report generation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
