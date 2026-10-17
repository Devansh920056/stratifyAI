"""
Stage 7: AI Analysis & Grounded Summaries Integration Tests.
Verifies:
1. Google Gemini LLM provider structured JSON parsing and error mapping (401, 429, 500, timeout).
2. Anti-hallucination citation guardrail preventing ungrounded URL claims.
3. LLM provider factory resolution (mock vs live vs fallback).
4. Worker research pipeline integration persisting grounded TaskResult rows in PostgreSQL.
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
from backend.app.providers.llm.base import (
    AnalysisOutput,
    Citation,
    KeyFinding,
    LLMAuthError,
    LLMProviderError,
    LLMRateLimitError,
    LLMSchemaValidationError,
    LLMTimeoutError,
)
from backend.app.providers.llm.factory import get_llm_provider
from backend.app.providers.llm.gemini import GeminiLLMProvider
from backend.app.providers.llm.mock import MockLLMProvider
from backend.app.providers.llm.prompt import validate_and_sanitize_grounding
from backend.app.providers.search.mock import MockSearchProvider
from workers.processor import TaskProcessor

# ==============================================================================
# Helper to create mock evidence
# ==============================================================================


def create_sample_evidence(task_id: uuid.UUID, job_id: uuid.UUID) -> list[Evidence]:
    return [
        Evidence(
            task_id=task_id,
            job_id=job_id,
            source_url="https://market-reports.org/next-gen-batteries-tam",
            source_title="Solid State Battery Market Forecast 2024-2032",
            snippet="The solid-state battery sector is projected to reach $8.5B by 2030, registering a 32.4% CAGR.",
            provider_name="mock",
            provider_metadata={"relevance_score": 0.95},
        ),
        Evidence(
            task_id=task_id,
            job_id=job_id,
            source_url="https://clean-tech-insights.com/solid-state-cost-curves",
            source_title="Manufacturing Cost Parity Analysis",
            snippet="Cell manufacturing costs are on track to achieve $75/kWh parity with LFP chemistries by 2028.",
            provider_name="mock",
            provider_metadata={"relevance_score": 0.91},
        ),
    ]


# ==============================================================================
# 1. Gemini Provider Unit Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_gemini_analyze_success():
    """Verify GeminiLLMProvider parses structured JSON candidate into AnalysisOutput."""
    task_id = uuid.uuid4()
    job_id = uuid.uuid4()
    evidence = create_sample_evidence(task_id, job_id)

    llm_response_json = {
        "key_findings": [
            {
                "claim": "Solid-state battery market is projected to reach $8.5B by 2030 with a 32.4% CAGR.",
                "source_url": "https://market-reports.org/next-gen-batteries-tam",
                "confidence": 0.96,
            },
            {
                "claim": "Cost parity with LFP ($75/kWh) is projected by 2028.",
                "source_url": "https://clean-tech-insights.com/solid-state-cost-curves",
                "confidence": 0.92,
            },
        ],
        "grounded_summary": (
            "Solid-state battery technologies demonstrate compelling commercial trajectory, "
            "with market size expanding to $8.5B by 2030. Accelerated manufacturing efficiencies "
            "indicate price competitiveness with legacy LFP chemistries within the next four years."
        ),
        "confidence_score": 0.94,
        "citations": [
            {
                "url": "https://market-reports.org/next-gen-batteries-tam",
                "title": "Solid State Battery Market Forecast 2024-2032",
            },
            {
                "url": "https://clean-tech-insights.com/solid-state-cost-curves",
                "title": "Manufacturing Cost Parity Analysis",
            },
        ],
    }

    mock_gemini_payload = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": json.dumps(llm_response_json)}],
                    "role": "model",
                },
                "finishReason": "STOP",
            }
        ]
    }

    def mock_handler(request: httpx.Request) -> httpx.Response:
        assert "generativelanguage.googleapis.com" in str(request.url)
        assert "key=test-gemini-key" in str(request.url)
        return httpx.Response(200, json=mock_gemini_payload)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = GeminiLLMProvider(
            api_key="test-gemini-key",
            model="gemini-1.5-flash",
            client=client,
        )
        assert provider.provider_name == "gemini"
        assert provider.model_name == "gemini-1.5-flash"

        output = await provider.analyze(
            task_type="MARKET_OVERVIEW",
            research_question="Commercial roadmap for solid state batteries",
            evidence_items=evidence,
        )

        assert isinstance(output, AnalysisOutput)
        assert len(output.key_findings) == 2
        assert output.confidence_score == 0.94
        assert len(output.citations) == 2
        assert output.model_name == "gemini-1.5-flash"


@pytest.mark.asyncio
async def test_gemini_strips_markdown_fences():
    """Verify Gemini provider gracefully handles JSON enclosed in markdown code fences."""
    task_id = uuid.uuid4()
    job_id = uuid.uuid4()
    evidence = create_sample_evidence(task_id, job_id)

    raw_json = json.dumps(
        {
            "key_findings": [
                {
                    "claim": "Test claim",
                    "source_url": evidence[0].source_url,
                    "confidence": 0.9,
                }
            ],
            "grounded_summary": "Sufficiently long test grounded analytical summary for test validation.",
            "confidence_score": 0.9,
            "citations": [{"url": evidence[0].source_url, "title": "Test Title"}],
        }
    )

    fenced_text = f"```json\n{raw_json}\n```"
    mock_payload = {
        "candidates": [{"content": {"parts": [{"text": fenced_text}], "role": "model"}}]
    }

    def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=mock_payload)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = GeminiLLMProvider(api_key="test-key", client=client)
        output = await provider.analyze("OVERVIEW", "Question", evidence)
        assert len(output.key_findings) == 1


@pytest.mark.asyncio
async def test_gemini_auth_failure():
    """Verify HTTP 400/403 raises LLMAuthError."""

    def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": {"message": "API key not valid."}})

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = GeminiLLMProvider(api_key="invalid-key", client=client)
        with pytest.raises(LLMAuthError):
            await provider.analyze("OVERVIEW", "Question", [])


@pytest.mark.asyncio
async def test_gemini_rate_limit_error():
    """Verify HTTP 429 raises LLMRateLimitError."""

    def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            429, json={"error": {"message": "Resource has been exhausted."}}
        )

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = GeminiLLMProvider(api_key="test-key", client=client)
        with pytest.raises(LLMRateLimitError):
            await provider.analyze("OVERVIEW", "Question", [])


@pytest.mark.asyncio
async def test_gemini_server_error():
    """Verify HTTP 500 raises LLMProviderError."""

    def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="Internal Server Error")

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = GeminiLLMProvider(api_key="test-key", client=client)
        with pytest.raises(LLMProviderError) as exc_info:
            await provider.analyze("OVERVIEW", "Question", [])
        assert "server error (500)" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_gemini_timeout():
    """Verify request timeout raises LLMTimeoutError."""

    def mock_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("Socket read timed out")

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = GeminiLLMProvider(api_key="test-key", client=client)
        with pytest.raises(LLMTimeoutError):
            await provider.analyze("OVERVIEW", "Question", [])


@pytest.mark.asyncio
async def test_gemini_schema_validation_error():
    """Verify unparseable response raises LLMSchemaValidationError."""

    def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "content": {
                            "parts": [{"text": "Not valid JSON at all"}],
                            "role": "model",
                        }
                    }
                ]
            },
        )

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = GeminiLLMProvider(api_key="test-key", client=client)
        with pytest.raises(LLMSchemaValidationError):
            await provider.analyze("OVERVIEW", "Question", [])


# ==============================================================================
# 2. Anti-Hallucination Guardrail Tests
# ==============================================================================


def test_anti_hallucination_guardrail_remediates_unknown_urls():
    """
    CRITICAL DISTRIBUTED TRUST TEST:
    Verify that if the LLM hallucinates an arbitrary URL not in the evidence set,
    the guardrail detects it and re-grounds it to a genuine evidence URL.
    """
    task_id = uuid.uuid4()
    job_id = uuid.uuid4()
    evidence = create_sample_evidence(task_id, job_id)
    legitimate_url = evidence[0].source_url
    hallucinated_url = "https://invented-fake-domain.com/bogus-report"

    raw_output = AnalysisOutput(
        key_findings=[
            KeyFinding(
                claim="Fabricated claim with fake URL",
                source_url=hallucinated_url,
                confidence=0.99,
            ),
            KeyFinding(
                claim="Grounded claim with legitimate URL",
                source_url=legitimate_url,
                confidence=0.95,
            ),
        ],
        grounded_summary="Comprehensive analysis of the next generation battery ecosystem.",
        confidence_score=0.92,
        citations=[
            Citation(url=hallucinated_url, title="Fake Title"),
            Citation(url=legitimate_url, title="Valid Title"),
        ],
        model_name="test-model",
    )

    sanitized = validate_and_sanitize_grounding(raw_output, evidence)

    # All findings must now point to allowed URLs
    valid_urls = {ev.source_url for ev in evidence}
    for finding in sanitized.key_findings:
        assert finding.source_url in valid_urls
        assert finding.source_url != hallucinated_url

    # All citations must point to allowed URLs
    for cit in sanitized.citations:
        assert cit.url in valid_urls
        assert cit.url != hallucinated_url


# ==============================================================================
# 3. LLM Factory Resolution Tests
# ==============================================================================


def test_factory_resolves_mock_llm_provider():
    """Verify factory returns MockLLMProvider when configured as mock."""
    mock_settings = Settings(LLM_PROVIDER="mock", GEMINI_API_KEY=None)
    provider = get_llm_provider(mock_settings)
    assert isinstance(provider, MockLLMProvider)
    assert provider.provider_name == "mock"


def test_factory_resolves_gemini_provider_with_key():
    """Verify factory returns GeminiLLMProvider when key is present."""
    live_settings = Settings(
        LLM_PROVIDER="gemini",
        GEMINI_API_KEY="AIzaSyMockKey123",
        LLM_MODEL="gemini-1.5-flash",
    )
    provider = get_llm_provider(live_settings)
    assert isinstance(provider, GeminiLLMProvider)
    assert provider.provider_name == "gemini"
    assert provider.model_name == "gemini-1.5-flash"


def test_factory_honest_fallback_when_gemini_key_missing():
    """Verify factory falls back to MockLLMProvider when Gemini key is unset."""
    missing_key_settings = Settings(LLM_PROVIDER="gemini", GEMINI_API_KEY=None)
    provider = get_llm_provider(missing_key_settings)
    assert isinstance(provider, MockLLMProvider)
    assert provider.provider_name == "mock"


# ==============================================================================
# 4. Worker Integration Tests with LLM Providers
# ==============================================================================


@pytest.mark.asyncio
async def test_worker_processes_with_mock_llm_provider():
    """
    Verify complete task execution with MockSearchProvider + MockLLMProvider:
    Claims task, retrieves evidence, synthesizes findings, commits TaskResult.
    """
    async with AsyncSessionLocal() as session:
        job = Job(
            research_question="Next-gen geothermal drilling technology market entry",
            target_market="Renewable Energy",
            geography="Global",
        )
        session.add(job)
        await session.flush()

        task = Task(
            job_id=job.id,
            task_type=TaskType.MARKET_OVERVIEW.value,
            search_queries=["geothermal drilling cost per meter"],
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

        mock_search = MockSearchProvider()
        mock_llm = MockLLMProvider(model_name="mock-grounder-v1")

        success, reason = await TaskProcessor.process_task(
            session=session,
            task_message=task_msg,
            search_provider=mock_search,
            llm_provider=mock_llm,
        )

        assert success is True
        assert reason == "completed"

        # Verify TaskResult committed to PostgreSQL
        result = await session.scalar(
            select(TaskResult).where(TaskResult.task_id == task.id)
        )
        assert result is not None
        assert result.confidence_score >= 0.8
        assert len(result.key_findings) >= 1
        assert len(result.citations) >= 1
        assert "geothermal" in result.grounded_summary.lower()
        assert result.model_name == "mock-grounder-v1"


@pytest.mark.asyncio
async def test_worker_processes_with_live_gemini_llm_provider():
    """
    Verify task execution with GeminiLLMProvider (via mock transport):
    Retrieves evidence and invokes Gemini, saving grounded findings in PostgreSQL.
    """
    task_id = uuid.uuid4()
    job_id = uuid.uuid4()

    gemini_output_json = {
        "key_findings": [
            {
                "claim": "Deep directional drilling reduces enhanced geothermal Capex by 38%.",
                "source_url": "https://mock-market-intelligence.internal/reports/overview",
                "confidence": 0.95,
            }
        ],
        "grounded_summary": (
            "Enhanced geothermal systems demonstrate rapid Capex reductions through horizontal "
            "drilling innovations, making base-load renewable power competitive with combined-cycle gas."
        ),
        "confidence_score": 0.93,
        "citations": [
            {
                "url": "https://mock-market-intelligence.internal/reports/overview",
                "title": "Geothermal Drilling Economics Report",
            }
        ],
    }

    mock_gemini_payload = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": json.dumps(gemini_output_json)}],
                    "role": "model",
                }
            }
        ]
    }

    def mock_gemini_transport(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=mock_gemini_payload)

    transport = httpx.MockTransport(mock_gemini_transport)
    async with httpx.AsyncClient(transport=transport) as http_client:
        gemini_provider = GeminiLLMProvider(
            api_key="test-gemini-key",
            model="gemini-1.5-flash",
            client=http_client,
        )

        async with AsyncSessionLocal() as session:
            job = Job(
                id=job_id,
                research_question="Enhanced geothermal systems Capex and Levelized Cost of Energy",
                target_market="Geothermal",
                geography="North America",
            )
            session.add(job)
            await session.flush()

            task = Task(
                id=task_id,
                job_id=job.id,
                task_type=TaskType.MARKET_OVERVIEW.value,
                search_queries=["EGS drilling levelized cost of energy"],
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

            mock_search = MockSearchProvider()
            success, reason = await TaskProcessor.process_task(
                session=session,
                task_message=task_msg,
                search_provider=mock_search,
                llm_provider=gemini_provider,
            )

            assert success is True
            assert reason == "completed"

            # Check DB result
            result = await session.scalar(
                select(TaskResult).where(TaskResult.task_id == task.id)
            )
            assert result is not None
            assert result.model_name == "gemini-1.5-flash"
            assert "geothermal" in result.grounded_summary.lower()
            assert result.confidence_score == 0.93
            assert len(result.key_findings) >= 1
            assert len(result.citations) >= 1
