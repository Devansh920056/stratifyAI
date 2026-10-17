"""
Stage 6: Real Web Evidence Retrieval Integration Tests.
Verifies:
1. Tavily Search API client parsing, error mapping (401, 429, 500, timeout).
2. Sanitization, URL validation, parameter stripping, and deduplication.
3. Search provider factory resolution (live vs honest mock fallback).
4. End-to-end worker integration saving genuine web evidence to PostgreSQL.
"""

import json
import uuid

import httpx
import pytest
from sqlalchemy import select

from backend.app.broker.schemas import TaskMessage
from backend.app.core.config import Settings
from backend.app.db.session import AsyncSessionLocal
from backend.app.models.enums import TaskStatus, TaskType
from backend.app.models.evidence import Evidence
from backend.app.models.job import Job
from backend.app.models.task import Task
from backend.app.models.task_result import TaskResult
from backend.app.providers.search.base import (
    SearchAuthError,
    SearchProviderError,
    SearchRateLimitError,
    SearchResult,
    SearchTimeoutError,
)
from backend.app.providers.search.factory import get_search_provider
from backend.app.providers.search.mock import MockSearchProvider
from backend.app.providers.search.sanitizer import (
    deduplicate_results,
    normalize_url,
    results_to_evidence,
    sanitize_snippet,
    validate_url,
)
from backend.app.providers.search.tavily import (
    TAVILY_API_ENDPOINT,
    TavilySearchProvider,
)
from workers.processor import TaskProcessor

# ==============================================================================
# 1. Tavily Search Provider Unit Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_tavily_search_success():
    """Verify TavilySearchProvider parses HTTP 200 payload into SearchResult objects."""
    mock_payload = {
        "query": "lithium sulfur battery commercialization 2025",
        "results": [
            {
                "title": "Breakthrough in Lithium-Sulfur Battery Durability",
                "url": "https://techcrunch.com/2024/11/01/lithium-sulfur-battery-breakthrough/?utm_source=rss",
                "content": "<p>Researchers achieve 1,500 charge cycles in prototype solid-state cells.</p>",
                "score": 0.94,
                "published_date": "2024-11-01T14:00:00Z",
            },
            {
                "title": "Global Energy Storage Outlook",
                "url": "https://www.bloomberg.com/news/articles/2024-10-15/battery-storage",
                "content": "Next-gen chemistries threaten lithium-ion market dominance by 2030.",
                "score": 0.88,
                "published_date": "2024-10-15T09:30:00Z",
            },
        ],
        "response_time": 0.45,
    }

    def mock_handler(request: httpx.Request) -> httpx.Response:
        assert request.url == TAVILY_API_ENDPOINT
        body = json.loads(request.content)
        assert body["api_key"] == "test-api-key"
        assert "lithium sulfur" in body["query"]
        return httpx.Response(200, json=mock_payload)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = TavilySearchProvider(
            api_key="test-api-key",
            client=client,
        )
        assert provider.provider_name == "tavily"

        results = await provider.search("lithium sulfur battery commercialization 2025")
        assert len(results) == 2
        assert results[0].title == "Breakthrough in Lithium-Sulfur Battery Durability"
        assert results[0].score == 0.94
        assert results[0].published_date == "2024-11-01T14:00:00Z"
        assert results[1].url.startswith("https://www.bloomberg.com")


@pytest.mark.asyncio
async def test_tavily_search_auth_failure():
    """Verify HTTP 401 raises SearchAuthError."""

    def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            401, json={"error": "Unauthorized: Invalid API key provided"}
        )

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = TavilySearchProvider(api_key="invalid-key", client=client)
        with pytest.raises(SearchAuthError) as exc_info:
            await provider.search("market sizing")
        assert "authentication failed" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_tavily_search_rate_limit():
    """Verify HTTP 429 raises SearchRateLimitError."""

    def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, text="Rate limit exceeded: quota exhausted")

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = TavilySearchProvider(api_key="test-key", client=client)
        with pytest.raises(SearchRateLimitError):
            await provider.search("market query")


@pytest.mark.asyncio
async def test_tavily_search_server_error():
    """Verify HTTP 500 raises SearchProviderError."""

    def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="Internal Server Error")

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = TavilySearchProvider(api_key="test-key", client=client)
        with pytest.raises(SearchProviderError) as exc_info:
            await provider.search("market query")
        assert "server error (500)" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_tavily_search_timeout():
    """Verify request timeout raises SearchTimeoutError."""

    def mock_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("Socket read timed out")

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = TavilySearchProvider(
            api_key="test-key", timeout_seconds=1.0, client=client
        )
        with pytest.raises(SearchTimeoutError):
            await provider.search("market query")


@pytest.mark.asyncio
async def test_tavily_empty_query_returns_empty_list():
    """Verify empty or whitespace query returns immediately without sending network request."""
    provider = TavilySearchProvider(api_key="test-key")
    assert await provider.search("") == []
    assert await provider.search("   ") == []


