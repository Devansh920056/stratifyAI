"""
Pydantic Schemas for Outbound Webhook Subscriptions and Delivery Logs.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class WebhookCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, description="Subscription label e.g. Slack #market-alerts")
    target_url: str = Field(..., min_length=8, max_length=1024, description="Destination HTTP/HTTPS webhook URL")
    event_types: list[str] = Field(
        default=["*"],
        description="Event filters: alert.critical, alert.warning, recommendation.approved, or '*' for all",
    )
    secret_token: str | None = Field(
        None, description="HMAC-SHA256 signature secret; generated automatically if omitted"
    )
    is_active: bool = Field(default=True, description="Active dispatch status")


class WebhookUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=150)
    target_url: str | None = Field(None, min_length=8, max_length=1024)
    event_types: list[str] | None = None
    is_active: bool | None = None


class WebhookResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Subscription UUID")
    name: str = Field(..., description="Subscription name")
    target_url: str = Field(..., description="Destination URL")
    event_types: list[str] = Field(default_factory=list, description="Subscribed event types")
    is_active: bool = Field(..., description="Active status")
    total_deliveries: int = Field(default=0, description="Total dispatches attempted")
    successful_deliveries: int = Field(default=0, description="Successful (2xx) dispatches")
    failed_deliveries: int = Field(default=0, description="Failed dispatches")
    success_rate: float = Field(default=100.0, description="Delivery success rate percentage")
    created_at: datetime = Field(..., description="Created timestamp")
    updated_at: datetime = Field(..., description="Updated timestamp")


class WebhookListResponse(BaseModel):
    subscriptions: list[WebhookResponse]
    total: int


class WebhookDeliveryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Delivery log UUID")
    subscription_id: uuid.UUID = Field(..., description="Subscription UUID")
    event_type: str = Field(..., description="Event type dispatched")
    payload: dict[str, Any] = Field(default_factory=dict, description="Dispatched JSON payload")
    status_code: int | None = Field(None, description="HTTP response code")
    response_body: str | None = Field(None, description="Truncated response text")
    error_message: str | None = Field(None, description="Network / timeout error detail")
    duration_ms: int = Field(..., description="Round-trip latency in milliseconds")
    is_success: bool = Field(..., description="Whether response code was 2xx")
    delivered_at: datetime = Field(..., description="Dispatch timestamp")


class WebhookDeliveryListResponse(BaseModel):
    deliveries: list[WebhookDeliveryResponse]
    total: int


class WebhookTestRequest(BaseModel):
    event_type: str = Field(default="alert.critical", description="Event type to simulate")
