"""
Evidence Fusion & Multi-Source Reconciliation Service.
Orchestrates primary statutory filings (SEC EDGAR 10-K/10-Q), technical preprints (arXiv),
and commercial market signals to detect claim contradictions and compute Evidence Reliability Index (ERI).
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.base import utc_now
from backend.app.models.enums import DivergenceStatus, EvidenceSourceType
from backend.app.models.fused_evidence import FusedEvidence
from backend.app.models.market_signal import MarketSignal
from backend.app.providers.arxiv_preprint import ArxivPreprintProvider, ArxivProviderError
from backend.app.providers.sec_edgar import SECFilingsProvider, SECProviderError
from backend.app.schemas.fusion import (
    EvidenceReconciliationSummary,
    FusedEvidenceItem,
    FusedEvidenceListResponse,
)

logger = logging.getLogger("stratify.services.evidence_fusion")

# Transparent lexicons used for tone comparison (substring match on the lower-cased excerpt).
FILING_RISK_TERMS = (
    "adversely", "bottleneck", "delay", "decline", "default", "disruption", "impair", "inability",
    "investigation", "litigation", "recall", "shortage", "unable", "uncertain", "yield",
)
PAPER_LIMITATION_TERMS = (
    "bottleneck", "challenge", "degradation", "failure", "limitation", "limited", "overhead", "unstable",
)
POSITIVE_TONE_THRESHOLD = 0.30


class EvidenceFusionService:
    """
    Coordinates multi-source empirical evidence gathering and cross-source claim reconciliation.
    """

    @classmethod
    async def query_and_fuse_evidence(
        cls,
        session: AsyncSession,
        entity_name: str,
        topic: str | None = None,
        include_sec: bool = True,
        include_arxiv: bool = True,
        reconcile: bool = True,
    ) -> FusedEvidenceListResponse:
        """
        Executes multi-source intelligence gathering across SEC EDGAR and arXiv preprints,
        persists records to PostgreSQL, and runs contradiction detection.
        """
        norm_entity = entity_name.strip()
        fused_items: list[FusedEvidence] = []
        sec_count = 0
        arxiv_count = 0
        warnings: list[str] = []

        # 1. Gather SEC EDGAR Filings
        if include_sec:
            sec_provider = SECFilingsProvider()
            try:
                sec_results = await sec_provider.get_filings_for_entity(norm_entity, max_results=4)
            except SECProviderError as exc:
                logger.warning("SEC EDGAR retrieval failed for '%s': %s", norm_entity, exc)
                warnings.append(f"SEC EDGAR unavailable: {exc}")
                sec_results = []
            for sr in sec_results:
                existing = await session.scalar(
                    select(FusedEvidence).where(
                        FusedEvidence.entity_name.ilike(norm_entity),
                        FusedEvidence.source_type == EvidenceSourceType.SEC_EDGAR.value,
                        FusedEvidence.title == sr.title,
                    )
                )

                if existing:
                    existing.content_excerpt = sr.content_excerpt
                    existing.source_url = sr.source_url
                    existing.reliability_score = sr.reliability_score
                    existing.fiscal_period = sr.fiscal_period
                    existing.metadata_json = sr.metadata
                    existing.updated_at = utc_now()
                    fused_items.append(existing)
                else:
                    record = FusedEvidence(
                        entity_name=sr.entity_name,
                        source_type=EvidenceSourceType.SEC_EDGAR.value,
                        filing_type=sr.filing_type,
                        title=sr.title,
                        content_excerpt=sr.content_excerpt,
                        source_url=sr.source_url,
                        reliability_score=sr.reliability_score,
                        divergence_status=DivergenceStatus.UNVERIFIED.value,
                        fiscal_period=sr.fiscal_period,
                        metadata_json=sr.metadata,
                        created_at=utc_now(),
                        updated_at=utc_now(),
                    )
                    session.add(record)
                    fused_items.append(record)
                sec_count += 1

        # 2. Gather arXiv Technical Preprints
        if include_arxiv:
            arxiv_provider = ArxivPreprintProvider()
            search_term = f"{norm_entity} {topic or ''}".strip()
            try:
                arxiv_results = await arxiv_provider.search_preprints(search_term, max_results=3)
            except ArxivProviderError as exc:
                logger.warning("arXiv retrieval failed for '%s': %s", norm_entity, exc)
                warnings.append(f"arXiv unavailable: {exc}")
                arxiv_results = []
            for ar in arxiv_results:
                existing = await session.scalar(
                    select(FusedEvidence).where(
                        FusedEvidence.entity_name.ilike(norm_entity),
                        FusedEvidence.source_type == EvidenceSourceType.ARXIV_PREPRINT.value,
                        FusedEvidence.title == ar.title,
                    )
                )

                if existing:
                    existing.content_excerpt = ar.abstract_excerpt
                    existing.source_url = ar.source_url
                    existing.reliability_score = ar.reliability_score
                    existing.metadata_json = ar.metadata
                    existing.updated_at = utc_now()
                    fused_items.append(existing)
                else:
                    record = FusedEvidence(
                        entity_name=norm_entity,
                        source_type=EvidenceSourceType.ARXIV_PREPRINT.value,
                        filing_type="ARXIV_PAPER",
                        title=ar.title,
                        content_excerpt=ar.abstract_excerpt,
                        source_url=ar.source_url,
                        reliability_score=ar.reliability_score,
                        divergence_status=DivergenceStatus.UNVERIFIED.value,
                        fiscal_period=ar.published_date,
                        metadata_json=ar.metadata,
                        created_at=utc_now(),
                        updated_at=utc_now(),
                    )
                    session.add(record)
                    fused_items.append(record)
                arxiv_count += 1

        # 3. Cross-Source Reconciliation Engine
        divergent_count = 0
        contradictory_count = 0
        unverified_count = 0

        if reconcile and fused_items:
            # Query existing commercial market signals related to this entity
            sig_stmt = select(MarketSignal).where(
                (MarketSignal.headline.ilike(f"%{norm_entity}%"))
                | (MarketSignal.summary.ilike(f"%{norm_entity}%"))
            ).limit(10)
            sig_res = await session.execute(sig_stmt)
            commercial_signals = sig_res.scalars().all()

            for item in fused_items:
                divergence, notes = cls._evaluate_divergence(item, commercial_signals)
                item.divergence_status = divergence
                item.reconciliation_notes = notes

                if divergence == DivergenceStatus.DIVERGENT.value:
                    divergent_count += 1
                elif divergence == DivergenceStatus.CONTRADICTORY.value:
                    contradictory_count += 1
                elif divergence == DivergenceStatus.UNVERIFIED.value:
                    unverified_count += 1

        await session.commit()
        for f in fused_items:
            await session.refresh(f)

        # Compute Evidence Reliability Index (ERI)
        total_sources = len(fused_items)
        avg_eri = (
            round(sum(x.reliability_score for x in fused_items) / total_sources, 2)
            if total_sources > 0
            else 0.0
        )

        takeaway = cls._generate_reconciliation_takeaway(
            norm_entity, total_sources, divergent_count, contradictory_count, unverified_count, avg_eri
        )

        summary = EvidenceReconciliationSummary(
            entity_name=norm_entity,
            total_fused_sources=total_sources,
            sec_filings_count=sec_count,
            arxiv_preprints_count=arxiv_count,
            divergent_claims_count=divergent_count,
            contradictory_claims_count=contradictory_count,
            evidence_reliability_index=avg_eri,
            reconciliation_takeaway=takeaway,
            unverified_claims_count=unverified_count,
            retrieval_warnings=warnings,
        )

        items_resp = [
            FusedEvidenceItem(
                id=f.id,
                entity_name=f.entity_name,
                source_type=f.source_type,
                filing_type=f.filing_type,
                title=f.title,
                content_excerpt=f.content_excerpt,
                source_url=f.source_url,
                reliability_score=f.reliability_score,
                divergence_status=f.divergence_status,
                reconciliation_notes=f.reconciliation_notes,
                fiscal_period=f.fiscal_period,
                metadata=f.metadata_json or {},
                created_at=f.created_at,
            )
            for f in fused_items
        ]

        return FusedEvidenceListResponse(
            entity_name=norm_entity,
            items=items_resp,
            total=len(items_resp),
            summary=summary,
        )

    @classmethod
    def _evaluate_divergence(
        cls,
        evidence: FusedEvidence,
        signals: list[MarketSignal],
    ) -> tuple[str, str | None]:
        """
        Compares the tone of a filing/paper excerpt against the tone of related stored news.
        This is a keyword-and-sentiment heuristic; the notes always state exactly what matched.
        """
        excerpt_lower = (evidence.content_excerpt or "").lower()
        is_sec = evidence.source_type == EvidenceSourceType.SEC_EDGAR.value
        is_item_1a = (evidence.metadata_json or {}).get("excerpt_kind") == "item_1a_risk_factors"

        if is_sec and not is_item_1a:
            return (
                DivergenceStatus.UNVERIFIED.value,
                "Only filing metadata was available (risk-factor text could not be extracted); content not analysed.",
            )

        terms = FILING_RISK_TERMS if is_sec else PAPER_LIMITATION_TERMS
        matched = [t for t in terms if t in excerpt_lower]
        label = "risk-language" if is_sec else "limitation-language"

        if not signals:
            return (
                DivergenceStatus.UNVERIFIED.value,
                "No related news signals are stored for this entity, so there is nothing to compare against. "
                "Sync Market Pulse signals and re-run.",
            )

        positive = [s for s in signals if s.sentiment_score >= POSITIVE_TONE_THRESHOLD]
        if matched and positive:
            sig = max(positive, key=lambda s: s.sentiment_score)
            status = DivergenceStatus.CONTRADICTORY if is_sec else DivergenceStatus.DIVERGENT
            return (
                status.value,
                f"Tone mismatch: the excerpt contains {label} terms ({', '.join(matched)}), while "
                f"{len(positive)} of {len(signals)} related news signal(s) have positive tone "
                f"(e.g. '{sig.headline[:90]}', {sig.sentiment_score:+.2f}).",
            )
        if matched:
            return (
                DivergenceStatus.DIVERGENT.value,
                f"The excerpt contains {label} terms ({', '.join(matched)}); none of the {len(signals)} related "
                f"news signal(s) has positive tone, so no direct mismatch was found.",
            )
        return (
            DivergenceStatus.ALIGNED.value,
            f"No {label} terms matched in the excerpt; compared against {len(signals)} related news signal(s).",
        )

    @classmethod
    def _generate_reconciliation_takeaway(
        cls,
        entity_name: str,
        total_sources: int,
        divergent: int,
        contradictory: int,
        unverified: int,
        eri: float,
    ) -> str:
        """Factual one-line summary of reconciliation results."""
        if total_sources == 0:
            return f"No SEC filings or arXiv preprints were retrieved for {entity_name}."
        return (
            f"{total_sources} source(s) retrieved for {entity_name}: {contradictory} tone-contradictory, "
            f"{divergent} divergent, {unverified} unverified, "
            f"{total_sources - contradictory - divergent - unverified} aligned. "
            f"Mean source-class reliability prior: {eri:.2f} (a fixed prior per source type, not a measurement)."
        )

    @classmethod
    async def get_fused_evidence(
        cls,
        session: AsyncSession,
        entity_name: str | None = None,
        source_type: str | None = None,
        divergence_status: str | None = None,
        limit: int = 50,
    ) -> FusedEvidenceListResponse:
        """
        Retrieves stored fused evidence items with flexible filtering.
        """
        stmt = select(FusedEvidence).order_by(FusedEvidence.created_at.desc())

        if entity_name:
            stmt = stmt.where(FusedEvidence.entity_name.ilike(f"%{entity_name}%"))
        if source_type and source_type != "ALL":
            stmt = stmt.where(FusedEvidence.source_type == source_type)
        if divergence_status and divergence_status != "ALL":
            stmt = stmt.where(FusedEvidence.divergence_status == divergence_status)

        stmt = stmt.limit(limit)
        res = await session.execute(stmt)
        items = res.scalars().all()

        items_resp = [
            FusedEvidenceItem(
                id=f.id,
                entity_name=f.entity_name,
                source_type=f.source_type,
                filing_type=f.filing_type,
                title=f.title,
                content_excerpt=f.content_excerpt,
                source_url=f.source_url,
                reliability_score=f.reliability_score,
                divergence_status=f.divergence_status,
                reconciliation_notes=f.reconciliation_notes,
                fiscal_period=f.fiscal_period,
                metadata=f.metadata_json or {},
                created_at=f.created_at,
            )
            for f in items
        ]

        return FusedEvidenceListResponse(
            entity_name=entity_name or "Global Cross-Source Index",
            items=items_resp,
            total=len(items_resp),
            summary=None,
        )
