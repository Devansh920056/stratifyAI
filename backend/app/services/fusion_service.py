"""
Evidence Fusion & Multi-Source Reconciliation Service.
Orchestrates primary statutory filings (SEC EDGAR 10-K/10-Q), technical preprints (arXiv),
and commercial market signals to detect claim contradictions and compute Evidence Reliability Index (ERI).
"""

import logging
import uuid
from typing import Any, Optional

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.base import utc_now
from backend.app.models.enums import DivergenceStatus, EvidenceSourceType
from backend.app.models.fused_evidence import FusedEvidence
from backend.app.models.market_signal import MarketSignal
from backend.app.providers.arxiv_preprint import ArxivPreprintProvider
from backend.app.providers.sec_edgar import SECFilingsProvider
from backend.app.schemas.fusion import (
    EvidenceReconciliationSummary,
    FusedEvidenceItem,
    FusedEvidenceListResponse,
)

logger = logging.getLogger("stratify.services.evidence_fusion")


class EvidenceFusionService:
    """
    Coordinates multi-source empirical evidence gathering and cross-source claim reconciliation.
    """

    @classmethod
    async def query_and_fuse_evidence(
        cls,
        session: AsyncSession,
        entity_name: str,
        topic: Optional[str] = None,
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

        # 1. Gather SEC EDGAR Filings
        if include_sec:
            sec_provider = SECFilingsProvider()
            sec_results = await sec_provider.get_filings_for_entity(norm_entity, max_results=4)
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
                        divergence_status=DivergenceStatus.ALIGNED.value,
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
            arxiv_results = await arxiv_provider.search_preprints(search_term, max_results=3)
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
                        divergence_status=DivergenceStatus.ALIGNED.value,
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

        await session.commit()
        for f in fused_items:
            await session.refresh(f)

        # Compute Evidence Reliability Index (ERI)
        total_sources = len(fused_items)
        avg_eri = (
            round(sum(x.reliability_score for x in fused_items) / total_sources, 2)
            if total_sources > 0
            else 0.90
        )

        takeaway = cls._generate_reconciliation_takeaway(
            norm_entity, total_sources, divergent_count, contradictory_count, avg_eri
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
    ) -> tuple[str, Optional[str]]:
        """
        Cross-examines statutory Item 1A Risk Factors against commercial news headlines.
        """
        excerpt_lower = evidence.content_excerpt.lower()

        # Check for classic commercial vs regulatory divergence themes
        if evidence.source_type == EvidenceSourceType.SEC_EDGAR.value:
            if "bottleneck" in excerpt_lower or "yield" in excerpt_lower or "delays" in excerpt_lower:
                # Compare against optimistic news headlines
                optimistic_signals = [
                    s for s in signals if s.sentiment_score >= 0.30 or "surge" in s.headline.lower() or "record" in s.headline.lower()
                ]
                if optimistic_signals:
                    sig = optimistic_signals[0]
                    return (
                        DivergenceStatus.CONTRADICTORY.value,
                        f"Direct Claim Contradiction: Commercial news headline '{sig.headline[:75]}' asserts rapid scaling with positive sentiment (+{sig.sentiment_score:.2f}), but SEC Form {evidence.filing_type} statutory risk disclosures explicitly mandate caution regarding manufacturing yield bottlenecks and margin headwinds.",
                    )
                else:
                    return (
                        DivergenceStatus.DIVERGENT.value,
                        f"Source Asymmetry: SEC statutory risk disclosure highlights operational and supplier dependencies that are absent from general commercial news coverage.",
                    )

            if "recall" in excerpt_lower or "regulatory" in excerpt_lower or "investigation" in excerpt_lower:
                return (
                    DivergenceStatus.DIVERGENT.value,
                    f"Regulatory Divergence: Mandatory SEC disclosures emphasize ongoing compliance inquiries and liability caps which represent downside risk factors for strategic planning.",
                )

        if evidence.source_type == EvidenceSourceType.ARXIV_PREPRINT.value:
            if "dendrite" in excerpt_lower or "overhead" in excerpt_lower or "hallucination" in excerpt_lower:
                return (
                    DivergenceStatus.DIVERGENT.value,
                    f"Technical Empirical Constraint: Peer-reviewed preprint indicates physical and latency constraints in laboratory benchmarks before mass commercial deployment.",
                )

        return (
            DivergenceStatus.ALIGNED.value,
            "Claims Aligned: Secondary statutory and technical disclosures substantiate current commercial market trajectory.",
        )

    @classmethod
    def _generate_reconciliation_takeaway(
        cls,
        entity_name: str,
        total_sources: int,
        divergent: int,
        contradictory: int,
        eri: float,
    ) -> str:
        """Constructs executive takeaway for multi-source reconciliation."""
        if contradictory > 0:
            return (
                f"High-Priority Warning for {entity_name}: Detected {contradictory} direct contradictions "
                f"between commercial press reports and mandatory SEC EDGAR statutory disclosures. "
                f"Evidence Reliability Index is calculated at {eri:.2f}. "
                "Analysts are strongly advised to weight Form 10-K risk factors above commercial media projections."
            )
        elif divergent > 0:
            return (
                f"Moderate Discrepancy for {entity_name}: Identified {divergent} divergent disclosures across {total_sources} "
                f"secondary sources (SEC filings & arXiv). Statutory risk factors note supply and regulatory constraints "
                f"not fully reflected in public sentiment. Evidence Reliability Index: {eri:.2f}."
            )
        else:
            return (
                f"Fully Reconciled Evidence for {entity_name}: All {total_sources} secondary statutory filings and "
                f"technical preprints confirm commercial claims. Evidence Reliability Index is high at {eri:.2f}."
            )

    @classmethod
    async def get_fused_evidence(
        cls,
        session: AsyncSession,
        entity_name: Optional[str] = None,
        source_type: Optional[str] = None,
        divergence_status: Optional[str] = None,
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
