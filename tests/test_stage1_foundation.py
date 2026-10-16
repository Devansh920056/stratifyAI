"""
Stage 1 Infrastructure & Configuration Verification Tests.
Verifies that:
1. Environment configuration loads and validates via Pydantic Settings.
2. PostgreSQL 16 container on port 5434 is healthy and accepts connections.
3. Host PostgreSQL service on port 5432 is not interfered with.
4. RabbitMQ broker container on port 5672 is healthy and accepts AMQP connections.
5. RabbitMQ Management API on port 15672 is responsive.
"""

import socket
import pytest
import psycopg
import aio_pika
import httpx
from backend.app.core.config import get_settings


def test_settings_load_successfully():
    """Verify that settings load and derive default URLs correctly."""
    settings = get_settings()
    assert settings.ENVIRONMENT == "development"
    assert settings.POSTGRES_PORT == 5434
    assert settings.POSTGRES_USER == "stratify_admin"
    assert "stratify_admin" in settings.DATABASE_URL
    assert "5434" in settings.DATABASE_URL
    assert settings.RABBITMQ_PORT == 5672
    assert "stratify_broker" in settings.RABBITMQ_URL


def test_host_postgres_port_undisturbed():
    """Verify that port 5432 (local Homebrew PostgreSQL) is active and not interfered with."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(2.0)
    result = sock.connect_ex(("127.0.0.1", 5432))
    sock.close()
    assert result == 0, "Host PostgreSQL on port 5432 should remain active and listening"


def test_docker_postgres_connectivity():
    """Verify direct connection and query execution on Docker PostgreSQL (port 5434)."""
    settings = get_settings()
    conn_str = f"host={settings.POSTGRES_HOST} port={settings.POSTGRES_PORT} dbname={settings.POSTGRES_DB} user={settings.POSTGRES_USER} password={settings.POSTGRES_PASSWORD}"
    
    with psycopg.connect(conn_str) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT version();")
            version = cur.fetchone()[0]
            assert "PostgreSQL 16" in version


@pytest.mark.asyncio
async def test_docker_rabbitmq_amqp_connectivity():
    """Verify that RabbitMQ accepts AMQP connections and can open a channel."""
    settings = get_settings()
    connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
    assert not connection.is_closed
    
    channel = await connection.channel()
    assert not channel.is_closed
    
    await channel.close()
    await connection.close()


@pytest.mark.asyncio
async def test_docker_rabbitmq_management_api():
    """Verify that the RabbitMQ management API on port 15672 responds with 200 OK."""
    settings = get_settings()
    url = f"http://{settings.RABBITMQ_HOST}:{settings.RABBITMQ_MANAGEMENT_PORT}/api/overview"
    auth = (settings.RABBITMQ_USER, settings.RABBITMQ_PASSWORD)
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, auth=auth, timeout=5.0)
        assert response.status_code == 200
        data = response.json()
        assert "rabbitmq_version" in data
        assert data["rabbitmq_version"].startswith("3.13")
