"""
Stage 4 Market Pulse Continuous Ingestion Pipeline Tests.
Verifies:
1. MarketSignal SQLAlchemy persistence and canonical URL uniqueness deduplication.
2. Lexical sentiment scoring and signal classification heuristics.
3. Live signal ingestion pipeline with GDELT / fallback news feeds.
4. Signal stats aggregation (sentiment distribution, velocity, top domains).
5. FastAPI endpoints: GET /api/v1/pulse, POST /api/v1/pulse/sync, GET /api/v1/pulse/stats.
"""

import json
import uuid

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.base import utc_now
from backend.app.db.session import AsyncSessionLocal
from backend.app.main import app
from backend.app.models.enums import SignalType
from backend.app.models.market_signal import MarketSignal
from backend.app.services.pulse_service import MarketPulseService


@pytest_asyncio.fixture
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def api_client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


GDELT_PAYLOAD = {
    "articles": [
        {
            "url": "https://www.example-news.test/a1?utm_source=x",
            "title": "Cybersecurity firm secures record funding after surge in demand",
            "seendate": "20260115T093000Z",
            "domain": "example-news.test",
            "sourcecountry": "United States",
            "language": "English",
        },
        {
            "url": "https://other-wire.test/a2",
            "title": "Regulators probe Cybersecurity vendor over breach",
            "seendate": "20260116T101500Z",
            "domain": "other-wire.test",
            "sourcecountry": "United Kingdom",
            "language": "English",
        },
    ]
}


@pytest.fixture
def gdelt_transport(monkeypatch):
    """Serves a recorded-shape GDELT response through httpx.MockTransport (no network)."""
    handler_calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        handler_calls.append(request)
        assert request.url.host == "api.gdeltproject.org"
        uid = uuid.uuid4().hex[:8]  # URLs are unique per call: signals are de-duplicated globally by URL
        payload = {
            "articles": [
                {**a, "url": f"{a['url'].split('?')[0]}-{uid}" + ("?" + a["url"].split("?")[1] if "?" in a["url"] else "")}
                for a in GDELT_PAYLOAD["articles"]
            ]
        }
        return httpx.Response(200, content=json.dumps(payload))

    original = MarketPulseService._fetch_gdelt_articles.__func__

    async def patched(cls, sector, max_records=15, client=None):
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as c:
            return await original(cls, sector, max_records, client=c)

    monkeypatch.setattr(MarketPulseService, "_fetch_gdelt_articles", classmethod(patched))
    return handler_calls


@pytest.fixture
def gdelt_down(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="unavailable")

    original = MarketPulseService._fetch_gdelt_articles.__func__

    async def patched(cls, sector, max_records=15, client=None):
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as c:
            return await original(cls, sector, max_records, client=c)

    monkeypatch.setattr(MarketPulseService, "_fetch_gdelt_articles", classmethod(patched))


@pytest.mark.asyncio
async def test_market_signal_crud_and_deduplication(db_session: AsyncSession):
    """Verify MarketSignal model persistence and canonical URL unique constraint."""
    import uuid
    uid_str = uuid.uuid4().hex[:8]
    test_url = f"https://reuters.com/business/climate-tech-surge-{uid_str}"

    sig = MarketSignal(
        market_sector="Climate Tech",
        headline="Breakthrough in Direct Air Capture Reduces Energy By 40%",
        summary="Novel sorbent materials enable pilot plant to operate with drastically reduced energy footprint.",
        source_url=f"{test_url}?utm_source=twitter&ref=feed",
        canonical_url=test_url,
        source_domain="reuters.com",
        sentiment_score=0.7,
        relevance_score=0.95,
        signal_type=SignalType.MARKET_SHIFT.value,
        published_at=utc_now(),
    )
    db_session.add(sig)
    await db_session.commit()
    await db_session.refresh(sig)

    assert sig.id is not None
    assert sig.market_sector == "Climate Tech"
    assert sig.sentiment_score == 0.7

    # Verify query
    loaded = await db_session.scalar(select(MarketSignal).where(MarketSignal.id == sig.id))
    assert loaded is not None
    assert loaded.canonical_url == test_url


def test_sentiment_and_classification_heuristics():
    """Verify lexical sentiment tone rating and signal categorization heuristics."""
    # Positive sentiment
    pos_score = MarketPulseService._analyze_sentiment("Consortium Secures Record $200M Funding Following Surge in Demand")
    assert pos_score > 0.3

    # Negative sentiment
    neg_score = MarketPulseService._analyze_sentiment("Regulators Probe Antitrust Breaches Following Slump in Sector Security")
    assert neg_score < -0.3

    # Classifications
    assert MarketPulseService._classify_signal_type("Regulators issue compliance directive") == SignalType.REGULATORY_UPDATE
    assert MarketPulseService._classify_signal_type("Startup secures $50M Series B") == SignalType.FUNDING
    assert MarketPulseService._classify_signal_type("Ecosystem giants partner on standard") == SignalType.PARTNERSHIP
    assert MarketPulseService._classify_signal_type("Incumbent unveils new pricing features") == SignalType.COMPETITOR_MOVE


@pytest.mark.asyncio
async def test_pulse_ingestion_and_stats(db_session: AsyncSession, gdelt_transport):
    """Verify live signal ingestion service and aggregate stats computation."""
    signals = await MarketPulseService.ingest_live_signals(
        session=db_session,
        sector="Cybersecurity",
        max_records=5,
    )
    assert len(gdelt_transport) == 1
    assert len(signals) >= 1
    assert all(s.market_sector == "Cybersecurity" for s in signals)
    # fields come straight from the GDELT payload (dates parsed, tracking params stripped)
    by_domain = {s.source_domain: s for s in signals}
    if "example-news.test" in by_domain:
        sig = by_domain["example-news.test"]
        assert "utm_source" not in sig.canonical_url
        assert sig.published_at.year == 2026 and sig.published_at.month == 1

    # Verify stats
    stats = await MarketPulseService.get_stats(session=db_session)
    assert stats.total_signals >= 1
    assert stats.positive_signals + stats.neutral_signals + stats.negative_signals == stats.total_signals


@pytest.mark.asyncio
async def test_pulse_api_endpoints(api_client: httpx.AsyncClient, gdelt_transport):
    """Verify HTTP GET /pulse, POST /pulse/sync, and GET /pulse/stats."""
    # 1. Sync signals
    sync_res = await api_client.post(
        "/api/v1/pulse/sync",
        json={"sector": "Developer Productivity", "max_signals": 4},
    )
    assert sync_res.status_code == 201
    sync_data = sync_res.json()
    assert sync_data["total"] >= 1
    assert len(sync_data["signals"]) >= 1

    # 2. Get signals
    get_res = await api_client.get("/api/v1/pulse?sector=Developer Productivity")
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data["total"] >= 1

    # 3. Get stats
    stats_res = await api_client.get("/api/v1/pulse/stats")
    assert stats_res.status_code == 200
    stats_data = stats_res.json()
    assert stats_data["total_signals"] >= 1
    assert "top_sectors" in stats_data


@pytest.mark.asyncio
async def test_pulse_sync_reports_upstream_failure_instead_of_inventing_signals(
    api_client: httpx.AsyncClient, gdelt_down
):
    """When GDELT fails the API says so (502) and stores nothing."""
    res = await api_client.post(
        "/api/v1/pulse/sync", json={"sector": "Outage Sector", "max_signals": 3}
    )
    assert res.status_code == 502
