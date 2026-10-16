"""
Disposable Development Database Reset Utility.
Drops and recreates all tables in the development database using Alembic.
Fails immediately if executed in a production environment.
"""

import sys

from alembic import command
from alembic.config import Config

from backend.app.core.config import get_settings


def reset_dev_database() -> None:
    settings = get_settings()

    if settings.ENVIRONMENT.lower() == "production":
        print(
            "ERROR: Cannot reset database in production environment!", file=sys.stderr
        )
        sys.exit(1)

    print(
        f"Resetting disposable database: {settings.POSTGRES_DB} on {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}..."
    )
    alembic_cfg = Config("alembic.ini")

    # Step 1: Downgrade all migrations to base (drops all schema entities)
    print("Executing Alembic downgrade to base...")
    command.downgrade(alembic_cfg, "base")

    # Step 2: Upgrade to head (recreates clean schema)
    print("Executing Alembic upgrade to head...")
    command.upgrade(alembic_cfg, "head")

    print("Database reset completed successfully. Clean schema ready.")


if __name__ == "__main__":
    reset_dev_database()