# ==============================================================================
# 2. Sanitization, URL Validation & Deduplication Tests
# ==============================================================================


def test_url_validation_and_normalization():
    """Verify URL validator and tracking parameter stripping."""
    # Invalid URLs
    assert validate_url("") is False
    assert validate_url("ftp://not-http.com") is False
    assert validate_url("just-a-string") is False
    assert validate_url("http://") is False

    # Valid URLs
    assert validate_url("https://www.reuters.com/business") is True
    assert validate_url("http://localhost:8000/api") is True

    # Normalization & UTM stripping
    dirty = "https://example.com/research/article/?utm_source=google&utm_medium=cpc&real_param=123#heading"
    normalized = normalize_url(dirty)
    assert "utm_source" not in normalized
    assert "utm_medium" not in normalized
    assert "real_param=123" in normalized
    assert "#heading" not in normalized


def test_snippet_sanitization():
    """Verify HTML tag stripping and whitespace normalization."""
    html_snippet = "<div><p>Rapid growth in <b>semiconductor</b> manufacturing.</p>   \n\n<span>Source: IDC</span></div>"
    clean = sanitize_snippet(html_snippet)
    assert "<" not in clean
    assert ">" not in clean
    assert clean == "Rapid growth in semiconductor manufacturing. Source: IDC"

    # Truncation boundary
    long_text = "word " * 600
    truncated = sanitize_snippet(long_text, max_chars=100)
    assert len(truncated) <= 103  # 100 chars + "..."
    assert truncated.endswith("...")


def test_deduplicate_results_keeps_highest_score():
    """Verify results with matching normalized URLs are deduped by highest score."""
    results = [
        SearchResult(
            title="First Version",
            url="https://example.com/report?utm_source=twitter",
            content="Lower confidence version",
            score=0.72,
        ),
        SearchResult(
            title="Updated Version",
            url="https://example.com/report?utm_source=linkedin",
            content="Higher confidence version",
            score=0.95,
        ),
        SearchResult(
            title="Distinct Source",
            url="https://other.com/insight",
            content="Independent evidence",
            score=0.88,
        ),
    ]

    deduped = deduplicate_results(results)
    assert len(deduped) == 2
    by_url = {item.url: item for item in deduped}
    assert "https://example.com/report" in by_url
    assert by_url["https://example.com/report"].score == 0.95
    assert by_url["https://example.com/report"].content == "Higher confidence version"


def test_results_to_evidence_conversion():
    """Verify SearchResult list transforms into Evidence ORM models with SHA256 hashes."""
    task_id = uuid.uuid4()
    job_id = uuid.uuid4()

    raw_results = [
        SearchResult(
            title="Commercial Aviation Sizing",
            url="https://aviation-intelligence.org/reports/tam-2024",
            content="Market valued at $210B.",
            score=0.91,
            published_date="2024-02-01T00:00:00Z",
        )
    ]

    evidence_items = results_to_evidence(
        results=raw_results,
        task_id=task_id,
        job_id=job_id,
        provider_name="tavily",
    )

    assert len(evidence_items) == 1
    ev = evidence_items[0]
    assert ev.task_id == task_id
    assert ev.job_id == job_id
    assert ev.provider_name == "tavily"
    assert ev.source_url == "https://aviation-intelligence.org/reports/tam-2024"
    assert len(ev.url_hash) == 64
    assert ev.provider_metadata["relevance_score"] == 0.91
    assert ev.provider_metadata["published_date"] == "2024-02-01T00:00:00Z"


# ==============================================================================
# 3. Provider Factory Resolution Tests
# ==============================================================================


def test_factory_resolves_mock_provider():
    """Verify factory returns MockSearchProvider when configured as mock."""
    mock_settings = Settings(SEARCH_PROVIDER="mock", TAVILY_API_KEY=None)
    provider = get_search_provider(mock_settings)
    assert isinstance(provider, MockSearchProvider)
    assert provider.provider_name == "mock"


def test_factory_resolves_tavily_provider_with_key():
    """Verify factory returns TavilySearchProvider when key is present."""
    live_settings = Settings(
        SEARCH_PROVIDER="tavily", TAVILY_API_KEY="tvly-secret-12345"
    )
    provider = get_search_provider(live_settings)
    assert isinstance(provider, TavilySearchProvider)
    assert provider.provider_name == "tavily"


def test_factory_honest_fallback_when_key_missing():
    """Verify factory falls back to MockSearchProvider when Tavily key is empty."""
    missing_key_settings = Settings(SEARCH_PROVIDER="tavily", TAVILY_API_KEY=None)
    provider = get_search_provider(missing_key_settings)
    assert isinstance(provider, MockSearchProvider)
    assert provider.provider_name == "mock"


# ==============================================================================
# 4. Worker Integration Tests with Search Providers
# ==============================================================================


