"""
Stage 12 End-to-End Orchestration, Enterprise Resilience & System Delivery Test Suite.
Verifies cross-stage pipeline convergence, fault tolerance, and deterministic governance.
"""

import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import AsyncSessionLocal
from backend.app.main import app
from backend.app.services.fusion_service import EvidenceFusionService
from backend.app.services.vector_service import VectorMemoryService
from backend.app.schemas.debate import DebateInitiateRequest
from backend.app.services.debate_service import MultiAgentDebateService
from backend.app.schemas.evaluation import DecisionEvaluationCreateRequest
from backend.app.services.evaluation_service import EvaluationService
from backend.app.services.export_service import ExecutiveExportService
from backend.app.schemas.export import DossierExportRequest
from backend.app.models.job import Job
from backend.app.models.recommendation import Recommendation


@pytest_asyncio.fixture
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session


@pytest.mark.asyncio
async def test_full_cross_stage_pipeline_orchestration(db_session: AsyncSession):
    """
    Validates complete end-to-end convergence:
    Evidence Fusion (Stage 9) -> Semantic Vector Memory (Stage 8) ->
    Dialectic Debate (Stage 10) -> Decision Quality Scoring (Stage 6) ->
    Executive Boardroom Dossier with SHA-256 Provenance (Stage 11).
    """
    entity = "Tesla"
    topic = f"{entity} Autonomous Logistics & 4680 Scaling"

    # Step 1: Ingest Statutory SEC & Scientific arXiv Evidence (Stage 9)
    fused_bundle = await EvidenceFusionService.query_and_fuse_evidence(
        session=db_session,
        entity_name=entity,
        topic=topic,
        include_sec=True,
        include_arxiv=True,
        reconcile=True,
    )
    assert fused_bundle is not None
    assert len(fused_bundle.items) > 0

    # Step 2: Index Fused Evidence into Semantic Vector Memory (Stage 8)
    index_res = await VectorMemoryService.index_all_entities(
        session=db_session,
        reindex_all=False,
    )
    assert index_res.indexed_count >= 0

    # Step 3: Execute 3-Round Cross-Vector Dialectic Debate (Stage 10)
    deb_req = DebateInitiateRequest(
        topic=topic,
        entity_name=entity,
        rounds_count=3,
    )
    debate = await MultiAgentDebateService.initiate_debate(
        session=db_session,
        request=deb_req,
    )
    assert debate is not None
    assert debate.arbiter_verdict is not None
    assert debate.conviction_score is not None
    assert 0.0 <= debate.conviction_score <= 1.0
    assert len(debate.messages) >= 4

    # Step 4: Decision Quality Scoring (Stage 6)
    job = Job(
        id=uuid.uuid4(),
        research_question=f"Analyze {entity} autonomous logistics scalability",
        target_market="Automotive",
        geography="US",
        status="COMPLETED",
    )
    db_session.add(job)
    await db_session.commit()

    rec = Recommendation(
        id=uuid.uuid4(),
        job_id=job.id,
        title=f"Deploy automated fleet expansion for {entity}",
        description="Expand automated delivery logistics to reduce driver overhead.",
        rationale="Operational yield improvements lower per-unit delivery costs.",
        estimated_impact=8,
        estimated_effort=4,
        priority_score=4.4,
        time_horizon="NEAR_TERM",
        outcome_hypothesis="Higher throughput yields 14% efficiency boost.",
        success_metric="Operational cost per mile",
        status="DRAFT",
    )
    db_session.add(rec)
    await db_session.commit()

    eval_req = DecisionEvaluationCreateRequest(
        outcome_status="VALIDATED",
        evaluator_notes="Fleet efficiency met Stage 1 targets.",
        actual_outcome="Reduced operational delivery overhead by 14%.",
        actual_metric_value="+14% Efficiency",
        impact_delta=1.2,
        confidence_score=0.92,
    )
    eval_record = await EvaluationService.record_evaluation(
        session=db_session,
        recommendation_id=rec.id,
        req=eval_req,
    )
    assert eval_record is not None
    assert eval_record.outcome_status == "VALIDATED"


    # Step 5: Compile Boardroom Intelligence Dossier with SHA-256 Provenance (Stage 11)
    req = DossierExportRequest(
        entity_name=entity,
        debate_id=debate.id,
        format="MARKDOWN",
        include_citations=True,
    )
    dossier = await ExecutiveExportService.generate_dossier(db_session, req)
    assert dossier is not None
    assert dossier.format == "MARKDOWN"
    assert dossier.governance_audit.sha256_hash is not None
    assert len(dossier.governance_audit.sha256_hash) == 64
    assert dossier.governance_audit.entity_name == entity
    assert "SHA-256 AUDIT DIGEST" in dossier.content
    assert dossier.governance_audit.sha256_hash in dossier.content

    # Step 6: Verify Immutable Audit History
    audit_history = await ExecutiveExportService.get_audit_history(db_session, entity)
    assert audit_history.total >= 1
    assert audit_history.audit_records[0].sha256_hash == dossier.governance_audit.sha256_hash


@pytest.mark.asyncio
async def test_resilience_and_graceful_degradation(db_session: AsyncSession):
    """
    Tests platform resilience against missing entities, zero citations, and non-existent debate IDs.
    Ensures zero unhandled exceptions or 500 errors.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Export for brand new entity with zero pre-existing data
        empty_entity = f"GhostEntity-{uuid.uuid4().hex[:6]}"
        res = await client.post(
            "/api/v1/export/dossier",
            json={"entity_name": empty_entity, "format": "JSON"},
        )
        assert res.status_code == 200
        payload = res.json()
        assert payload["entity_name"] == empty_entity
        assert payload["governance_audit"]["total_citations"] == 0
        assert len(payload["governance_audit"]["sha256_hash"]) == 64

        # 2. Non-existent debate retrieval gracefully returns 404
        bogus_id = str(uuid.uuid4())
        res_deb = await client.get(f"/api/v1/debates/{bogus_id}")
        assert res_deb.status_code == 404
        assert "not found" in res_deb.json()["detail"].lower()

        # 3. Vector similarity search on empty or unusual query strings
        res_vec = await client.post(
            "/api/v1/semantic/search",
            json={"query": "!@#$%^&*()_+ special unicode characters \u2603\u2708\u26a1", "limit": 5},
        )
        assert res_vec.status_code == 200
        assert "matches" in res_vec.json()


@pytest.mark.asyncio
async def test_system_telemetry_and_liveness_health():
    """
    Verifies that system health checks and telemetry instrumentation respond accurately.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Liveness probe
        live = await client.get("/api/v1/health/live")
        assert live.status_code == 200
        assert live.json()["status"] == "healthy"

        # Readiness probe
        ready = await client.get("/api/v1/health/ready")
        assert ready.status_code == 200
        assert ready.json()["status"] == "healthy"

        # Telemetry probe
        telem = await client.get("/api/v1/health/telemetry")
        assert telem.status_code == 200
        data = telem.json()
        assert "database" in data
        assert "broker" in data
