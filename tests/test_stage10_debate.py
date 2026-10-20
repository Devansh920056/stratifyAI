"""
Comprehensive Automated Tests for Stage 10:
Multi-Agent Dialectic Debate & Cross-Vector Synthesis.
"""

import uuid
import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import AsyncSessionLocal
from backend.app.main import app
from backend.app.models.debate import Debate, DebateMessage
from backend.app.models.enums import (
    AgentDebateRole,
    ArbiterVerdict,
    ArgumentType,
    DebateStatus,
    EvidenceSourceType,
)
from backend.app.models.fused_evidence import FusedEvidence
from backend.app.schemas.debate import DebateInitiateRequest
from backend.app.services.debate_service import MultiAgentDebateService


@pytest_asyncio.fixture
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def api_client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.mark.asyncio
async def test_debate_models_persistence_and_cascades(db_session: AsyncSession):
    """Verifies that Debate and DebateMessage models persist correctly with foreign key cascade."""
    unique_id = uuid.uuid4().hex[:6]
    entity = f"QuantumTech-{unique_id}"

    debate = Debate(
        id=uuid.uuid4(),
        topic=f"Solid-State Battery Roll-to-Roll Sintering Viability {unique_id}",
        entity_name=entity,
        status=DebateStatus.IN_PROGRESS.value,
        rounds_count=3,
        synthesis_matrix={"test": True},
    )
    db_session.add(debate)
    await db_session.commit()

    # Add messages
    msg1 = DebateMessage(
        id=uuid.uuid4(),
        debate_id=debate.id,
        agent_role=AgentDebateRole.BULL_SPECIALIST.value,
        agent_name="Marcus Vance",
        round_number=1,
        argument_type=ArgumentType.THESIS.value,
        content="Lab bench tests show 500 Wh/kg energy density.",
        confidence_score=0.90,
    )
    msg2 = DebateMessage(
        id=uuid.uuid4(),
        debate_id=debate.id,
        agent_role=AgentDebateRole.BEAR_RISK_OFFICER.value,
        agent_name="Dr. Evelyn Reed",
        round_number=1,
        argument_type=ArgumentType.ANTITHESIS.value,
        content="Roll-to-roll yield suffers 40% micro-crack defects.",
        confidence_score=0.88,
    )
    db_session.add_all([msg1, msg2])
    await db_session.commit()

    # Query back
    stmt = select(Debate).where(Debate.id == debate.id)
    res = await db_session.execute(stmt)
    fetched = res.scalar_one_or_none()
    assert fetched is not None
    assert fetched.entity_name == entity

    # Query messages
    msg_stmt = select(DebateMessage).where(DebateMessage.debate_id == debate.id).order_by(DebateMessage.round_number)
    msg_res = await db_session.execute(msg_stmt)
    messages = msg_res.scalars().all()
    assert len(messages) == 2
    assert messages[0].agent_role == AgentDebateRole.BULL_SPECIALIST.value
    assert messages[1].agent_role == AgentDebateRole.BEAR_RISK_OFFICER.value

    # Verify Cascade Delete
    await db_session.delete(fetched)
    await db_session.commit()

    check_res = await db_session.execute(
        select(DebateMessage).where(DebateMessage.debate_id == debate.id)
    )
    assert len(check_res.scalars().all()) == 0