@pytest.mark.asyncio
async def test_worker_processes_with_mock_search_provider():
    """
    Verify TaskProcessor integrates with MockSearchProvider,
    retrieves evidence, and commits Evidence and TaskResult to PostgreSQL.
    """
    async with AsyncSessionLocal() as session:
        job = Job(
            research_question="Next-gen sodium-ion battery market entry",
            target_market="Energy Storage",
            geography="Global",
        )
        session.add(job)
        await session.flush()

        task = Task(
            job_id=job.id,
            task_type=TaskType.MARKET_OVERVIEW.value,
            search_queries=[
                "sodium-ion battery TAM 2025 to 2030",
                "cost per kilowatt hour sodium ion versus LFP",
            ],
            status=TaskStatus.DISPATCHED.value,
            version=1,
        )
        session.add(task)
        await session.commit()

        task_msg = TaskMessage(
            task_id=task.id,
            job_id=job.id,
            task_type=task.task_type,
            search_queries=task.search_queries,
            version=task.version,
        )

        mock_provider = MockSearchProvider()
        success, reason = await TaskProcessor.process_task(
            session=session,
            task_message=task_msg,
            search_provider=mock_provider,
        )

        assert success is True
        assert reason == "completed"

        # Check DB evidence items
        ev_items = (
            await session.scalars(select(Evidence).where(Evidence.task_id == task.id))
        ).all()
        assert len(ev_items) >= 2
        for ev in ev_items:
            assert ev.provider_name == "mock"
            assert validate_url(ev.source_url) is True
            assert len(ev.url_hash) == 64
            assert len(ev.snippet) > 20

        # Check DB task result citations
        result = await session.scalar(
            select(TaskResult).where(TaskResult.task_id == task.id)
        )
        assert result is not None
        assert len(result.citations) >= 2
        # Citations must match persisted evidence URLs
        ev_urls = {ev.source_url for ev in ev_items}
        for citation in result.citations:
            assert citation["url"] in ev_urls


@pytest.mark.asyncio
async def test_worker_processes_with_live_tavily_search_provider():
    """
    Verify TaskProcessor integrates with TavilySearchProvider,
    persisting external URLs from Tavily response directly into PostgreSQL Evidence table.
    """
    mock_tavily_response = {
        "query": "commercial drone logistics regulations FAA part 135",
        "results": [
            {
                "title": "FAA Grants Part 135 Certification for Autonomous Cargo Drones",
                "url": "https://www.federalaviation-news.gov/part-135-cargo-drone-ruling",
                "content": "Autonomous delivery drones approved for beyond-visual-line-of-sight operations.",
                "score": 0.98,
                "published_date": "2024-09-12T10:00:00Z",
            },
            {
                "title": "Logistics Giants Accelerate Drone Fleet Deployments",
                "url": "https://www.supplychaindive.com/news/drone-delivery-part-135-ups-wing",
                "content": "Investment in drone fulfillment hubs surges 42% year over year.",
                "score": 0.91,
                "published_date": "2024-09-20T16:45:00Z",
            },
        ],
        "response_time": 0.38,
    }

    def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=mock_tavily_response)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as http_client:
        tavily_provider = TavilySearchProvider(
            api_key="tvly-mock-live-key",
            client=http_client,
        )

        async with AsyncSessionLocal() as session:
            job = Job(
                research_question="FAA Part 135 commercial drone delivery logistics",
                target_market="Air Logistics",
                geography="North America",
            )
            session.add(job)
            await session.flush()

            task = Task(
                job_id=job.id,
                task_type=TaskType.REGULATORY_RISKS.value,
                search_queries=["commercial drone logistics regulations FAA part 135"],
                status=TaskStatus.DISPATCHED.value,
                version=1,
            )
            session.add(task)
            await session.commit()

            task_msg = TaskMessage(
                task_id=task.id,
                job_id=job.id,
                task_type=task.task_type,
                search_queries=task.search_queries,
                version=task.version,
            )

            success, reason = await TaskProcessor.process_task(
                session=session,
                task_message=task_msg,
                search_provider=tavily_provider,
            )

            assert success is True
            assert reason == "completed"

            # Check DB evidence records have live provider name and external URLs
            ev_items = (
                await session.scalars(
                    select(Evidence).where(Evidence.task_id == task.id)
                )
            ).all()
            assert len(ev_items) == 2
            assert all(ev.provider_name == "tavily" for ev in ev_items)

            urls = [ev.source_url for ev in ev_items]
            assert (
                "https://www.federalaviation-news.gov/part-135-cargo-drone-ruling"
                in urls
            )
            assert (
                "https://www.supplychaindive.com/news/drone-delivery-part-135-ups-wing"
                in urls
            )

            # Check TaskResult model reflects external provider citations
            result = await session.scalar(
                select(TaskResult).where(TaskResult.task_id == task.id)
            )
            assert result is not None
            assert result.model_name == "tavily-grounder-v1"
            assert (
                result.citations[0]["url"]
                == "https://www.federalaviation-news.gov/part-135-cargo-drone-ruling"
            )
