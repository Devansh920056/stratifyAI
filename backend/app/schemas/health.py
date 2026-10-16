"""
Pydantic Schemas for Health and Readiness Probes.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(..., description="'healthy' or 'unhealthy'")
    version: str = Field(..., description="API Version")
    timestamp: datetime = Field(..., description="Current UTC timestamp")
    components: dict[str, str] = Field(
        default_factory=dict, description="Health status of downstream dependencies"
    )
