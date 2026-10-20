"""
Comprehensive Automated Tests for Stage 11:
Executive Intelligence Export & Governance Audit Trail Engine.
"""

import hashlib
import json
import uuid
import httpx
import pytest
import pytest_asyncio
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
from backend.app.models.market_signal import MarketSignal
from backend.app.schemas.export import DossierExportRequest
from backend.app.services.export_service import ExecutiveExportService


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
async def test_sha256_cryptographic_fingerprint_integrity():
    """Validates deterministic SHA-256 hashing and tamper-detection."""
    text1 = "Stratify AI Boardroom Dossier: Tesla 4680 In-House Scaling"
    text2 = "Stratify AI Boardroom Dossier: Tesla 4680 In-House Scaling [TAMPERED]"

    hash1 = hashlib.sha256(text1.encode("utf-8")).hexdigest()
    hash2 = hashlib.sha256(text2.encode("utf-8")).hexdigest()

    assert len(hash1) == 64
    assert len(hash2) == 64
    assert hash1 != hash2
    assert hashlib.sha256(text1.encode("utf-8")).hexdigest() == hash1


@pytest.mark.asyncio
async def test_executive_export_service_markdown_and_html(db_session: AsyncSession):
    """Verifies that ExecutiveExportService compiles Markdown and HTML dossiers with provenance citations."""
    unique_id = uuid.uuid4().hex[:6]
    entity = f"AeroTech-{unique_id}"

    # 1. Insert grounding evidence
    sec_item = FusedEvidence(
        id=uuid.uuid4(),
        entity_name=entity,
        source_type=EvidenceSourceType.SEC_EDGAR.value,
        filing_type="10-K",
        title="Item 1A Risk Factors: Titanium Supply Chain Scarcity",
        content_excerpt="Single-source aerospace alloy suppliers could constrain delivery timelines.",
        source_url="https://www.sec.gov/edgar/test",
        reliability_score=0.95,
        divergence_status="ALIGNED",
        metadata_json={"accession_number": "0001234567-24-000001"},
    )
    db_session.add(sec_item)

    # 2. Insert dialectic debate
    debate = Debate(
        id=uuid.uuid4(),
        topic=f"Aerospace Alloy Sourcing & Defense Delivery Cadence {unique_id}",
        entity_name=entity,
        status=DebateStatus.CONCLUDED.value,
        rounds_count=3,
        arbiter_verdict=ArbiterVerdict.STRATEGIC_ACCUMULATE.value,
        conviction_score=0.84,
        executive_summary="Accumulate on defense budget expansion with capex monitoring.",
        synthesis_matrix={"tripwires": ["If raw titanium prices exceed $18/kg, downgrade."]},
    )
    db_session.add(debate)
    await db_session.commit()

    # 3. Test Markdown export
    md_req = DossierExportRequest(entity_name=entity, format="MARKDOWN")
    md_res = await ExecutiveExportService.generate_dossier(db_session, md_req)

    assert md_res is not None
    assert md_res.entity_name == entity
    assert md_res.format == "MARKDOWN"
    assert "STRATIFY AI 2.0 — EXECUTIVE INTELLIGENCE DOSSIER" in md_res.content
    assert "Titanium Supply Chain Scarcity" in md_res.content
    assert "STRATEGIC ACCUMULATE" in md_res.content
    assert md_res.governance_audit.sha256_hash is not None
    assert len(md_res.governance_audit.sha256_hash) == 64

    # 4. Test HTML export
    html_req = DossierExportRequest(entity_name=entity, format="HTML")
    html_res = await ExecutiveExportService.generate_dossier(db_session, html_req)

    assert html_res is not None
    assert html_res.format == "HTML"
    assert "<!DOCTYPE html>" in html_res.content
    assert "Titanium Supply Chain Scarcity" in html_res.content
    assert "@media print" in html_res.content


@pytest.mark.asyncio
async def test_executive_export_service_json_format(db_session: AsyncSession):
    """Verifies that JSON format generates valid parseable schema with embedded SHA-256 digest."""
    unique_id = uuid.uuid4().hex[:6]
    entity = f"CyberShield-{unique_id}"

    req = DossierExportRequest(entity_name=entity, format="JSON")
    res = await ExecutiveExportService.generate_dossier(db_session, req)

    assert res.format == "JSON"
    parsed = json.loads(res.content)
    assert parsed["entity_name"] == entity
    assert "arbitration_decision" in parsed
    assert "statutory_sec_filings" in parsed
    assert "cryptographic_sha256_hash" in parsed
    assert len(parsed["cryptographic_sha256_hash"]) == 64


@pytest.mark.asyncio
async def test_export_api_endpoints(api_client: httpx.AsyncClient):
    """Tests POST /api/v1/export/dossier and GET /api/v1/export/audit/{entity}."""
    unique_id = uuid.uuid4().hex[:6]
    entity = f"NordicEnergy-{unique_id}"

    payload = {
        "entity_name": entity,
        "format": "MARKDOWN",
        "include_citations": True,
    }
    post_res = await api_client.post("/api/v1/export/dossier", json=payload)
    assert post_res.status_code == 200
    data = post_res.json()
    assert data["entity_name"] == entity
    assert "content" in data
    assert data["governance_audit"]["sha256_hash"] is not None

    # Test audit history retrieval
    audit_res = await api_client.get(f"/api/v1/export/audit/{entity}")
    assert audit_res.status_code == 200
    audit_data = audit_res.json()
    assert audit_data["total"] >= 1
    assert audit_data["audit_records"][0]["sha256_hash"] == data["governance_audit"]["sha256_hash"]
