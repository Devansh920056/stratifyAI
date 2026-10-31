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
from backend.app.providers.arxiv_preprint import build_search_query, parse_atom_feed
from backend.app.providers.sec_edgar import extract_risk_factors, html_to_text
from backend.app.services.fusion_service import EvidenceFusionService
from tests.fakes import _ATOM, _filing_html, install_sec_arxiv_transport


@pytest_asyncio.fixture
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def api_client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def sec_arxiv_mocked(monkeypatch):
    install_sec_arxiv_transport(monkeypatch)


def test_html_to_text_and_item_1a_extraction():
    text = html_to_text(_filing_html())
    excerpt = extract_risk_factors(text)
    assert excerpt is not None
    assert "adversely affected" in excerpt
    assert "Unresolved" not in excerpt
    # a table of contents alone is not a risk-factor section
    assert extract_risk_factors("Item 1A. Risk Factors 12 Item 1B. Unresolved Staff Comments 30") is None


@pytest.mark.asyncio
async def test_sec_edgar_provider_and_cik_resolution(sec_arxiv_mocked):
    """Resolves a company via company_tickers.json and parses real-shaped submissions + filing HTML."""
    sec = SECFilingsProvider()

    async with httpx.AsyncClient() as client:
        assert (await sec.resolve_company("TSLA", client))["cik"] == 1318605
        assert (await sec.resolve_company("CrowdStrike", client))["ticker"] == "CRWD"
        assert await sec.resolve_company("Not A Registrant Corp", client) is None

    filings = await sec.get_filings_for_entity("Tesla", max_results=3)
    assert [f.filing_type for f in filings] == ["10-Q", "10-K", "8-K"]
    tenk = next(f for f in filings if f.filing_type == "10-K")
    assert tenk.metadata["excerpt_kind"] == "item_1a_risk_factors"
    assert "Risk Factors" in tenk.title
    assert tenk.source_url == "https://www.sec.gov/Archives/edgar/data/1318605/000000000025000002/annual.htm"
    assert tenk.metadata["reliability_basis"] == "source_class_prior"
    # the 8-K has no risk-factor section: metadata only, and it says so
    eightk = next(f for f in filings if f.filing_type == "8-K")
    assert eightk.metadata["excerpt_kind"] == "filing_metadata"
    assert "Form 8-K filed 2025-01-10" in eightk.content_excerpt

    assert await sec.get_filings_for_entity("Not A Registrant Corp") == []


@pytest.mark.asyncio
async def test_sec_provider_raises_on_outage():
    def down(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503)

    from backend.app.providers import sec_edgar
    from backend.app.providers.sec_edgar import SECProviderError

    sec_edgar._ticker_cache.update(loaded_at=0.0, rows=[])
    async with httpx.AsyncClient(transport=httpx.MockTransport(down)) as client:
        with pytest.raises(SECProviderError):
            await SECFilingsProvider(client=client).get_filings_for_entity("Tesla")


def test_arxiv_atom_parsing_and_query_building():
    papers = parse_atom_feed(_ATOM)
    assert len(papers) == 1
    p = papers[0]
    assert p.arxiv_id == "2401.00001"
    assert p.source_url == "https://arxiv.org/abs/2401.00001"
    assert p.authors == ["Test Author One", "Test Author Two"]
    assert p.metadata["reliability_basis"] == "source_class_prior"
    assert build_search_query("the Solid-state battery") == "all:solid-state AND all:battery"
    assert build_search_query("the of") is None


@pytest.mark.asyncio
async def test_arxiv_preprint_provider(sec_arxiv_mocked):
    papers = await ArxivPreprintProvider().search_preprints("Solid-state battery chemistry", max_results=2)
    assert len(papers) == 1
    assert "arxiv.org" in papers[0].source_url
    assert len(papers[0].abstract_excerpt) > 40


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
async def test_evidence_fusion_service_contradiction_detection(db_session: AsyncSession, sec_arxiv_mocked):
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
    assert "Tone mismatch" in (contradictory_items[0].reconciliation_notes or "")
    assert fused_res.summary.retrieval_warnings == []


@pytest.mark.asyncio
async def test_api_fusion_endpoints(api_client: httpx.AsyncClient, sec_arxiv_mocked):
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


@pytest.mark.asyncio
async def test_fusion_reports_retrieval_failure_and_stores_nothing(db_session: AsyncSession, monkeypatch):
    """If SEC/arXiv are unreachable, the response carries warnings and zero items - no substitutes."""
    original = httpx.AsyncClient

    class _Down(original):  # type: ignore[misc, valid-type]
        def __init__(self, *a, **kw):
            kw.setdefault("transport", httpx.MockTransport(lambda r: httpx.Response(503)))
            super().__init__(*a, **kw)

    from backend.app.providers import sec_edgar

    sec_edgar._ticker_cache.update(loaded_at=0.0, rows=[])
    monkeypatch.setattr(httpx, "AsyncClient", _Down)
    entity = f"NoData-{uuid.uuid4().hex[:6]}"
    res = await EvidenceFusionService.query_and_fuse_evidence(db_session, entity, "anything")
    assert res.total == 0
    assert len(res.summary.retrieval_warnings) == 2
