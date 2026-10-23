"""
Stage 8 Semantic Intelligence, Vector Memory & AI Insights Tests.
Verifies:
1. Dense vector embedding mathematical properties (exact dimensions, L2 unit norm, deterministic sign hashing).
2. Cosine similarity accuracy and semantic clustering (related texts score higher than unrelated texts).
3. SQLAlchemy VectorEmbedding model persistence with PostgreSQL float arrays and JSON metadata.
4. VectorMemoryService bulk indexing across MarketSignals, Recommendations, and Reports.
5. REST API endpoints:
   - POST /api/v1/semantic/index
   - POST /api/v1/semantic/search
   - GET /api/v1/semantic/stats
"""

import math
import uuid

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.base import utc_now
from backend.app.db.session import AsyncSessionLocal
from backend.app.main import app
from backend.app.models.enums import RecommendationStatus, SignalType, TimeHorizon, VectorEntityType
from backend.app.models.job import Job
from backend.app.models.market_signal import MarketSignal
from backend.app.models.recommendation import Recommendation
from backend.app.models.vector_memory import VectorEmbedding
from backend.app.services.vector_service import DEFAULT_DIMENSIONS, VectorMemoryService


@pytest_asyncio.fixture
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def api_client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


def test_vector_embedding_math_and_normalization():
    """Validates vector dimensions, unit L2 norm, and semantic clustering."""
    text1 = "Solid state battery manufacturing breakthrough increases energy density and cathode efficiency."
    text2 = "Solid state lithium battery cells show 40% energy density increase in EV testing."
    unrelated = "European Union antitrust regulators enforce digital privacy and GDPR compliance fines."

    vec1 = VectorMemoryService.generate_embedding(text1, dimensions=DEFAULT_DIMENSIONS)
    vec2 = VectorMemoryService.generate_embedding(text2, dimensions=DEFAULT_DIMENSIONS)
    vec_unrelated = VectorMemoryService.generate_embedding(unrelated, dimensions=DEFAULT_DIMENSIONS)

    # 1. Exact dimensions
    assert len(vec1) == DEFAULT_DIMENSIONS
    assert len(vec2) == DEFAULT_DIMENSIONS
    assert len(vec_unrelated) == DEFAULT_DIMENSIONS

    # 2. L2 unit norm (sum of squares = 1.0 within floating point tolerance)
    norm1 = math.sqrt(sum(x * x for x in vec1))
    norm2 = math.sqrt(sum(x * x for x in vec2))
    assert math.isclose(norm1, 1.0, rel_tol=1e-3)
    assert math.isclose(norm2, 1.0, rel_tol=1e-3)

    # 3. Semantic similarity clustering
    sim_related = VectorMemoryService.cosine_similarity(vec1, vec2)
    sim_unrelated = VectorMemoryService.cosine_similarity(vec1, vec_unrelated)

    # The battery-related texts must have substantially higher similarity than GDPR text
    assert sim_related > sim_unrelated
    assert sim_related >= 0.50
    assert sim_unrelated < 0.40