@pytest.mark.asyncio
async def test_multi_agent_debate_service_orchestration(db_session: AsyncSession):
    """Tests full multi-agent debate session with statutory grounding and citations."""
    unique_id = uuid.uuid4().hex[:6]
    entity = f"Tesla-{unique_id}"

    # Insert empirical grounding evidence
    sec_evidence = FusedEvidence(
        id=uuid.uuid4(),
        entity_name=entity,
        source_type=EvidenceSourceType.SEC_EDGAR.value,
        filing_type="10-K",
        title="Item 1A Risk Factor: 4680 Cathode Coating Calibration",
        content_excerpt="Dry cathode electrode coating equipment calibrations may delay production scaling.",
        source_url="https://www.sec.gov/edgar/browse/?CIK=0001318605",
        reliability_score=0.95,
        divergence_status="CONTRADICTORY",
        fiscal_period="FY 2024",
        metadata_json={"accession_number": "0001318605-24-000012"},
    )
    db_session.add(sec_evidence)
    await db_session.commit()

    req = DebateInitiateRequest(
        topic="4680 In-House Battery Scaling & Robotaxi Viability",
        entity_name=entity,
        rounds_count=3,
    )
    debate_response = await MultiAgentDebateService.initiate_debate(db_session, req)

    assert debate_response is not None
    assert debate_response.status == DebateStatus.CONCLUDED
    assert debate_response.rounds_count == 3
    assert debate_response.arbiter_verdict is not None
    assert debate_response.conviction_score is not None
    assert 0.0 <= debate_response.conviction_score <= 1.0

    # Verify agent messages
    roles = [m.agent_role for m in debate_response.messages]
    assert AgentDebateRole.BULL_SPECIALIST in roles
    assert AgentDebateRole.BEAR_RISK_OFFICER in roles
    assert AgentDebateRole.REGULATORY_AUDITOR in roles
    assert AgentDebateRole.PRINCIPAL_ARBITER in roles

    # Verify citations exist in bear/regulatory arguments
    bear_msgs = [m for m in debate_response.messages if m.agent_role == AgentDebateRole.BEAR_RISK_OFFICER]
    assert len(bear_msgs) >= 1
    assert any(len(m.evidence_citations) > 0 for m in bear_msgs)


@pytest.mark.asyncio
async def test_arbiter_synthesis_matrix_and_tripwires(db_session: AsyncSession):
    """Verifies synthesis matrix scorecard, vector balance, and conditional risk tripwires."""
    unique_id = uuid.uuid4().hex[:6]
    entity = f"CrowdStrike-{unique_id}"

    req = DebateInitiateRequest(
        topic="Single-Kernel Architecture Enterprise Stability Post-Incident",
        entity_name=entity,
        rounds_count=2,
    )
    res = await MultiAgentDebateService.initiate_debate(db_session, req)

    matrix = res.synthesis_matrix
    assert "bull_score" in matrix
    assert "bear_score" in matrix
    assert "regulatory_risk_score" in matrix
    assert "tripwires" in matrix
    assert len(matrix["tripwires"]) >= 2
    assert "primary_growth_vector" in matrix
    assert "primary_vulnerability" in matrix


@pytest.mark.asyncio
async def test_debates_api_endpoints(api_client: httpx.AsyncClient):
    """Tests the REST API endpoints: initiate, list, and get debate by ID."""
    unique_id = uuid.uuid4().hex[:6]
    entity = f"Rivian-{unique_id}"

    # 1. POST /debates/initiate
    initiate_payload = {
        "topic": "Dual-Source Commercial Delivery Van Economics",
        "entity_name": entity,
        "rounds_count": 3,
    }
    post_res = await api_client.post("/api/v1/debates/initiate", json=initiate_payload)
    assert post_res.status_code == 201
    data = post_res.json()
    debate_id = data["id"]
    assert data["entity_name"] == entity
    assert data["status"] == "CONCLUDED"
    assert len(data["messages"]) >= 4

    # 2. GET /debates
    list_res = await api_client.get(f"/api/v1/debates?entity_name={entity}")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] >= 1
    assert list_data["debates"][0]["id"] == debate_id

    # 3. GET /debates/{id}
    detail_res = await api_client.get(f"/api/v1/debates/{debate_id}")
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert detail_data["id"] == debate_id
    assert detail_data["arbiter_verdict"] in [
        "STRONG_BUY",
        "STRATEGIC_ACCUMULATE",
        "NEUTRAL_HOLD",
        "DEFENSIVE_HEDGE",
        "DIVEST_AVOID",
    ]
    assert len(detail_data["messages"]) >= 4
