"""
Webhook Subscriptions & Delivery Logs API Endpoints.
Provides RESTful APIs for managing external webhook endpoints, inspecting delivery audit trails,
and dispatching test ping payloads.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_async_session
from backend.app.schemas.webhook import (
    WebhookCreateRequest,
    WebhookDeliveryListResponse,
    WebhookDeliveryResponse,
    WebhookListResponse,
    WebhookResponse,
    WebhookTestRequest,
    WebhookUpdateRequest,
)
from backend.app.services.webhook_service import WebhookService

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_async_session)]


@router.get(
    "/webhooks",
    response_model=WebhookListResponse,
    summary="List Webhook Subscriptions",
    description="Retrieves all registered external webhook subscriptions with delivery metrics.",
)
async def list_subscriptions(db: SessionDep) -> WebhookListResponse:
    return await WebhookService.list_subscriptions(session=db)


@router.post(
    "/webhooks",
    response_model=WebhookResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Webhook Subscription",
    description="Registers a new external webhook destination with HMAC signing key.",
)
async def create_subscription(
    request: WebhookCreateRequest,
    db: SessionDep,
) -> WebhookResponse:
    return await WebhookService.create_subscription(session=db, req=request)


@router.get(
    "/webhooks/{subscription_id}",
    response_model=WebhookResponse,
    summary="Get Webhook Subscription",
    description="Fetches a specific webhook subscription by ID.",
)
async def get_subscription(
    subscription_id: uuid.UUID,
    db: SessionDep,
) -> WebhookResponse:
    sub = await WebhookService.get_subscription(session=db, subscription_id=subscription_id)
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Webhook subscription '{subscription_id}' not found.",
        )
    return sub


@router.patch(
    "/webhooks/{subscription_id}",
    response_model=WebhookResponse,
    summary="Update Webhook Subscription",
    description="Modifies a subscription's target URL, active status, or event filters.",
)
async def update_subscription(
    subscription_id: uuid.UUID,
    request: WebhookUpdateRequest,
    db: SessionDep,
) -> WebhookResponse:
    updated = await WebhookService.update_subscription(
        session=db, subscription_id=subscription_id, req=request
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Webhook subscription '{subscription_id}' not found.",
        )
    return updated


@router.delete(
    "/webhooks/{subscription_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Webhook Subscription",
    description="Deletes a webhook subscription and its historical delivery logs.",
)
async def delete_subscription(
    subscription_id: uuid.UUID,
    db: SessionDep,
) -> None:
    deleted = await WebhookService.delete_subscription(
        session=db, subscription_id=subscription_id
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Webhook subscription '{subscription_id}' not found.",
        )


@router.post(
    "/webhooks/{subscription_id}/test",
    response_model=WebhookDeliveryResponse,
    summary="Test Webhook Dispatch Ping",
    description="Dispatches a test HMAC-signed event to verify external endpoint connectivity.",
)
async def test_dispatch(
    subscription_id: uuid.UUID,
    request: WebhookTestRequest,
    db: SessionDep,
) -> WebhookDeliveryResponse:
    delivery = await WebhookService.test_dispatch(
        session=db, subscription_id=subscription_id, event_type=request.event_type
    )
    if not delivery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Webhook subscription '{subscription_id}' not found.",
        )
    return delivery


@router.get(
    "/webhooks/{subscription_id}/deliveries",
    response_model=WebhookDeliveryListResponse,
    summary="Get Delivery Audit Logs for Subscription",
    description="Retrieves historical dispatch logs, latency, and response bodies for a subscription.",
)
async def get_deliveries_for_subscription(
    subscription_id: uuid.UUID,
    db: SessionDep,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> WebhookDeliveryListResponse:
    return await WebhookService.get_deliveries(
        session=db, subscription_id=subscription_id, limit=limit, offset=offset
    )


@router.get(
    "/webhooks/deliveries/all",
    response_model=WebhookDeliveryListResponse,
    summary="Get All Delivery Audit Logs",
    description="Retrieves chronological dispatch logs across all registered webhook subscriptions.",
)
async def get_all_deliveries(
    db: SessionDep,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> WebhookDeliveryListResponse:
    return await WebhookService.get_deliveries(
        session=db, subscription_id=None, limit=limit, offset=offset
    )