@pytest.mark.asyncio
async def test_vector_embedding_crud_and_persistence(db_session: AsyncSession):
    """Tests persisting and querying VectorEmbedding model in PostgreSQL."""
    test_id = uuid.uuid4()
    dummy_vec = VectorMemoryService.generate_embedding("Test cybersecurity zero trust architecture")

    embedding_record = VectorEmbedding(
        entity_type=VectorEntityType.MARKET_SIGNAL.value,
        entity_id=test_id,
        title="Zero Trust Enterprise Expansion",
        content_text="Cloudflare announces enterprise zero trust security suite with AI protection.",
        sector="Cybersecurity",
        metadata_json={"source_domain": "reuters.com", "sentiment_score": 0.45},
        dimensions=DEFAULT_DIMENSIONS,
        embedding=dummy_vec,
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    db_session.add(embedding_record)
    await db_session.commit()
    await db_session.refresh(embedding_record)

    # Fetch back
    fetched = await db_session.scalar(
        select(VectorEmbedding).where(VectorEmbedding.id == embedding_record.id)
    )
    assert fetched is not None
    assert fetched.sector == "Cybersecurity"
    assert len(fetched.embedding) == DEFAULT_DIMENSIONS
    assert fetched.metadata_json["source_domain"] == "reuters.com"


@pytest.mark.asyncio
async def test_vector_memory_indexing_and_similarity_search(db_session: AsyncSession):
    """Tests bulk indexing and semantic similarity query ranking."""
    # 1. Create unique test signal and recommendation
    unique_tag = uuid.uuid4().hex[:6]
    signal = MarketSignal(
        headline=f"Quantum Computing encryption standards adopted by NIST {unique_tag}",
        summary=f"Post-quantum cryptography algorithms deployed to protect banking communications against decryption. {unique_tag}",
        source_domain="nist.gov",
        source_url=f"https://nist.gov/crypto-standards-{unique_tag}",
        canonical_url=f"https://nist.gov/crypto-standards-{unique_tag}",
        published_at=utc_now(),
        sentiment_score=0.60,
        signal_type=SignalType.REGULATORY_UPDATE.value,
        market_sector="Cybersecurity",
    )
    db_session.add(signal)

    job = Job(
        research_question=f"Post-quantum cybersecurity risk landscape {unique_tag}",
        target_market="Enterprise Security",
        geography="Global",
        focus_areas=["Cryptographic Agility", "Zero Trust"],
        status="COMPLETED",
    )
    db_session.add(job)
    await db_session.flush()

    rec = Recommendation(
        job_id=job.id,
        title=f"Deploy Post-Quantum SSL Certificates {unique_tag}",
        description=f"Migrate core API infrastructure to post-quantum resistant cryptographic suites. {unique_tag}",
        rationale="Modern nation-state actors harvest encrypted traffic for future post-quantum decryption.",
        estimated_impact=9,
        estimated_effort=4,
        priority_score=5.1,
        time_horizon=TimeHorizon.NEAR_TERM.value,
        outcome_hypothesis="Prevents future retro-active decryption attacks on telemetry data.",
        success_metric="Zero legacy cipher suites in production",
        evidence_ids=[],
        status=RecommendationStatus.DRAFT.value,
    )
    db_session.add(rec)
    await db_session.commit()

    # 2. Run index service
    index_res = await VectorMemoryService.index_all_entities(session=db_session)
    assert index_res.indexed_count >= 2

    # 3. Search semantic memory
    search_res = await VectorMemoryService.search_semantic_memory(
        session=db_session,
        query=f"Post-quantum cryptography security infrastructure {unique_tag}",
        sector="Cybersecurity",
        min_similarity=0.15,
        limit=20,
        synthesize_insight=True,
    )

    assert search_res.total_matches >= 1
    assert any(m.entity_id == signal.id or m.entity_id == rec.id for m in search_res.matches)
    assert search_res.ai_insight is not None
    assert search_res.latency_ms >= 0


@pytest.mark.asyncio
async def test_api_semantic_endpoints(api_client: httpx.AsyncClient):
    """Tests REST endpoints for semantic search, indexing, and stats."""
    # 1. Index platform memory
    index_res = await api_client.post("/api/v1/semantic/index", json={"reindex_all": False})
    assert index_res.status_code == 200
    index_data = index_res.json()
    assert "indexed_count" in index_data

    # 2. Semantic search query
    search_payload = {
        "query": "Battery energy density and EV range",
        "min_similarity": 0.15,
        "limit": 5,
        "synthesize_insight": True,
    }
    search_res = await api_client.post("/api/v1/semantic/search", json=search_payload)
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert "matches" in search_data
    assert "dimensions" in search_data
    assert search_data["dimensions"] == DEFAULT_DIMENSIONS

    # 3. Vector stats
    stats_res = await api_client.get("/api/v1/semantic/stats")
    assert stats_res.status_code == 200
    stats_data = stats_res.json()
    assert "total_embeddings" in stats_data
    assert stats_data["total_embeddings"] >= 0
    assert "active_encoder" in stats_data
