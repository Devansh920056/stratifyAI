"""
Stage 7 Real-Time Webhook & Notification Dispatcher Tests.
Verifies:
1. WebhookSubscription and WebhookDelivery models with cascade deletion.
2. HMAC-SHA256 signature generation and event payload dispatching.
3. Event type filtering (e.g. alert.critical vs alert.warning).
4. REST API endpoints:
   - GET /api/v1/webhooks
   - POST /api/v1/webhooks
   - GET /api/v1/webhooks/{id}
   - PATCH /api/v1/webhooks/{id}
   - DELETE /api/v1/webhooks/{id}
   - POST /api/v1/webhooks/{id}/test
   - GET /api/v1/webhooks/{id}/deliveries
"""

import hashlib
import hmac
import json
import uuid
from unittest.mock import AsyncMock, patch

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.base import utc_now
from backend.app.db.session import AsyncSessionLocal
from backend.app.main import app
from backend.app.models.webhook import WebhookDelivery, WebhookSubscription
from backend.app.schemas.webhook import WebhookCreateRequest
from backend.app.services.webhook_service import WebhookService


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
async def test_webhook_subscription_crud_and_cascade(db_session: AsyncSession):
    """Test creating WebhookSubscription and linked WebhookDelivery with cascade deletion."""
    test_id = uuid.uuid4().hex[:6]
    sub = WebhookSubscription(
        name=f"Slack Alert Bot {test_id}",
        target_url="https://hooks.slack.com/services/T00/B00/X00",
        secret_token="test_secret_key_123",
        event_types=["alert.critical", "alert.warning"],
        is_active=True,
    )
    db_session.add(sub)
    await db_session.commit()
    await db_session.refresh(sub)

    assert sub.id is not None
    assert sub.name == f"Slack Alert Bot {test_id}"

    # Add a delivery log linked to this subscription
    delivery = WebhookDelivery(
        subscription_id=sub.id,
        event_type="alert.critical",
        payload={"alert_id": "123", "message": "Critical competitor anomaly"},
        status_code=200,
        response_body="ok",
        duration_ms=45,
        is_success=True,
    )
    db_session.add(delivery)
    await db_session.commit()
    await db_session.refresh(delivery)

    assert delivery.id is not None
    assert delivery.subscription_id == sub.id
    assert delivery.is_success is True

    # Delete subscription and verify cascade deletion of delivery logs
    await db_session.delete(sub)
    await db_session.commit()

    deleted = await db_session.scalar(
        select(WebhookDelivery).where(WebhookDelivery.id == delivery.id)
    )
    assert deleted is None


