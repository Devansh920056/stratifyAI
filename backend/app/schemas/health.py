"""
Pydantic Schemas for Health, Readiness, and Telemetry Probes.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(..., description="'healthy' or 'unhealthy'")
    version: str = Field(..., description="API Version")
    timestamp: datetime = Field(..., description="Current UTC timestamp")
    components: dict[str, str] = Field(
        default_factory=dict, description="Health status of downstream dependencies"
    )


class TelemetryResponse(BaseModel):
    status: str = Field(..., description="Overall platform status")
    version: str = Field(..., description="Application version")
    timestamp: datetime = Field(..., description="Server current UTC timestamp")
    database: dict[str, Any] = Field(
        default_factory=dict, description="PostgreSQL connection and host port info"
    )
    broker: dict[str, Any] = Field(
        default_factory=dict, description="RabbitMQ topology and AMQP info"
    )
    orchestrator: dict[str, Any] = Field(
        default_factory=dict, description="OCC and outbox configuration"
    )
    ai_providers: dict[str, Any] = Field(
        default_factory=dict, description="Configured LLM and web search engines"
    )
    metrics: dict[str, int] = Field(
        default_factory=dict, description="Aggregated platform execution metrics"
    )
