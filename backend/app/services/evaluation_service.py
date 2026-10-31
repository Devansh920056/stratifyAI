"""
Decision Evaluation & Historical Backtesting Service.
Tracks empirical outcomes of strategic recommendations, computes Decision Quality Scores (DQS),
and runs counterfactual market backtests against continuous market signals.
"""

import logging
import re
import uuid
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.base import utc_now
from backend.app.models.decision_evaluation import DecisionEvaluation
from backend.app.models.enums import DecisionOutcomeStatus, RecommendationStatus
from backend.app.models.market_signal import MarketSignal
from backend.app.models.recommendation import Recommendation
from backend.app.services.recommendation_service import UNDEFINED_FIELD
from backend.app.schemas.evaluation import (
    BacktestFindingItem,
    BacktestResultResponse,
    BacktestSimulationRequest,
    DecisionAnalyticsSummaryResponse,
    DecisionEvaluationCreateRequest,
    DecisionEvaluationListResponse,
    DecisionEvaluationResponse,
)

logger = logging.getLogger("stratify.services.evaluation")

MIN_KEYWORD_MATCHES = 2
BACKTEST_STOPWORDS = frozenset(
    "about above after against finding source quoted market overview landscape competitive customer insights "
    "regulatory their there these those which would could should being between through while because "
    "decision owner defined evidence support score impact derived effort neutral default assessed".split()
)


