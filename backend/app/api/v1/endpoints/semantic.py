"""
Semantic Intelligence & Vector Memory API Endpoints.
Provides RESTful APIs for natural language semantic search, automated entity indexing,
and grounded cross-inquiry AI insights.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_async_session
from backend.app.schemas.semantic import (
    SemanticSearchRequest,
    SemanticSearchResponse,
    VectorIndexRequest,
    VectorIndexResponse,
    VectorMemoryStatsResponse,
)
from backend.app.services.vector_service import VectorMemoryService

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_async_session)]


@router.post(
    "/semantic/search",
    response_model=SemanticSearchResponse,
    summary="Semantic Similarity Search",
    description="Performs natural language vector search across market signals, recommendations, and research findings.",
)
async def semantic_search(
    request: SemanticSearchRequest,
    db: SessionDep,
) -> SemanticSearchResponse:
    return await VectorMemoryService.search_semantic_memory(
        session=db,
        query=request.query,
        entity_types=request.entity_types,
        sector=request.sector,
        min_similarity=request.min_similarity,
        limit=request.limit,
        synthesize_insight=request.synthesize_insight,
    )


@router.post(
    "/semantic/index",
    response_model=VectorIndexResponse,
    status_code=status.HTTP_200_OK,
    summary="Index Platform Vector Memory",
    description="Embeds and indexes all market signals, strategic recommendations, and reports into vector memory.",
)
async def index_vector_memory(
    request: VectorIndexRequest,
    db: SessionDep,
) -> VectorIndexResponse:
    return await VectorMemoryService.index_all_entities(
        session=db,
        reindex_all=request.reindex_all,
    )


@router.get(
    "/semantic/stats",
    response_model=VectorMemoryStatsResponse,
    summary="Vector Memory Index Telemetry",
    description="Returns total persisted vector embeddings, breakdown by entity type, and encoder health.",
)
async def get_vector_memory_stats(
    db: SessionDep,
) -> VectorMemoryStatsResponse:
    return await VectorMemoryService.get_stats(session=db)
