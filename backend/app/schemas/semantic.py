"""
Pydantic Schemas for Semantic Search, Vector Memory, and AI Insight Synthesis.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SemanticSearchRequest(BaseModel):
    query: str = Field(
        ...,
        min_length=2,
        max_length=500,
        description="Natural language search query e.g. 'Solid-state battery scaling bottlenecks'",
    )
    entity_types: list[str] | None = Field(
        default=None,
        description="Optional filter: MARKET_SIGNAL, RECOMMENDATION, RESEARCH_FINDING, RESEARCH_REPORT",
    )
    sector: str | None = Field(
        default=None,
        description="Optional market sector filter e.g. 'Climate Tech'",
    )
    min_similarity: float = Field(
        default=0.20,
        ge=0.0,
        le=1.0,
        description="Minimum cosine similarity threshold (0.0 to 1.0)",
    )
    limit: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Maximum number of semantic results to return",
    )
    synthesize_insight: bool = Field(
        default=True,
        description="Whether to generate an evidence-grounded AI synthesis",
    )


class SemanticMatchItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Vector embedding UUID")
    entity_type: str = Field(..., description="Entity category")
    entity_id: uuid.UUID = Field(..., description="Referenced entity UUID")
    title: str = Field(..., description="Entity headline or title")
    content_text: str = Field(..., description="Embedded textual excerpt")
    sector: str | None = Field(default=None, description="Market sector")
    similarity_score: float = Field(..., description="Cosine similarity score (0.0 to 1.0)")
    match_percentage: float = Field(..., description="Relevance match percentage (0 to 100%)")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Entity metadata payload")
    created_at: datetime = Field(..., description="Timestamp of embedding creation")


class SemanticSearchResponse(BaseModel):
    query: str = Field(..., description="Executed search query")
    total_matches: int = Field(..., description="Count of matches meeting threshold")
    matches: list[SemanticMatchItem] = Field(default_factory=list, description="Ranked semantic results")
    ai_insight: str | None = Field(
        default=None,
        description="Synthesized intelligence summary grounded in the retrieved matches",
    )
    key_drivers: list[str] = Field(
        default_factory=list,
        description="Extracted key market drivers or entities",
    )
    dimensions: int = Field(..., description="Embedding vector dimensionality")
    latency_ms: int = Field(..., description="Total execution latency in milliseconds")


class VectorIndexRequest(BaseModel):
    reindex_all: bool = Field(
        default=False,
        description="If True, re-embeds all existing records; if False, only indexes missing entities",
    )


class VectorIndexResponse(BaseModel):
    indexed_count: int = Field(..., description="Total new or updated vector embeddings")
    signals_indexed: int = Field(..., description="Market signals embedded")
    recommendations_indexed: int = Field(..., description="Recommendations embedded")
    findings_indexed: int = Field(..., description="Research findings embedded")
    message: str = Field(..., description="Indexing summary message")


class VectorMemoryStatsResponse(BaseModel):
    total_embeddings: int = Field(..., description="Total persisted vector embeddings")
    by_entity_type: dict[str, int] = Field(default_factory=dict, description="Count per entity type")
    dimensions: int = Field(..., description="Active embedding dimensionality")
    supported_encoders: list[str] = Field(default_factory=list, description="List of supported encoders")
    active_encoder: str = Field(..., description="Currently active vector encoder")
