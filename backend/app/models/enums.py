"""
Domain Enums for Stratify AI State Machines.
"""

from enum import Enum


class JobStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    PARTIALLY_COMPLETED = "PARTIALLY_COMPLETED"
    FAILED = "FAILED"


class TaskStatus(str, Enum):
    PENDING = "PENDING"
    DISPATCHED = "DISPATCHED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class TaskType(str, Enum):
    MARKET_OVERVIEW = "MARKET_OVERVIEW"
    COMPETITOR_ANALYSIS = "COMPETITOR_ANALYSIS"
    CUSTOMER_INSIGHTS = "CUSTOMER_INSIGHTS"
    REGULATORY_RISKS = "REGULATORY_RISKS"


class ReportStatus(str, Enum):
    DRAFT = "DRAFT"
    FINAL = "FINAL"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class OutboxStatus(str, Enum):
    PENDING = "PENDING"
    PUBLISHED = "PUBLISHED"
    FAILED = "FAILED"