@pytest.mark.asyncio
async def test_webhook_service_dispatch_and_hmac_signature(db_session: AsyncSession):
    """Verify HMAC-SHA256 signature generation and event payload dispatching."""
    secret = "my_custom_hmac_secret_456"
    unique_event = f"alert.critical.{uuid.uuid4().hex[:6]}"
    req = WebhookCreateRequest(
        name=f"Enterprise SIEM {uuid.uuid4().hex[:6]}",
        target_url="https://siem.example.com/api/v1/stratify-events",
        secret_token=secret,
        event_types=[unique_event],
        is_active=True,
    )
    sub_resp = await WebhookService.create_subscription(session=db_session, req=req)

    mock_resp = httpx.Response(status_code=200, text='{"received": true}')
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        deliveries = await WebhookService.dispatch_event(
            session=db_session,
            event_type=unique_event,
            payload={"severity": "CRITICAL", "entity": "CompetitorX"},
        )

        assert len(deliveries) >= 1
        d = next(item for item in deliveries if item.subscription_id == sub_resp.id)
        assert d.status_code == 200
        assert d.is_success is True

        # Verify mock HTTP call arguments
        mock_post.assert_called()
        call_kwargs = mock_post.call_args.kwargs
        headers = call_kwargs["headers"]
        assert headers["X-Stratify-Event"] == unique_event
        assert "X-Stratify-Signature" in headers

        # Verify HMAC signature calculation
        sig_header = headers["X-Stratify-Signature"]
        expected_sig = hmac.new(
            secret.encode("utf-8"),
            call_kwargs["content"].encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        assert sig_header == f"sha256={expected_sig}"

    # Clean up
    await WebhookService.delete_subscription(session=db_session, subscription_id=sub_resp.id)


@pytest.mark.asyncio
async def test_webhook_event_filtering(db_session: AsyncSession):
    """Verify subscriptions only receive events matching their event_types filter."""
    sub_crit_req = WebhookCreateRequest(
        name=f"Crit Only {uuid.uuid4().hex[:6]}",
        target_url="https://crit.example.com/hook",
        event_types=["alert.critical"],
        is_active=True,
    )
    sub_warn_req = WebhookCreateRequest(
        name=f"Warn Only {uuid.uuid4().hex[:6]}",
        target_url="https://warn.example.com/hook",
        event_types=["alert.warning"],
        is_active=True,
    )

    sub_crit = await WebhookService.create_subscription(session=db_session, req=sub_crit_req)
    sub_warn = await WebhookService.create_subscription(session=db_session, req=sub_warn_req)

    mock_resp = httpx.Response(status_code=200, text="OK")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        # Dispatch an alert.critical event
        deliveries = await WebhookService.dispatch_event(
            session=db_session,
            event_type="alert.critical",
            payload={"severity": "CRITICAL"},
        )

        delivered_sub_ids = [d.subscription_id for d in deliveries]
        assert sub_crit.id in delivered_sub_ids
        assert sub_warn.id not in delivered_sub_ids

    # Clean up
    await WebhookService.delete_subscription(session=db_session, subscription_id=sub_crit.id)
    await WebhookService.delete_subscription(session=db_session, subscription_id=sub_warn.id)


@pytest.mark.asyncio
async def test_api_webhook_endpoints(api_client: httpx.AsyncClient):
    """Test REST API for managing subscriptions, testing pings, and querying delivery logs."""
    # 1. Create subscription
    create_payload = {
        "name": "Discord Exec Channel",
        "target_url": "https://discord.com/api/webhooks/123/xyz",
        "event_types": ["alert.critical", "recommendation.approved"],
        "is_active": True,
    }
    create_res = await api_client.post("/api/v1/webhooks", json=create_payload)
    assert create_res.status_code == 201
    sub_data = create_res.json()
    sub_id = sub_data["id"]
    assert sub_data["name"] == create_payload["name"]

    # 2. Get subscription by ID
    get_res = await api_client.get(f"/api/v1/webhooks/{sub_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == sub_id

    # 3. List subscriptions
    list_res = await api_client.get("/api/v1/webhooks")
    assert list_res.status_code == 200
    data = list_res.json()
    assert any(s["id"] == sub_id for s in data["subscriptions"])

    # 4. Patch subscription
    patch_res = await api_client.patch(
        f"/api/v1/webhooks/{sub_id}",
        json={"name": "Discord Exec Channel Renamed", "is_active": False},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["name"] == "Discord Exec Channel Renamed"
    assert patch_res.json()["is_active"] is False

    # 5. Test dispatch ping
    test_res = await api_client.post(
        f"/api/v1/webhooks/{sub_id}/test",
        json={"event_type": "alert.critical"},
    )
    assert test_res.status_code == 200
    delivery_data = test_res.json()
    assert delivery_data["subscription_id"] == sub_id

    # 6. Get deliveries for subscription
    deliv_res = await api_client.get(f"/api/v1/webhooks/{sub_id}/deliveries")
    assert deliv_res.status_code == 200
    assert deliv_res.json()["total"] >= 1

    # 7. Delete subscription
    del_res = await api_client.delete(f"/api/v1/webhooks/{sub_id}")
    assert del_res.status_code == 204

    # 8. Verify deleted
    get_deleted = await api_client.get(f"/api/v1/webhooks/{sub_id}")
    assert get_deleted.status_code == 404
