"""
Database Base Class and Metadata for SQLAlchemy 2.0 Declarative Models.
"""

from datetime import datetime, timezone
from typing import Any
from sqlalchemy import DateTime, MetaData
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Standard naming convention for constraints to ensure deterministic Alembic migrations
POSTGRES_NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def utc_now() -> datetime:
    """Generate timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    """Declarative Base containing common metadata and helpers."""
    metadata = MetaData(naming_convention=POSTGRES_NAMING_CONVENTION)

    # Automatically map timezone-aware datetime types
    type_annotation_map = {
        datetime: DateTime(timezone=True)
    }
