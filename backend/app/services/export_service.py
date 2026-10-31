"""
Executive Intelligence Export Service (Stage 11).
Compiles a dossier for an entity from data that is actually stored: SEC filings and arXiv papers
(fused evidence), market signals, the latest debate, recommendations, evaluation outcomes and,
optionally, a research job's report. Sections with no data say so; nothing is defaulted.

A SHA-256 digest of the rendered content is included so a copy can be checked for later edits.
The audit registry is held in process memory only (it is cleared when the API restarts).
"""

import hashlib
import json
import logging
import uuid
from datetime import UTC, datetime
from html import escape as esc

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from backend.app.models.debate import Debate
from backend.app.models.decision_evaluation import DecisionEvaluation
from backend.app.models.enums import DecisionOutcomeStatus, EvidenceSourceType
from backend.app.models.fused_evidence import FusedEvidence
from backend.app.models.market_signal import MarketSignal
from backend.app.models.recommendation import Recommendation
from backend.app.models.report import Report
from backend.app.schemas.export import (
    AuditHistoryResponse,
    DossierExportRequest,
    DossierExportResponse,
    GovernanceAuditRecord,
)

logger = logging.getLogger("stratify.export_service")

# In-memory audit registry (per process).
_GOVERNANCE_AUDIT_LOG: dict[str, list[GovernanceAuditRecord]] = {}


