"""
Real-Time Webhook Dispatcher Service.
Delivers HMAC-SHA256 authenticated event notifications to external Slack, Discord,
or enterprise endpoints with delivery audit trails and latency tracking.
"""

import hashlib
import hmac
import json
import logging
import secrets
import time
import uuid
from typing import Any, Optional

import httpx
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.db.base import utc_now
from backend.app.models.webhook import WebhookDelivery, WebhookSubscription
from backend.app.schemas.webhook import (
    WebhookCreateRequest,
    WebhookDeliveryListResponse,
    WebhookDeliveryResponse,
    WebhookListResponse,
    WebhookResponse,
    WebhookUpdateRequest,
)

logger = logging.getLogger("stratify.services.webhook")


class WebhookService:
    """
    Manages webhook subscriptions and delivers signed HTTP POST payloads.
    """

    @classmethod
    async def list_subscriptions(cls, session: AsyncSession) -> WebhookListResponse:
        """
        Retrieves all webhook subscriptions enriched with delivery metrics.
        """
        stmt = (
            select(WebhookSubscription)
            .options(selectinload(WebhookSubscription.deliveries))
            .order_by(WebhookSubscription.created_at.desc())
        )
        res = await session.execute(stmt)
        subs = res.scalars().all()

        items: list[WebhookResponse] = []
        for s in subs:
            deliveries = s.deliveries or []
            total = len(deliveries)
            success = sum(1 for d in deliveries if d.is_success)
            failed = total - success
            rate = round((success / total) * 100.0, 1) if total > 0 else 100.0

            items.append(
                WebhookResponse(
                    id=s.id,
                    name=s.name,
                    target_url=s.target_url,
                    event_types=s.event_types or [],
                    is_active=s.is_active,
                    total_deliveries=total,
                    successful_deliveries=success,
                    failed_deliveries=failed,
                    success_rate=rate,
                    created_at=s.created_at,
                    updated_at=s.updated_at,
                )
            )

        return WebhookListResponse(subscriptions=items, total=len(items))

    @classmethod
    async def create_subscription(
        cls, session: AsyncSession, req: WebhookCreateRequest
    ) -> WebhookResponse:
        """
        Creates a new webhook subscription with HMAC secret.
        """
        secret = req.secret_token or secrets.token_hex(20)
        events = req.event_types if req.event_types else ["*"]

        sub = WebhookSubscription(
            name=req.name.strip(),
            target_url=req.target_url.strip(),
            secret_token=secret,
            event_types=events,
            is_active=req.is_active,
        )
        session.add(sub)
        await session.commit()
        await session.refresh(sub)

        return WebhookResponse(
            id=sub.id,
            name=sub.name,
            target_url=sub.target_url,
            event_types=sub.event_types,
            is_active=sub.is_active,
            total_deliveries=0,
            successful_deliveries=0,
            failed_deliveries=0,
            success_rate=100.0,
            created_at=sub.created_at,
            updated_at=sub.updated_at,
        )

    @classmethod
    async def get_subscription(
        cls, session: AsyncSession, subscription_id: uuid.UUID
    ) -> Optional[WebhookResponse]:
        """
        Retrieves a single subscription by ID.
        """
        stmt = (
            select(WebhookSubscription)
            .options(selectinload(WebhookSubscription.deliveries))
            .where(WebhookSubscription.id == subscription_id)
        )
        sub = (await session.execute(stmt)).scalar_one_or_none()
        if not sub:
            return None

        deliveries = sub.deliveries or []
        total = len(deliveries)
        success = sum(1 for d in deliveries if d.is_success)
        failed = total - success
        rate = round((success / total) * 100.0, 1) if total > 0 else 100.0

        return WebhookResponse(
            id=sub.id,
            name=sub.name,
            target_url=sub.target_url,
            event_types=sub.event_types or [],
            is_active=sub.is_active,
            total_deliveries=total,
            successful_deliveries=success,
            failed_deliveries=failed,
            success_rate=rate,
            created_at=sub.created_at,
            updated_at=sub.updated_at,
        )

    @classmethod
    async def update_subscription(
        cls,
        session: AsyncSession,
        subscription_id: uuid.UUID,
        req: WebhookUpdateRequest,
    ) -> Optional[WebhookResponse]:
        """
        Updates an existing subscription's properties.
        """
        sub = await session.get(WebhookSubscription, subscription_id)
        if not sub:
            return None

        if req.name is not None:
            sub.name = req.name.strip()
        if req.target_url is not None:
            sub.target_url = req.target_url.strip()
        if req.event_types is not None:
            sub.event_types = req.event_types
        if req.is_active is not None:
            sub.is_active = req.is_active

        sub.updated_at = utc_now()
        await session.commit()
        await session.refresh(sub)

        return await cls.get_subscription(session, subscription_id)

    @classmethod
    async def delete_subscription(
        cls, session: AsyncSession, subscription_id: uuid.UUID
    ) -> bool:
        """
        Deletes a subscription and its delivery logs.
        """
        sub = await session.get(WebhookSubscription, subscription_id)
        if not sub:
            return False

        await session.delete(sub)
        await session.commit()
        return True

    @classmethod
    async def dispatch_event(
        cls,
        session: AsyncSession,
        event_type: str,
        payload: dict[str, Any],
    ) -> list[WebhookDelivery]:
        """
        Dispatches an event payload to all matching active webhook subscriptions.
        Generates HMAC-SHA256 signature and records delivery logs.
        """
        # Fetch active subscriptions
        stmt = select(WebhookSubscription).where(WebhookSubscription.is_active == True)
        subs = (await session.scalars(stmt)).all()

        matching_subs: list[WebhookSubscription] = []
        for s in subs:
            types = s.event_types or []
            if "*" in types or event_type in types:
                matching_subs.append(s)

        if not matching_subs:
            return []

        deliveries: list[WebhookDelivery] = []
        timestamp_str = utc_now().isoformat()

        envelope = {
            "id": str(uuid.uuid4()),
            "event": event_type,
            "timestamp": timestamp_str,
            "data": payload,
        }
        encoded_body = json.dumps(envelope, default=str)

        for sub in matching_subs:
            # Generate HMAC-SHA256 signature
            signature = hmac.new(
                sub.secret_token.encode("utf-8"),
                encoded_body.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()

            headers = {
                "Content-Type": "application/json",
                "User-Agent": "StratifyAI-WebhookDispatcher/2.0",
                "X-Stratify-Event": event_type,
                "X-Stratify-Timestamp": timestamp_str,
                "X-Stratify-Signature": f"sha256={signature}",
            }

            status_code: Optional[int] = None
            response_body: Optional[str] = None
            error_msg: Optional[str] = None
            is_success = False

            start_time = time.monotonic()
            try:
                async with httpx.AsyncClient(timeout=4.0) as client:
                    resp = await client.post(sub.target_url, content=encoded_body, headers=headers)
                    status_code = resp.status_code
                    response_body = resp.text[:1000]
                    is_success = 200 <= resp.status_code < 300
            except Exception as e:
                error_msg = str(e)
                logger.info(f"Webhook dispatch to '{sub.target_url}' deferred ({e}).")

            duration_ms = int((time.monotonic() - start_time) * 1000)

            delivery = WebhookDelivery(
                subscription_id=sub.id,
                event_type=event_type,
                payload=envelope,
                status_code=status_code,
                response_body=response_body,
                error_message=error_msg,
                duration_ms=duration_ms,
                is_success=is_success,
                delivered_at=utc_now(),
            )
            session.add(delivery)
            deliveries.append(delivery)

        await session.commit()
        for d in deliveries:
            await session.refresh(d)

        logger.info(f"Dispatched event '{event_type}' to {len(deliveries)} webhook destinations.")
        return deliveries

    @classmethod
    async def get_deliveries(
        cls,
        session: AsyncSession,
        subscription_id: Optional[uuid.UUID] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> WebhookDeliveryListResponse:
        """
        Retrieves recent webhook dispatch logs.
        """
        stmt = select(WebhookDelivery).order_by(WebhookDelivery.delivered_at.desc())
        count_stmt = select(func.count(WebhookDelivery.id))

        if subscription_id:
            stmt = stmt.where(WebhookDelivery.subscription_id == subscription_id)
            count_stmt = count_stmt.where(WebhookDelivery.subscription_id == subscription_id)

        total = await session.scalar(count_stmt) or 0
        stmt = stmt.limit(limit).offset(offset)
        rows = (await session.scalars(stmt)).all()

        items = [
            WebhookDeliveryResponse(
                id=d.id,
                subscription_id=d.subscription_id,
                event_type=d.event_type,
                payload=d.payload or {},
                status_code=d.status_code,
                response_body=d.response_body,
                error_message=d.error_message,
                duration_ms=d.duration_ms,
                is_success=d.is_success,
                delivered_at=d.delivered_at,
            )
            for d in rows
        ]

        return WebhookDeliveryListResponse(deliveries=items, total=total)

    @classmethod
    async def test_dispatch(
        cls,
        session: AsyncSession,
        subscription_id: uuid.UUID,
        event_type: str = "alert.critical",
    ) -> Optional[WebhookDeliveryResponse]:
        """
        Sends a test dispatch ping directly to a specific subscription.
        """
        sub = await session.get(WebhookSubscription, subscription_id)
        if not sub:
            return None

        test_payload = {
            "alert_id": str(uuid.uuid4()),
            "severity": "CRITICAL",
            "title": f"Synthetic Test Anomaly: Subscribed Webhook '{sub.name}' Verified",
            "message": "Stratify AI 2.0 Webhook Dispatcher verified end-to-end connectivity.",
            "test_mode": True,
        }

        timestamp_str = utc_now().isoformat()
        envelope = {
            "id": str(uuid.uuid4()),
            "event": event_type,
            "timestamp": timestamp_str,
            "data": test_payload,
        }
        encoded_body = json.dumps(envelope, default=str)

        signature = hmac.new(
            sub.secret_token.encode("utf-8"),
            encoded_body.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "StratifyAI-WebhookDispatcher/2.0",
            "X-Stratify-Event": event_type,
            "X-Stratify-Timestamp": timestamp_str,
            "X-Stratify-Signature": f"sha256={signature}",
        }

        status_code: Optional[int] = None
        response_body: Optional[str] = None
        error_msg: Optional[str] = None
        is_success = False

        start_time = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.post(sub.target_url, content=encoded_body, headers=headers)
                status_code = resp.status_code
                response_body = resp.text[:1000]
                is_success = 200 <= resp.status_code < 300
        except Exception as e:
            error_msg = str(e)

        duration_ms = int((time.monotonic() - start_time) * 1000)

        delivery = WebhookDelivery(
            subscription_id=sub.id,
            event_type=event_type,
            payload=envelope,
            status_code=status_code,
            response_body=response_body,
            error_message=error_msg,
            duration_ms=duration_ms,
            is_success=is_success,
            delivered_at=utc_now(),
        )
        session.add(delivery)
        await session.commit()
        await session.refresh(delivery)

        return WebhookDeliveryResponse(
            id=delivery.id,
            subscription_id=delivery.subscription_id,
            event_type=delivery.event_type,
            payload=delivery.payload or {},
            status_code=delivery.status_code,
            response_body=delivery.response_body,
            error_message=delivery.error_message,
            duration_ms=delivery.duration_ms,
            is_success=delivery.is_success,
            delivered_at=delivery.delivered_at,
        )

