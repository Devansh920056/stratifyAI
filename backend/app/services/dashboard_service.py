"""
Dashboard & Grounded Visualizations Service.
Reports, per research vector, only what the stored report actually contains: its confidence,
citation count, quoted claims and source domains. Nothing is defaulted or estimated; when data
is missing the value is 0 / empty. No competitor "moat" positioning is produced because no
data source in the pipeline measures it.
"""

import logging
import re
import uuid
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.models.job import Job
from backend.app.models.report import Report
from backend.app.models.task import Task
from backend.app.schemas.dashboard import (
    ClaimClassification,
    JobDashboardResponse,
    MoatCompetitorPoint,
    SourceDomainItem,
    VectorScoreItem,
)

logger = logging.getLogger("stratify.services.dashboard")


class DashboardService:
    """
    Coordinates analytical intelligence extraction for the visual Market Dashboard.
    """

    @classmethod
    async def get_dashboard_data(
        cls,
        session: AsyncSession,
        job_id: uuid.UUID,
    ) -> JobDashboardResponse:
        """
        Extracts verified dashboard metrics, moat matrix, and risk posture for a research job.
        """
        # Expire session identity map to guarantee fresh state
        session.expire_all()

        stmt = (
            select(Job)
            .options(
                selectinload(Job.report),
                selectinload(Job.tasks).selectinload(Task.result),
                selectinload(Job.tasks).selectinload(Task.evidence),
            )
            .where(Job.id == job_id)
        )
        job = await session.scalar(stmt)
        if not job:
            raise ValueError(f"Job {job_id} not found.")

        report: Report | None = job.report

        # 1. Evaluate 4-Vector Scores & Confidence
        vector_scores = cls._compute_vector_scores(job, report)
        scored = [v for v in vector_scores if v.evidence_count > 0]
        overall_confidence = (
            round(sum(v.confidence for v in scored) / len(scored), 2) if scored else 0.0
        )

        # 2. Extract Competitive Moat Matrix Points (Vector 2 grounded)
        moat_matrix = cls._compute_moat_matrix(job, report)

        # 3. Classify Empirical vs Inferred Claims
        claims_breakdown, empirical_count, inferred_count = cls._classify_claims(job, report)

        # 4. Source Distribution Breakdown
        source_domains, total_citations = cls._compute_source_distribution(job, report)

        return JobDashboardResponse(
            job_id=job.id,
            target_market=job.target_market,
            geography=job.geography,
            overall_confidence=overall_confidence,
            moat_matrix=moat_matrix,
            vector_scores=vector_scores,
            claims_breakdown=claims_breakdown,
            empirical_facts_count=empirical_count,
            inferred_projections_count=inferred_count,
            source_domains=source_domains,
            total_citations=total_citations,
        )

    @classmethod
    def _compute_vector_scores(
        cls,
        job: Job,
        report: Report | None,
    ) -> list[VectorScoreItem]:
        """
        Extracts confidence, risk posture, and evidence count across the 4 orthogonal research vectors.
        """
        vectors = [
            ("market_overview", "Market Growth & TAM Potential", "market_findings"),
            ("competitor_analysis", "Competitive Moat Durability", "competitor_analysis"),
            ("customer_insights", "Customer Adoption & Pricing", "customer_insights"),
            ("regulatory_risks", "Regulatory & Risk Headwinds", "opportunities_and_risks"),
        ]

        scores: list[VectorScoreItem] = []
        for key, label, report_key in vectors:
            sec_dict: dict[str, Any] = (getattr(report, report_key, None) or {}) if report else {}
            has_data = sec_dict.get("status") == "COMPLETED"
            conf = float(sec_dict.get("confidence") or 0.0) if has_data else 0.0
            citations = sec_dict.get("citations") or []
            summary = sec_dict.get("summary") or ""

            # Risk level reflects the evidence gap: no data or weak support = HIGH.
            if not has_data or conf < 0.33:
                risk_level = "HIGH"
            elif conf < 0.66 or len(citations) < 3:
                risk_level = "MEDIUM"
            else:
                risk_level = "LOW"

            snippet = (summary[:120] + "...") if len(summary) > 120 else summary

            scores.append(
                VectorScoreItem(
                    vector_key=key,
                    label=label,
                    confidence=conf,
                    risk_level=risk_level,
                    evidence_count=len(citations),
                    summary_snippet=snippet,
                )
            )

        return scores

    @classmethod
    def _compute_moat_matrix(
        cls,
        job: Job,
        report: Report | None,
    ) -> list[MoatCompetitorPoint]:
        """
        Competitor technology-moat / pricing-power coordinates require quantitative competitor
        data that the research pipeline does not collect. Rather than invent positions, this
        returns an empty list.
        """
        return []

    @classmethod
    def _classify_claims(
        cls,
        job: Job,
        report: Report | None,
    ) -> tuple[list[ClaimClassification], int, int]:
        """
        Separates claims that quote a cited source URL (empirical) from claims without one (inferred).
        """
        claims: list[ClaimClassification] = []
        empirical_count = 0
        inferred_count = 0

        sections = [
            ("market_overview", getattr(report, "market_findings", {}) if report else {}),
            ("competitor_analysis", getattr(report, "competitor_analysis", {}) if report else {}),
            ("customer_insights", getattr(report, "customer_insights", {}) if report else {}),
            ("regulatory_risks", getattr(report, "opportunities_and_risks", {}) if report else {}),
        ]

        for vector_type, sec_dict in sections:
            kf_list = (sec_dict or {}).get("key_findings") or []
            for kf in kf_list:
                claim_text = kf.get("claim", "")
                src = kf.get("source_url")
                is_empirical = bool(src and src.startswith(("http://", "https://")))
                if is_empirical:
                    empirical_count += 1
                else:
                    inferred_count += 1

                claims.append(
                    ClaimClassification(
                        claim=claim_text,
                        source_url=src,
                        is_empirical=is_empirical,
                        confidence=float(kf.get("confidence") or 0.0),
                        vector_type=vector_type,
                    )
                )

        return claims, empirical_count, inferred_count

    @classmethod
    def _compute_source_distribution(
        cls,
        job: Job,
        report: Report | None,
    ) -> tuple[list[SourceDomainItem], int]:
        """
        Groups verified citations by domain to demonstrate provenance transparency and diversity.
        """
        citations: list[dict[str, Any]] = report.citations if report and report.citations else []
        domain_counts: dict[str, int] = {}

        for c in citations:
            url = c.get("url", "")
            if url:
                parsed = urlparse(url)
                netloc = parsed.netloc.lower()
                # Clean www. prefix
                netloc = re.sub(r"^www\.", "", netloc)
                if netloc:
                    domain_counts[netloc] = domain_counts.get(netloc, 0) + 1

        total = sum(domain_counts.values())
        items: list[SourceDomainItem] = []
        for domain, count in sorted(domain_counts.items(), key=lambda x: x[1], reverse=True):
            pct = round((count / total) * 100, 1) if total else 0.0
            items.append(SourceDomainItem(domain=domain, count=count, percentage=pct))

        return items, total