def _sha256(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class ExecutiveExportService:
    @classmethod
    async def generate_dossier(
        cls, session: AsyncSession, request: DossierExportRequest
    ) -> DossierExportResponse:
        """Compiles the dossier and computes its SHA-256 digest."""
        entity = request.entity_name.strip()
        fmt = request.format.upper().strip()
        if fmt not in ("MARKDOWN", "HTML", "JSON"):
            fmt = "MARKDOWN"
        logger.info(f"Generating dossier for '{entity}' in format {fmt}")

        needle = entity.lower()

        async def fused(source_type: str, limit: int):
            stmt = (
                select(FusedEvidence)
                .where(func.lower(FusedEvidence.entity_name).contains(needle), FusedEvidence.source_type == source_type)
                .order_by(desc(FusedEvidence.created_at))
                .limit(limit)
            )
            return (await session.execute(stmt)).scalars().all()

        sec_filings = await fused(EvidenceSourceType.SEC_EDGAR.value, 10)
        arxiv_papers = await fused(EvidenceSourceType.ARXIV_PREPRINT.value, 5)

        signals = (
            await session.execute(
                select(MarketSignal)
                .where(func.lower(MarketSignal.headline).contains(needle))
                .order_by(desc(MarketSignal.published_at))
                .limit(6)
            )
        ).scalars().all()

        debate_stmt = select(Debate).options(joinedload(Debate.messages))
        if request.debate_id:
            debate_stmt = debate_stmt.where(Debate.id == request.debate_id)
        else:
            debate_stmt = debate_stmt.where(func.lower(Debate.entity_name).contains(needle)).order_by(desc(Debate.created_at))
        debate = (await session.execute(debate_stmt.limit(1))).unique().scalar_one_or_none()

        recs_stmt = select(Recommendation).order_by(desc(Recommendation.created_at)).limit(5)
        if request.job_id:
            recs_stmt = recs_stmt.where(Recommendation.job_id == request.job_id)
        else:
            recs_stmt = recs_stmt.where(func.lower(Recommendation.title).contains(needle))
        recommendations = (await session.execute(recs_stmt)).scalars().all()

        report = None
        if request.job_id:
            report = await session.scalar(select(Report).where(Report.job_id == request.job_id))

        # Decision validation rate over evaluations of the recommendations shown above.
        validation_rate = None
        if recommendations:
            evals = (
                await session.execute(
                    select(DecisionEvaluation).where(
                        DecisionEvaluation.recommendation_id.in_([r.id for r in recommendations])
                    )
                )
            ).scalars().all()
            decided = [
                e for e in evals
                if e.outcome_status in (
                    DecisionOutcomeStatus.VALIDATED.value,
                    DecisionOutcomeStatus.PARTIALLY_VALIDATED.value,
                    DecisionOutcomeStatus.INVALIDATED.value,
                )
            ]
            if decided:
                score = sum(
                    1.0 if e.outcome_status == DecisionOutcomeStatus.VALIDATED.value
                    else 0.5 if e.outcome_status == DecisionOutcomeStatus.PARTIALLY_VALIDATED.value else 0.0
                    for e in decided
                )
                validation_rate = round(score / len(decided), 3)

        sec_accessions = [
            (f.metadata_json or {}).get("accession_number") for f in sec_filings
        ]
        sec_accessions = [a for a in sec_accessions if a]
        arxiv_ids = [a for a in ((p.metadata_json or {}).get("arxiv_id") for p in arxiv_papers) if a]
        gdelt_sources = [s.source_domain for s in signals]
        total_citations = len(sec_filings) + len(arxiv_papers) + len(signals)

        dossier_id = uuid.uuid4()
        now = datetime.now(UTC)
        data = cls._build_data(
            dossier_id, entity, now, debate, sec_filings, arxiv_papers, signals, recommendations, report,
            validation_rate, request.include_citations,
        )

        if fmt == "JSON":
            content, digest = cls._render_json(data)
            ext = "json"
        elif fmt == "HTML":
            content, digest = cls._render_html(data)
            ext = "html"
        else:
            content, digest = cls._render_markdown(data)
            ext = "md"
        safe_entity = "".join(c if c.isalnum() else "_" for c in entity.lower()).strip("_") or "entity"
        filename = f"stratify_dossier_{safe_entity}_{now.strftime('%Y%m%d')}.{ext}"

        audit_record = GovernanceAuditRecord(
            dossier_id=dossier_id,
            entity_name=entity,
            sha256_hash=digest,
            content_length_bytes=len(content.encode("utf-8")),
            total_citations=total_citations,
            sec_accessions=sec_accessions,
            arxiv_ids=arxiv_ids,
            gdelt_sources=gdelt_sources,
            arbiter_verdict=debate.arbiter_verdict if debate else None,
            conviction_score=debate.conviction_score if debate else None,
            dqs_score=validation_rate,
            generated_at=now,
        )
        _GOVERNANCE_AUDIT_LOG.setdefault(entity, []).insert(0, audit_record)

        return DossierExportResponse(
            dossier_id=dossier_id,
            entity_name=entity,
            format=fmt,
            filename=filename,
            content=content,
            governance_audit=audit_record,
        )

    @classmethod
    async def get_audit_history(cls, session: AsyncSession, entity_name: str) -> AuditHistoryResponse:
        """Dossiers generated for the entity since the API process started."""
        entity = entity_name.strip()
        records = _GOVERNANCE_AUDIT_LOG.get(entity, [])
        return AuditHistoryResponse(entity_name=entity, audit_records=records, total=len(records))

    # ------------------------------------------------------------------ data
    @classmethod
    def _build_data(
        cls, dossier_id, entity, now, debate, sec_filings, arxiv_papers, signals, recs, report,
        validation_rate, include_citations,
    ) -> dict:
        data: dict = {
            "dossier_id": str(dossier_id),
            "entity_name": entity,
            "generated_at": now.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "decision_validation_rate": validation_rate,
            "arbitration_decision": None,
            "research_report": None,
            "recommendations": [
                {"title": r.title, "status": r.status, "estimated_impact": r.estimated_impact,
                 "estimated_effort": r.estimated_effort}
                for r in recs
            ],
        }
        if debate:
            data["arbitration_decision"] = {
                "verdict": debate.arbiter_verdict,
                "evidence_coverage": debate.conviction_score,
                "executive_summary": debate.executive_summary,
                "synthesis_matrix": debate.synthesis_matrix or {},
            }
        if report:
            data["research_report"] = {
                "status": report.status,
                "executive_summary": report.executive_summary,
                "citation_count": len(report.citations or []),
            }
        if include_citations:
            data["statutory_sec_filings"] = [
                {
                    "filing_type": f.filing_type,
                    "title": f.title,
                    "accession_number": (f.metadata_json or {}).get("accession_number"),
                    "fiscal_period": f.fiscal_period,
                    "divergence_status": f.divergence_status,
                    "source_url": f.source_url,
                }
                for f in sec_filings
            ]
            data["arxiv_preprints"] = [
                {
                    "title": p.title,
                    "arxiv_id": (p.metadata_json or {}).get("arxiv_id"),
                    "divergence_status": p.divergence_status,
                    "source_url": p.source_url,
                }
                for p in arxiv_papers
            ]
            data["market_signals"] = [
                {
                    "headline": s.headline,
                    "source_domain": s.source_domain,
                    "sentiment_score": s.sentiment_score,
                    "source_url": s.source_url,
                }
                for s in signals
            ]
        return data

    # --------------------------------------------------------------- renderers
    @classmethod
    def _decision_lines(cls, data: dict) -> list[str]:
        d = data["arbitration_decision"]
        if not d:
            return ["No debate has been run for this entity."]
        lines = [
            f"Verdict: {(d['verdict'] or 'n/a').replace('_', ' ')}",
            f"Evidence coverage: {(d['evidence_coverage'] or 0) * 100:.0f}%",
            f"Summary: {d['executive_summary'] or 'n/a'}",
        ]
        for t in (d["synthesis_matrix"] or {}).get("tripwires", []):
            lines.append(f"Monitor: {t}")
        return lines

    @classmethod
    def _render_markdown(cls, data: dict) -> tuple[str, str]:
        md = [f"# STRATIFY AI - INTELLIGENCE DOSSIER: {data['entity_name']}", ""]
        md += [
            f"- **Dossier ID**: `{data['dossier_id']}`",
            f"- **Generated**: {data['generated_at']}",
            "- **Decision validation rate**: "
            + (f"{data['decision_validation_rate']:.0%}" if data["decision_validation_rate"] is not None
               else "n/a (no recorded evaluations)"),
            "",
            "## 1. Debate verdict",
        ]
        md += [f"- {line}" for line in cls._decision_lines(data)]

        if data["research_report"]:
            r = data["research_report"]
            md += ["", "## 2. Research report", f"- Status: {r['status']} ({r['citation_count']} citations)", "", r["executive_summary"]]

        md += ["", "## 3. Recommendations"]
        md += [f"- {r['title']} [{r['status']}]" for r in data["recommendations"]] or ["- None recorded."]

        if "statutory_sec_filings" in data:
            md += ["", "## 4. SEC filings and arXiv papers", "| Source | Title | Reference | Status |", "| :-- | :-- | :-- | :-- |"]
            for f in data["statutory_sec_filings"]:
                md.append(f"| SEC {f['filing_type']} | {f['title'][:80]} | `{f['accession_number'] or 'n/a'}` | {f['divergence_status']} |")
            for p in data["arxiv_preprints"]:
                md.append(f"| arXiv | {p['title'][:80]} | `arXiv:{p['arxiv_id'] or 'n/a'}` | {p['divergence_status']} |")
            if not data["statutory_sec_filings"] and not data["arxiv_preprints"]:
                md.append("| - | None stored | - | - |")
            md += ["", "## 5. News signals"]
            md += [f"- [{s['source_domain']}] {s['headline']} (tone {s['sentiment_score']:+.2f})" for s in data["market_signals"]] or ["- None stored."]

        body = "\n".join(md) + "\n"
        digest = _sha256(body)
        body += f"\n---\nSHA-256 of the content above: `{digest}`\n"
        return body, digest

    @classmethod
    def _render_html(cls, data: dict) -> tuple[str, str]:
        md_text, digest = cls._render_markdown(data)  # digest covers the same content as the Markdown form
        rows = ""
        for f in data.get("statutory_sec_filings", []):
            rows += (
                f"<tr><td>SEC {esc(f['filing_type'])}</td><td>{esc(f['title'])}</td>"
                f"<td><code>{esc(f['accession_number'] or 'n/a')}</code></td><td>{esc(f['divergence_status'])}</td></tr>\n"
            )
        for p in data.get("arxiv_preprints", []):
            rows += (
                f"<tr><td>arXiv</td><td>{esc(p['title'])}</td>"
                f"<td><code>arXiv:{esc(p['arxiv_id'] or 'n/a')}</code></td><td>{esc(p['divergence_status'])}</td></tr>\n"
            )
        decision = "".join(f"<li>{esc(line)}</li>" for line in cls._decision_lines(data))
        recs = "".join(f"<li>{esc(r['title'])} [{esc(r['status'])}]</li>" for r in data["recommendations"]) or "<li>None recorded.</li>"
        signals = "".join(
            f"<li>[{esc(s['source_domain'])}] {esc(s['headline'])} (tone {s['sentiment_score']:+.2f})</li>"
            for s in data.get("market_signals", [])
        ) or "<li>None stored.</li>"
        html_doc = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Stratify AI Dossier - {esc(data['entity_name'])}</title>
<style>body{{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;line-height:1.5;color:#111}}
table{{width:100%;border-collapse:collapse}}th,td{{border-bottom:1px solid #ddd;padding:8px;text-align:left;font-size:13px}}
code{{background:#f3f4f6;padding:1px 4px}}</style></head><body>
<h1>Intelligence Dossier: {esc(data['entity_name'])}</h1>
<p>Dossier ID <code>{esc(data['dossier_id'])}</code> &middot; Generated {esc(data['generated_at'])}</p>
<h2>Debate verdict</h2><ul>{decision}</ul>
<h2>Recommendations</h2><ul>{recs}</ul>
<h2>SEC filings and arXiv papers</h2>
<table><thead><tr><th>Source</th><th>Title</th><th>Reference</th><th>Status</th></tr></thead><tbody>{rows or '<tr><td colspan="4">None stored.</td></tr>'}</tbody></table>
<h2>News signals</h2><ul>{signals}</ul>
<p><small>SHA-256 of the Markdown rendering of this dossier: <code>{digest}</code></small></p>
</body></html>"""
        return html_doc, digest

    @classmethod
    def _render_json(cls, data: dict) -> tuple[str, str]:
        digest = _sha256(json.dumps(data, indent=2, sort_keys=True))
        out = dict(data)
        out["sha256_of_content_without_this_field"] = digest
        return json.dumps(out, indent=2, sort_keys=True), digest
