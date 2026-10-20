"""
Stage 5 Competitor Watchlists and Real-Time Alerting Engine Tests.
Verifies:
1. Watchlist and Alert model persistence, relationship cascades, and indexing.
2. Signal evaluation engine against watchlist target entities and negative sentiment thresholds.
3. Automated alert generation on competitor moves and regulatory updates.
4. Read/unread state transitions.
5. REST API endpoints:
   - GET /api/v1/watchlists
   - POST /api/v1/watchlists
   - GET /api/v1/watchlists/{id}
   - DELETE /api/v1/watchlists/{id}
   - GET /api/v1/alerts
   - PATCH /api/v1/alerts/{id}/read
   - POST /api/v1/alerts/simulate
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
from backend.app.models.enums import AlertSeverity, SignalType
from backend.app.models.market_signal import MarketSignal
from backend.app.models.watchlist import Alert, Watchlist
from backend.app.schemas.watchlist import WatchlistCreateRequest
from backend.app.services.watchlist_service import WatchlistService


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
async def test_watchlist_model_crud_and_cascades(db_session: AsyncSession):
    """Test creating a Watchlist and linked Alert with cascade deletion."""
    test_id = uuid.uuid4().hex[:6]
    wl = Watchlist(
        name=f"Battery OEM Tracker {test_id}",
        sector="Energy Storage",
        target_entities=["QuantumScape", "Solid Power"],
        alert_threshold=-0.25,
        is_active=True,
    )
    db_session.add(wl)
    await db_session.commit()
    await db_session.refresh(wl)

    assert wl.id is not None
    assert wl.name == f"Battery OEM Tracker {test_id}"
    assert len(wl.target_entities) == 2

    # Add an alert linked to this watchlist
    alert = Alert(
        watchlist_id=wl.id,
        title="Solid Power Supply Chain Disruption",
        message="Electrolyte purity issue slows prototype shipments.",
        severity=AlertSeverity.WARNING.value,
        is_read=False,
    )
    db_session.add(alert)
    await db_session.commit()
    await db_session.refresh(alert)

    assert alert.id is not None
    assert alert.watchlist_id == wl.id
    assert alert.is_read is False

    # Delete watchlist and verify cascade deletes linked alerts
    await db_session.delete(wl)
    await db_session.commit()

    deleted_alert = await db_session.scalar(select(Alert).where(Alert.id == alert.id))
    assert deleted_alert is None


@pytest.mark.asyncio
async def test_watchlist_service_evaluate_signals(db_session: AsyncSession):
    """Test signal scanning against target entities and threshold breach."""
    test_id = uuid.uuid4().hex[:6]
    entity_name = f"AeroVolt_{test_id}"

    # Create watchlist tracking AeroVolt
    req = WatchlistCreateRequest(
        name=f"eVTOL Radar {test_id}",
        sector="Aerospace",
        target_entities=[entity_name],
        alert_threshold=-0.15,
        is_active=True,
    )
    wl_resp = await WatchlistService.create_watchlist(session=db_session, req=req)
    assert wl_resp.id is not None

    # Create a negative market signal mentioning AeroVolt
    sig = MarketSignal(
        market_sector="Aerospace",
        headline=f"Certification Delay Headwind: {entity_name} Pushes Commercial Deliveries to 2028",
        summary=f"FAA inquiry raises questions on battery thermal containment for {entity_name}.",
        source_url=f"https://aviationtoday.com/news/{test_id}",
        canonical_url=f"https://aviationtoday.com/news/{test_id}",
        source_domain="aviationtoday.com",
        sentiment_score=-0.45,
        relevance_score=0.9,
        signal_type=SignalType.COMPETITOR_MOVE.value,
        published_at=utc_now(),
    )
    db_session.add(sig)
    await db_session.commit()
    await db_session.refresh(sig)

    # Evaluate signal against watchlists
    alerts = await WatchlistService.evaluate_signals_against_watchlists(
        session=db_session,
        signals=[sig],
        target_watchlist_id=wl_resp.id,
    )
    assert len(alerts) >= 1
    trigger_alert = alerts[0]
    assert trigger_alert.severity == AlertSeverity.CRITICAL.value
    assert entity_name.upper() in trigger_alert.title
    assert trigger_alert.is_read is False

    # Clean up
    await WatchlistService.delete_watchlist(session=db_session, watchlist_id=wl_resp.id)


@pytest.mark.asyncio
async def test_watchlist_alert_read_status_toggle(db_session: AsyncSession):
    """Test marking an alert as read / acknowledged."""
    sim_resp = await WatchlistService.simulate_alert(
        session=db_session,
        req=type("Req", (), {"watchlist_id": None, "title": "Test Anomaly", "message": "Test note", "severity": "WARNING"}),
    )
    assert sim_resp.id is not None
    assert sim_resp.is_read is False

    # Mark as read
    updated = await WatchlistService.mark_alert_read(
        session=db_session, alert_id=sim_resp.id, is_read=True
    )
    assert updated is not None
    assert updated.is_read is True


@pytest.mark.asyncio
async def test_api_watchlist_crud_endpoints(api_client: httpx.AsyncClient):
    """Test REST API for creating, listing, getting, and deleting watchlists."""
    test_id = uuid.uuid4().hex[:6]
    payload = {
        "name": f"Hyperscale Cloud {test_id}",
        "sector": "Cloud Infrastructure",
        "target_entities": ["AWS", "Azure", "GCP"],
        "alert_threshold": -0.3,
        "is_active": True,
    }

    # 1. Create watchlist
    res = await api_client.post("/api/v1/watchlists", json=payload)
    assert res.status_code == 201
    created = res.json()
    wl_id = created["id"]
    assert created["name"] == payload["name"]
    assert len(created["target_entities"]) == 3

    # 2. Get watchlist by ID
    res = await api_client.get(f"/api/v1/watchlists/{wl_id}")
    assert res.status_code == 200
    assert res.json()["id"] == wl_id

    # 3. List watchlists
    res = await api_client.get("/api/v1/watchlists")
    assert res.status_code == 200
    data = res.json()
    assert any(w["id"] == wl_id for w in data["watchlists"])

    # 4. Delete watchlist
    res = await api_client.delete(f"/api/v1/watchlists/{wl_id}")
    assert res.status_code == 204

    # 5. Verify deleted
    res = await api_client.get(f"/api/v1/watchlists/{wl_id}")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_api_alerts_feed_and_simulate(api_client: httpx.AsyncClient):
    """Test simulating alerts, querying alert feed with filters, and marking read."""
    # 1. Simulate alert
    sim_res = await api_client.post(
        "/api/v1/alerts/simulate",
        json={"title": "Grid Storage Subsidy Shift", "message": "Federal subsidy update.", "severity": "WARNING"},
    )
    assert sim_res.status_code == 201
    alert_data = sim_res.json()
    alert_id = alert_data["id"]
    assert alert_data["severity"] == "WARNING"
    assert alert_data["is_read"] is False

    # 2. Query alerts feed
    feed_res = await api_client.get("/api/v1/alerts?limit=10")
    assert feed_res.status_code == 200
    feed = feed_res.json()
    assert feed["total"] >= 1
    assert feed["unread_count"] >= 1

    # 3. Mark read
    patch_res = await api_client.patch(
        f"/api/v1/alerts/{alert_id}/read",
        json={"is_read": True},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["is_read"] is True
