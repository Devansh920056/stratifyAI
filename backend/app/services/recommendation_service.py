"""
Action Intelligence Recommendation Service.
Derives action items from the real, cited key findings of a job's report. Each recommendation
quotes one finding and its source URL. Business judgments that the data cannot supply (effort,
success metric, target value) are left as explicit "to be defined" fields for the decision owner.
"""

import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.db.base import utc_now
from backend.app.models.enums import RecommendationStatus, TimeHorizon
from backend.app.models.job import Job
from backend.app.models.recommendation import Recommendation
from backend.app.models.report import Report
from backend.app.models.task import Task
from backend.app.providers.llm.base import LLMProvider

logger = logging.getLogger("stratify.services.recommendations")

UNDEFINED_FIELD = "To be defined by the decision owner"


class RecommendationService:
    """
    Coordinates creation, AI generation, and lifecycle transitions for Action Intelligence recommendations.
    """

    @classmethod
    async def get_recommendations_for_job(
        cls,
        session: AsyncSession,
        job_id: uuid.UUID,
    ) -> list[Recommendation]:
        """
        Retrieves all recommendations associated with a job, ordered by priority score descending.
        """
        stmt = (
            select(Recommendation)
            .where(Recommendation.job_id == job_id)
            .order_by(Recommendation.priority_score.desc(), Recommendation.created_at.asc())
        )
        result = await session.scalars(stmt)
        return list(result.all())

    @classmethod
    async def get_recommendation_by_id(
        cls,
        session: AsyncSession,
        recommendation_id: uuid.UUID,
    ) -> Recommendation | None:
        """
        Finds a single recommendation by its UUID.
        """
        stmt = select(Recommendation).where(Recommendation.id == recommendation_id)
        return await session.scalar(stmt)

    @classmethod
    async def update_recommendation_status(
        cls,
        session: AsyncSession,
        recommendation_id: uuid.UUID,
        new_status: RecommendationStatus,
    ) -> Recommendation | None:
        """
        Updates the lifecycle status of a recommendation.
        """
        rec = await cls.get_recommendation_by_id(session, recommendation_id)
        if not rec:
            return None

        rec.status = new_status.value
        rec.updated_at = utc_now()
        await session.commit()
        await session.refresh(rec)
        return rec

    @classmethod
    async def generate_recommendations_for_job(
        cls,
        session: AsyncSession,
        job_id: uuid.UUID,
        llm_provider: LLMProvider | None = None,  # accepted for API compatibility; unused (extractive)
    ) -> list[Recommendation]:
        """
        Derives recommendations from the job's report findings.
        If recommendations already exist, returns the existing list without redundant re-generation.
        """
        existing = await cls.get_recommendations_for_job(session, job_id)
        if existing:
            logger.info(f"Recommendations already exist for job {job_id} ({len(existing)} items).")
            return existing

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

        report = job.report

        persisted_recs: list[Recommendation] = []
        for item in cls._derive_initiatives(report):
            impact = item["estimated_impact"]
            effort = item["estimated_effort"]
            rec = Recommendation(
                job_id=job_id,
                title=item["title"],
                description=item["description"],
                rationale=item["rationale"],
                estimated_impact=impact,
                estimated_effort=effort,
                priority_score=round((impact * 0.7) - (effort * 0.3), 2),
                time_horizon=TimeHorizon.NEAR_TERM.value,
                outcome_hypothesis=UNDEFINED_FIELD,
                success_metric=UNDEFINED_FIELD,
                target_metric_value=None,
                status=RecommendationStatus.DRAFT.value,
                evidence_ids=item["evidence_ids"],
            )
            session.add(rec)
            persisted_recs.append(rec)

        await session.commit()
        for r in persisted_recs:
            await session.refresh(r)

        logger.info(f"Derived and persisted {len(persisted_recs)} recommendations for job {job_id}.")
        return persisted_recs

    @classmethod
    def _derive_initiatives(cls, report: Report | None) -> list[dict[str, Any]]:
        """
        One action item per research vector, built from that vector's best-supported finding.
        - estimated_impact = round(finding evidence-support score x 10), clamped to 1-10.
        - estimated_effort = 5, the neutral midpoint: effort is not measurable from research data.
        """
        if report is None:
            return []

        sections = [
            ("Market Overview", report.market_findings),
            ("Competitive Landscape", report.competitor_analysis),
            ("Customer Insights", report.customer_insights),
            ("Regulatory & Risk", report.opportunities_and_risks),
        ]
        items: list[dict[str, Any]] = []
        for label, section in sections:
            findings = [
                f for f in ((section or {}).get("key_findings") or [])
                if isinstance(f, dict) and f.get("claim") and f.get("source_url")
            ]
            if not findings:
                continue
            best = max(findings, key=lambda f: float(f.get("confidence") or 0.0))
            confidence = float(best.get("confidence") or 0.0)
            claim = str(best["claim"]).strip()
            url = str(best["source_url"])
            cite = next(
                (c for c in ((section or {}).get("citations") or []) if isinstance(c, dict) and c.get("url") == url),
                {"url": url, "title": url},
            )
            items.append(
                {
                    "title": f"Act on {label} finding: {claim}"[:255],
                    "description": f'Source finding ({label}): "{claim}"',
                    "rationale": (
                        f"Quoted from {url}. Evidence-support score {confidence:.2f}. "
                        f"Impact is derived from that score; effort is a neutral default (5) "
                        f"until assessed by the decision owner."
                    ),
                    "estimated_impact": max(1, min(10, round(confidence * 10))),
                    "estimated_effort": 5,
                    "evidence_ids": [cite],
                }
            )
        return items