class EvaluationService:
    """
    Coordinates decision outcome logging, hypothesis verification, and backtesting.
    """

    @classmethod
    async def record_evaluation(
        cls,
        session: AsyncSession,
        recommendation_id: uuid.UUID,
        req: DecisionEvaluationCreateRequest,
    ) -> DecisionEvaluationResponse | None:
        """
        Records an empirical outcome evaluation for a strategic recommendation.
        Updates recommendation lifecycle status if appropriate.
        """
        rec = await session.get(Recommendation, recommendation_id)
        if not rec:
            return None

        evaluation = DecisionEvaluation(
            recommendation_id=recommendation_id,
            outcome_status=req.outcome_status.upper(),
            evaluator_notes=req.evaluator_notes.strip(),
            actual_outcome=req.actual_outcome.strip(),
            actual_metric_value=req.actual_metric_value.strip() if req.actual_metric_value else None,
            impact_delta=req.impact_delta,
            confidence_score=req.confidence_score,
            metric_evidence=req.metric_evidence or [],
            linked_signal_ids=req.linked_signal_ids or [],
            evaluated_at=utc_now(),
        )
        session.add(evaluation)

        # Transition recommendation status to REVIEWED or IMPLEMENTED if currently DRAFT or APPROVED
        if rec.status in (RecommendationStatus.DRAFT.value, RecommendationStatus.APPROVED.value):
            if req.outcome_status.upper() in (
                DecisionOutcomeStatus.VALIDATED.value,
                DecisionOutcomeStatus.PARTIALLY_VALIDATED.value,
                DecisionOutcomeStatus.INVALIDATED.value,
            ):
                rec.status = RecommendationStatus.REVIEWED.value
            else:
                rec.status = RecommendationStatus.IMPLEMENTED.value

        await session.commit()
        await session.refresh(evaluation)

        return DecisionEvaluationResponse(
            id=evaluation.id,
            recommendation_id=evaluation.recommendation_id,
            outcome_status=evaluation.outcome_status,
            evaluator_notes=evaluation.evaluator_notes,
            actual_outcome=evaluation.actual_outcome,
            actual_metric_value=evaluation.actual_metric_value,
            impact_delta=evaluation.impact_delta,
            confidence_score=evaluation.confidence_score,
            metric_evidence=evaluation.metric_evidence,
            linked_signal_ids=evaluation.linked_signal_ids,
            evaluated_at=evaluation.evaluated_at,
            created_at=evaluation.created_at,
            updated_at=evaluation.updated_at,
            recommendation_title=rec.title,
        )

    @classmethod
    async def get_evaluations_for_recommendation(
        cls, session: AsyncSession, recommendation_id: uuid.UUID
    ) -> list[DecisionEvaluationResponse]:
        """
        Retrieves all outcome logs for a specific recommendation.
        """
        stmt = (
            select(DecisionEvaluation, Recommendation.title.label("rec_title"))
            .join(Recommendation, DecisionEvaluation.recommendation_id == Recommendation.id)
            .where(DecisionEvaluation.recommendation_id == recommendation_id)
            .order_by(DecisionEvaluation.evaluated_at.desc())
        )
        rows = (await session.execute(stmt)).all()

        return [
            DecisionEvaluationResponse(
                id=ev.id,
                recommendation_id=ev.recommendation_id,
                outcome_status=ev.outcome_status,
                evaluator_notes=ev.evaluator_notes,
                actual_outcome=ev.actual_outcome,
                actual_metric_value=ev.actual_metric_value,
                impact_delta=ev.impact_delta,
                confidence_score=ev.confidence_score,
                metric_evidence=ev.metric_evidence,
                linked_signal_ids=ev.linked_signal_ids,
                evaluated_at=ev.evaluated_at,
                created_at=ev.created_at,
                updated_at=ev.updated_at,
                recommendation_title=rec_title,
            )
            for ev, rec_title in rows
        ]

    @classmethod
    async def list_evaluations(
        cls,
        session: AsyncSession,
        outcome_status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> DecisionEvaluationListResponse:
        """
        Lists all recorded evaluations across the system with optional status filtering.
        """
        stmt = (
            select(DecisionEvaluation, Recommendation.title.label("rec_title"))
            .join(Recommendation, DecisionEvaluation.recommendation_id == Recommendation.id)
            .order_by(DecisionEvaluation.evaluated_at.desc())
        )
        count_stmt = select(func.count(DecisionEvaluation.id))

        if outcome_status and outcome_status.upper() != "ALL":
            stmt = stmt.where(DecisionEvaluation.outcome_status == outcome_status.upper())
            count_stmt = count_stmt.where(DecisionEvaluation.outcome_status == outcome_status.upper())

        total = await session.scalar(count_stmt) or 0
        stmt = stmt.limit(limit).offset(offset)
        rows = (await session.execute(stmt)).all()

        evaluations = [
            DecisionEvaluationResponse(
                id=ev.id,
                recommendation_id=ev.recommendation_id,
                outcome_status=ev.outcome_status,
                evaluator_notes=ev.evaluator_notes,
                actual_outcome=ev.actual_outcome,
                actual_metric_value=ev.actual_metric_value,
                impact_delta=ev.impact_delta,
                confidence_score=ev.confidence_score,
                metric_evidence=ev.metric_evidence,
                linked_signal_ids=ev.linked_signal_ids,
                evaluated_at=ev.evaluated_at,
                created_at=ev.created_at,
                updated_at=ev.updated_at,
                recommendation_title=rec_title,
            )
            for ev, rec_title in rows
        ]

        return DecisionEvaluationListResponse(evaluations=evaluations, total=total)

    @classmethod
    async def get_decision_analytics(
        cls, session: AsyncSession
    ) -> DecisionAnalyticsSummaryResponse:
        """
        Computes aggregate metrics: Validation Rate, Mean Impact Delta, and Top Hypotheses.
        """
        total = await session.scalar(select(func.count(DecisionEvaluation.id))) or 0
        if total == 0:
            return DecisionAnalyticsSummaryResponse(
                total_evaluated=0,
                validated_count=0,
                partially_validated_count=0,
                invalidated_count=0,
                in_progress_count=0,
                validation_rate=0.0,
                average_impact_delta=0.0,
                average_confidence=0.0,
                top_validated_hypotheses=[],
                top_failing_hypotheses=[],
            )

        val_count = await session.scalar(
            select(func.count(DecisionEvaluation.id)).where(
                DecisionEvaluation.outcome_status == DecisionOutcomeStatus.VALIDATED.value
            )
        ) or 0

        part_count = await session.scalar(
            select(func.count(DecisionEvaluation.id)).where(
                DecisionEvaluation.outcome_status == DecisionOutcomeStatus.PARTIALLY_VALIDATED.value
            )
        ) or 0

        inval_count = await session.scalar(
            select(func.count(DecisionEvaluation.id)).where(
                DecisionEvaluation.outcome_status == DecisionOutcomeStatus.INVALIDATED.value
            )
        ) or 0

        in_prog_count = await session.scalar(
            select(func.count(DecisionEvaluation.id)).where(
                DecisionEvaluation.outcome_status == DecisionOutcomeStatus.IN_PROGRESS.value
            )
        ) or 0

        avg_delta = await session.scalar(select(func.avg(DecisionEvaluation.impact_delta))) or 0.0
        avg_conf = await session.scalar(select(func.avg(DecisionEvaluation.confidence_score))) or 0.0

        # Effective validation rate = (Validated + 0.5 * Partial) / Evaluated (excluding purely in progress)
        decided_count = val_count + part_count + inval_count
        val_rate = (
            round(((val_count + (part_count * 0.5)) / decided_count) * 100.0, 1)
            if decided_count > 0
            else 0.0
        )

        # Top validated hypotheses
        top_val_stmt = (
            select(Recommendation.title)
            .join(DecisionEvaluation, DecisionEvaluation.recommendation_id == Recommendation.id)
            .where(DecisionEvaluation.outcome_status == DecisionOutcomeStatus.VALIDATED.value)
            .limit(5)
        )
        top_val_rows = (await session.scalars(top_val_stmt)).all()

        # Top failing hypotheses
        top_fail_stmt = (
            select(Recommendation.title)
            .join(DecisionEvaluation, DecisionEvaluation.recommendation_id == Recommendation.id)
            .where(DecisionEvaluation.outcome_status == DecisionOutcomeStatus.INVALIDATED.value)
            .limit(5)
        )
        top_fail_rows = (await session.scalars(top_fail_stmt)).all()

        return DecisionAnalyticsSummaryResponse(
            total_evaluated=total,
            validated_count=val_count,
            partially_validated_count=part_count,
            invalidated_count=inval_count,
            in_progress_count=in_prog_count,
            validation_rate=val_rate,
            average_impact_delta=round(float(avg_delta), 2),
            average_confidence=round(float(avg_conf), 2),
            top_validated_hypotheses=list(top_val_rows),
            top_failing_hypotheses=list(top_fail_rows),
        )

    @classmethod
    async def run_backtest_simulation(
        cls, session: AsyncSession, req: BacktestSimulationRequest
    ) -> BacktestResultResponse:
        """
        Backtests historical recommendations against real-time market signals.
        Verifies whether subsequent market developments confirmed or contradicted recommendations.
        """
        # 1. Determine target recommendations
        rec_stmt = select(Recommendation).order_by(Recommendation.created_at.desc())
        if req.job_id:
            rec_stmt = rec_stmt.where(Recommendation.job_id == req.job_id)
        else:
            rec_stmt = rec_stmt.limit(10)
        recs = (await session.scalars(rec_stmt)).all()

        # 2. Query real market signals inside the requested lookback window
        cutoff = utc_now() - timedelta(days=req.lookback_days)
        signals_stmt = (
            select(MarketSignal)
            .where(MarketSignal.published_at >= cutoff)
            .order_by(MarketSignal.published_at.desc())
            .limit(500)
        )
        all_signals = (await session.scalars(signals_stmt)).all()

        findings: list[BacktestFindingItem] = []
        aligned_count = 0
        divergent_count = 0
        assessed = 0

        for r in recs:
            keywords = cls._extract_keywords(r)

            matched_signals = []
            for s in all_signals:
                sig_text = f"{s.headline} {s.summary}".lower()
                if sum(1 for kw in keywords if kw in sig_text) >= MIN_KEYWORD_MATCHES:
                    matched_signals.append(s)

            signal_count = len(matched_signals)
            if signal_count == 0:
                # No matching real signals: report that honestly instead of assuming sentiment.
                findings.append(
                    BacktestFindingItem(
                        recommendation_id=r.id,
                        title=r.title,
                        original_hypothesis=r.outcome_hypothesis,
                        estimated_impact=r.estimated_impact,
                        market_signal_count=0,
                        market_sentiment_trend=0.0,
                        backtest_verdict="INSUFFICIENT_DATA",
                        confidence=0.0,
                        key_market_evidence=[],
                    )
                )
                continue

            assessed += 1
            avg_sent = sum(s.sentiment_score for s in matched_signals) / signal_count
            evidence = [f"{s.headline} ({s.source_domain})" for s in matched_signals[:3]]

            if avg_sent >= 0.25 and r.estimated_impact >= 7:
                verdict = "STRONGLY_ALIGNED"
                aligned_count += 1
            elif avg_sent >= 0.05:
                verdict = "MODERATELY_ALIGNED"
                aligned_count += 1
            elif avg_sent <= -0.20:
                verdict = "DIVERGENT"
                divergent_count += 1
            else:
                verdict = "NEUTRAL"

            findings.append(
                BacktestFindingItem(
                    recommendation_id=r.id,
                    title=r.title,
                    original_hypothesis=r.outcome_hypothesis,
                    estimated_impact=r.estimated_impact,
                    market_signal_count=signal_count,
                    market_sentiment_trend=round(avg_sent, 2),
                    backtest_verdict=verdict,
                    # Evidence coverage: 5 or more matching signals = 1.0
                    confidence=round(min(1.0, signal_count / 5.0), 2),
                    key_market_evidence=evidence,
                )
            )

        alignment_score = round((aligned_count / assessed) * 100.0, 1) if assessed else 0.0

        return BacktestResultResponse(
            total_recommendations=len(findings),
            aligned_recommendations=aligned_count,
            divergent_recommendations=divergent_count,
            alignment_score=alignment_score,
            findings=findings,
        )

    @staticmethod
    def _extract_keywords(rec: Recommendation) -> list[str]:
        """Distinctive words (>4 letters) from the recommendation text, minus boilerplate."""
        text = f"{rec.title} {rec.description}"
        if rec.outcome_hypothesis and rec.outcome_hypothesis != UNDEFINED_FIELD:
            text += f" {rec.outcome_hypothesis}"
        words = {re.sub(r"[^a-z0-9]", "", w.lower()) for w in text.split()}
        return sorted(w for w in words if len(w) > 4 and w not in BACKTEST_STOPWORDS)
