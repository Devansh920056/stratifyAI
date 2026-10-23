from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Centralized, validated configuration for Stratify AI.
    Loads values from environment variables or .env file.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # --------------------------------------------------------------------------
    # Application & Logging
    # --------------------------------------------------------------------------
    ENVIRONMENT: str = Field(
        default="development",
        description="Environment mode: development | test | production",
    )
    LOG_LEVEL: str = Field(default="INFO", description="Standard logging level")
    API_HOST: str = Field(default="127.0.0.1", description="FastAPI bind address")
    API_PORT: int = Field(default=8000, description="FastAPI bind port")
    CORS_ORIGINS: list[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"],
        description="Allowed CORS origin domains",
    )

    # --------------------------------------------------------------------------
    # PostgreSQL Configuration
    # --------------------------------------------------------------------------
    POSTGRES_USER: str = Field(default="stratify_admin")
    POSTGRES_PASSWORD: str = Field(default="stratify_dev_secret_change_me")
    POSTGRES_DB: str = Field(default="stratify_db")
    POSTGRES_HOST: str = Field(default="127.0.0.1")
    POSTGRES_PORT: int = Field(
        default=5434, description="Docker PostgreSQL mapped port"
    )
    DATABASE_URL: str | None = Field(
        default=None,
        description="Full connection URI. Computed from parts if not explicitly provided.",
    )

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: str | None, info) -> str:
        if isinstance(v, str) and v.strip():
            return v
        data = info.data
        user = data.get("POSTGRES_USER", "stratify_admin")
        password = data.get("POSTGRES_PASSWORD", "stratify_dev_secret_change_me")
        host = data.get("POSTGRES_HOST", "127.0.0.1")
        port = data.get("POSTGRES_PORT", 5434)
        db = data.get("POSTGRES_DB", "stratify_db")
        return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{db}"

    # --------------------------------------------------------------------------
    # RabbitMQ Broker Configuration
    # --------------------------------------------------------------------------
    RABBITMQ_USER: str = Field(default="stratify_broker")
    RABBITMQ_PASSWORD: str = Field(default="broker_dev_secret_change_me")
    RABBITMQ_HOST: str = Field(default="127.0.0.1")
    RABBITMQ_PORT: int = Field(default=5672)
    RABBITMQ_MANAGEMENT_PORT: int = Field(default=15672)
    RABBITMQ_URL: str | None = Field(
        default=None,
        description="Full AMQP connection URL. Computed from parts if not provided.",
    )

    @field_validator("RABBITMQ_URL", mode="before")
    @classmethod
    def assemble_rabbitmq_url(cls, v: str | None, info) -> str:
        if isinstance(v, str) and v.strip():
            return v
        data = info.data
        user = data.get("RABBITMQ_USER", "stratify_broker")
        password = data.get("RABBITMQ_PASSWORD", "broker_dev_secret_change_me")
        host = data.get("RABBITMQ_HOST", "127.0.0.1")
        port = data.get("RABBITMQ_PORT", 5672)
        return f"amqp://{user}:{password}@{host}:{port}/"

    # --------------------------------------------------------------------------
    # Research Providers (Search & LLM)
    # --------------------------------------------------------------------------
    SEARCH_PROVIDER: str = Field(
        default="mock", description="duckduckgo | tavily | mock"
    )
    TAVILY_API_KEY: str | None = Field(default=None)

    LLM_PROVIDER: str = Field(
        default="mock", description="gemini | smart | mock"
    )
    GEMINI_API_KEY: str | None = Field(default=None)
    LLM_MODEL: str = Field(default="gemini-1.5-flash")

    # --------------------------------------------------------------------------
    # Worker & Reliability Tuning
    # --------------------------------------------------------------------------
    WORKER_CONCURRENCY: int = Field(default=2, ge=1, le=16)
    TASK_TIMEOUT_SECONDS: int = Field(default=45, ge=5, le=300)
    MAX_TASK_RETRIES: int = Field(default=3, ge=1, le=10)
    OUTBOX_POLL_INTERVAL_SECONDS: float = Field(default=1.0, ge=0.1, le=10.0)
    AUTO_START_WORKERS: bool = Field(
        default=True,
        description="Automatically start integrated outbox relay loop and worker consumer in background",
    )


@lru_cache
def get_settings() -> Settings:
    """Singleton getter for application configuration."""
    return Settings()
