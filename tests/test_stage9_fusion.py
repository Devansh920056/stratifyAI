"""
Stage 9 Multi-Source Evidence Fusion & Regulatory Filing Reconciliation Tests.
Verifies:
1. SECFilingsProvider institutional CIK resolution and Item 1A Risk Factor extraction.
2. ArxivPreprintProvider deep-tech technical preprint ingestion and metadata parsing.
3. FusedEvidence model relational persistence with PostgreSQL JSONB and enum constraints.
4. EvidenceFusionService contradiction detection between commercial PR news and statutory filings.
5. REST API endpoints:
   - POST /api/v1/fusion/query
   - GET /api/v1/fusion/evidence
   - GET /api/v1/fusion/reconcile/{entity_name}
"""

import uuid

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.base import utc_now
from backend.app.db.session import AsyncSessionLocal
from backend.app.main import app
from backend.app.models.enums import DivergenceStatus, EvidenceSourceType, SignalType
from backend.app.models.fused_evidence import FusedEvidence
from backend.app.models.market_signal import MarketSignal
from backend.app.providers.arxiv_preprint import ArxivPreprintProvider
from backend.app.providers.sec_edgar import SECFilingsProvider
from backend.app.services.fusion_service import EvidenceFusionService


@pytest_asyncio.fixture
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def api_client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.mark.asyncio
async def test_sec_edgar_provider_and_cik_resolution():
    """Validates SEC EDGAR company CIK resolution and Item 1A Risk Factor extraction."""
    sec = SECFilingsProvider()

    # 1. Test CIK resolution for known tickers
    tesla_meta = sec.resolve_cik("TSLA")
    assert tesla_meta is not None
    assert tesla_meta["cik"] == "0001318605"
    assert tesla_meta["ticker"] == "TSLA"

    crwd_meta = sec.resolve_cik("CrowdStrike")
    assert crwd_meta is not None
    assert crwd_meta["ticker"] == "CRWD"

    # 2. Fetch filings
    filings = await sec.get_filings_for_entity("Tesla", max_results=3)
    assert len(filings) >= 1
    top_filing = filings[0]
    assert top_filing.filing_type in ("10-K", "10-Q")
    assert "Risk Factors" in top_filing.title
    assert top_filing.reliability_score == 0.95
    assert "https://www.sec.gov" in top_filing.source_url


@pytest.mark.asyncio
async def test_arxiv_preprint_provider():
    """Validates arXiv academic preprint search and metadata extraction."""
    arxiv = ArxivPreprintProvider()

    papers = await arxiv.search_preprints("Solid-state battery chemistry", max_results=2)
    assert len(papers) >= 1
    top_paper = papers[0]
    assert "arxiv.org" in top_paper.source_url
    assert len(top_paper.authors) >= 1
    assert top_paper.reliability_score == 0.85
    assert len(top_paper.abstract_excerpt) > 40


@pytest.mark.asyncio
async def test_fused_evidence_model_crud_and_persistence(db_session: AsyncSession):
    """Tests persisting FusedEvidence records into PostgreSQL."""
    test_id = uuid.uuid4().hex[:6]
    evidence = FusedEvidence(
        entity_name=f"Rivian Automotive {test_id}",
        source_type=EvidenceSourceType.SEC_EDGAR.value,
        filing_type="10-K",
        title=f"Item 1A Risk Factor: Battery Pack Tooling {test_id}",
        content_excerpt="Manufacturing tooling constraints may delay high-volume R2 output.",
        source_url="https://www.sec.gov/edgar/browse/?CIK=0001874178",
        reliability_score=0.95,
        divergence_status=DivergenceStatus.ALIGNED.value,
        fiscal_period="FY 2024",
        metadata_json={"cik": "0001874178", "test_id": test_id},
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    db_session.add(evidence)
    await db_session.commit()
    await db_session.refresh(evidence)

    fetched = await db_session.scalar(
        select(FusedEvidence).where(FusedEvidence.id == evidence.id)
    )
    assert fetched is not None
    assert fetched.filing_type == "10-K"
    assert fetched.reliability_score == 0.95
    assert fetched.metadata_json["test_id"] == test_id


@pytest.mark.asyncio
async def test_evidence_fusion_service_contradiction_detection(db_session: AsyncSession):
    """Tests cross-source reconciliation and claim contradiction detection."""
    unique_tag = uuid.uuid4().hex[:6]
    # 1. Insert overly optimistic commercial news signal
    signal = MarketSignal(
        headline=f"Tesla achieves unprecedented production surge with zero supplier bottlenecks {unique_tag}",
        summary=f"Automaker reports record Cybercab ramp with zero supply chain delays in public press conference. {unique_tag}",
        source_domain="techpress.com",
        source_url=f"https://techpress.com/tesla-surge-{unique_tag}",
        canonical_url=f"https://techpress.com/tesla-surge-{unique_tag}",
        published_at=utc_now(),
        sentiment_score=0.85,
        signal_type=SignalType.COMPETITOR_MOVE.value,
        market_sector="Climate Tech",
    )
    db_session.add(signal)
    await db_session.commit()

    # 2. Query and fuse evidence for Tesla
    fused_res = await EvidenceFusionService.query_and_fuse_evidence(
        session=db_session,
        entity_name="Tesla",
        topic="battery yields",
        include_sec=True,
        include_arxiv=True,
        reconcile=True,
    )

    assert fused_res.total >= 1
    assert fused_res.summary is not None
    assert fused_res.summary.sec_filings_count >= 1

    # Because commercial news reported zero bottlenecks, but 10-K states manufacturing yield bottlenecks,
    # the contradiction detector must catch the claim contradiction!
    contradictory_items = [
        item for item in fused_res.items
        if item.divergence_status == DivergenceStatus.CONTRADICTORY.value
    ]
    assert len(contradictory_items) >= 1
    assert "Direct Claim Contradiction" in (contradictory_items[0].reconciliation_notes or "")
    assert fused_res.summary.evidence_reliability_index >= 0.85


@pytest.mark.asyncio
async def test_api_fusion_endpoints(api_client: httpx.AsyncClient):
    """Tests REST endpoints for multi-source fusion query, listing, and reconciliation."""
    # 1. Query and fuse endpoint
    payload = {
        "entity_name": "CrowdStrike",
        "topic": "kernel sensor updates",
        "include_sec": True,
        "include_arxiv": True,
        "reconcile": True,
    }
    query_res = await api_client.post("/api/v1/fusion/query", json=payload)
    assert query_res.status_code == 200
    data = query_res.json()
    assert data["total"] >= 1
    assert "summary" in data
    assert data["summary"]["sec_filings_count"] >= 1

    # 2. List evidence endpoint
    list_res = await api_client.get("/api/v1/fusion/evidence?entity=CrowdStrike&limit=10")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] >= 1

    # 3. Dedicated reconciliation endpoint
    recon_res = await api_client.get("/api/v1/fusion/reconcile/Tesla")
    assert recon_res.status_code == 200
    recon_data = recon_res.json()
    assert recon_data["summary"] is not None
    assert "evidence_reliability_index" in recon_data["summary"]
