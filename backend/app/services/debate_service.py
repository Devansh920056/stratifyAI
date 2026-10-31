"""
Evidence-Grounded Debate Service (Stage 10).

Builds a structured bull / bear / regulatory / arbiter debate where every statement is a
listing or quotation of stored evidence (SEC filing excerpts, arXiv abstracts, news signals)
with its source. No text is generated from imagination and no figures are assumed:

* Bull case   = positive-tone news signals about the entity.
* Bear case   = SEC risk-factor excerpts and negative-tone news signals.
* Regulatory  = regulatory-update signals, regulatory terms in filings, arXiv limitations.
* Arbiter     = a published rule applied to the counted evidence (see ``_arbitrate``).

When no evidence exists the debate says so and the verdict is NEUTRAL_HOLD with 0% conviction.
"""

import logging
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime

from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from backend.app.models.debate import Debate, DebateMessage
from backend.app.models.enums import (
    AgentDebateRole,
    ArbiterVerdict,
    ArgumentType,
    DebateStatus,
    EvidenceSourceType,
    SignalType,
)
from backend.app.models.fused_evidence import FusedEvidence
from backend.app.models.market_signal import MarketSignal
from backend.app.schemas.debate import (
    DebateDetailResponse,
    DebateInitiateRequest,
    DebateListItem,
    DebateListResponse,
    DebateMessageItem,
)
from backend.app.services.fusion_service import (
    FILING_RISK_TERMS,
    PAPER_LIMITATION_TERMS,
    EvidenceFusionService,
)

logger = logging.getLogger("stratify.debate_service")

POSITIVE_TONE = 0.15
NEGATIVE_TONE = -0.15
REGULATORY_TERMS = ("regulat", "recall", "investigation", "compliance", "antitrust", "litigation", "sanction")
# Declared methodology: relative weight of each source class in the arbiter's score.
SOURCE_WEIGHTS = {"SEC_EDGAR": 0.50, "ARXIV_PREPRINT": 0.30, "COMMERCIAL_NEWS": 0.20}
CONVICTION_FULL_AT = 10  # polarised evidence items at which conviction reaches 100%


def _excerpt(text: str | None, limit: int = 280) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= limit else text[:limit].rsplit(" ", 1)[0] + "..."


@dataclass
class _Evidence:
    """One piece of stored evidence with a polarity assigned by transparent rules."""

    source: str  # SEC_EDGAR | ARXIV_PREPRINT | COMMERCIAL_NEWS
    title: str
    reference_id: str
    url: str
    detail: str  # quoted excerpt or tone description
    polarity: str  # BULL | BEAR | NEUTRAL
    regulatory: bool = False
    matched_terms: list[str] = field(default_factory=list)

    def citation(self) -> dict:
        return {
            "source_type": self.source,
            "title": self.title,
            "reference_id": self.reference_id,
            "url": self.url,
            "reconciliation_impact": self.detail,
        }

    def line(self) -> str:
        return f"- **{self.title}** ({self.reference_id}): {self.detail}"


class MultiAgentDebateService:
    @classmethod
    async def initiate_debate(
        cls, session: AsyncSession, request: DebateInitiateRequest
    ) -> DebateDetailResponse:
        """Builds and stores an evidence-grounded debate for the entity/topic."""
        entity = request.entity_name.strip()
        topic = request.topic.strip()
        rounds = min(max(request.rounds_count, 1), 5)
        logger.info(f"Initiating evidence-grounded debate for '{entity}' on topic: '{topic}'")

        sec_filings, arxiv_papers = await cls._load_fused(session, entity)
        if not sec_filings and not arxiv_papers:
            # Nothing stored yet: try to retrieve real evidence now (failures are tolerated).
            try:
                await EvidenceFusionService.query_and_fuse_evidence(session, entity, topic)
            except Exception as exc:
                logger.warning(f"Live evidence retrieval failed for '{entity}': {exc}")
            sec_filings, arxiv_papers = await cls._load_fused(session, entity)

        signals_stmt = (
            select(MarketSignal)
            .where(
                or_(
                    func.lower(MarketSignal.headline).contains(entity.lower()),
                    func.lower(MarketSignal.summary).contains(entity.lower()),
                )
            )
            .order_by(desc(MarketSignal.published_at))
            .limit(12)
        )
        market_signals = (await session.execute(signals_stmt)).scalars().all()

        evidence = cls._classify(sec_filings, arxiv_papers, market_signals)
        bulls = [e for e in evidence if e.polarity == "BULL"]
        bears = [e for e in evidence if e.polarity == "BEAR"]
        regs = [e for e in evidence if e.regulatory]
        arbitration = cls._arbitrate(evidence)

        now = datetime.now(UTC)
        debate = Debate(
            id=uuid.uuid4(),
            topic=topic,
            entity_name=entity,
            status=DebateStatus.IN_PROGRESS.value,
            rounds_count=rounds,
            synthesis_matrix={},
            created_at=now,
            updated_at=now,
        )
        session.add(debate)
        await session.flush()

        total = len(evidence)

        def make_msg(role, name, rnd, arg_type, content, cites, conf) -> DebateMessage:
            return DebateMessage(
                id=uuid.uuid4(),
                debate_id=debate.id,
                agent_role=role.value,
                agent_name=name,
                round_number=rnd,
                argument_type=arg_type.value,
                content=content,
                evidence_citations=[c.citation() for c in cites],
                confidence_score=round(conf, 2),
                created_at=datetime.now(UTC),
            )

        def share(n: int) -> float:
            return n / total if total else 0.0

        messages: list[DebateMessage] = []

        # Round 1 - opening statements
        messages.append(
            make_msg(
                AgentDebateRole.BULL_SPECIALIST, "Bull case (positive-tone news)", 1, ArgumentType.THESIS,
                cls._render_case(
                    f"Supporting evidence for {entity}: {topic}", bulls[:3],
                    "No positive-tone news signals about this entity are stored, so the bull case has no supporting evidence.",
                ),
                bulls[:3], share(len(bulls)),
            )
        )
        messages.append(
            make_msg(
                AgentDebateRole.BEAR_RISK_OFFICER, "Bear case (filing risks & negative news)", 1, ArgumentType.ANTITHESIS,
                cls._render_case(
                    f"Risk evidence for {entity}: {topic}", bears[:3],
                    "No risk-factor filing text or negative-tone news about this entity is stored, so the bear case has no supporting evidence.",
                ),
                bears[:3], share(len(bears)),
            )
        )

        # Round 2 - remaining evidence on each side
        if rounds >= 2:
            messages.append(
                make_msg(
                    AgentDebateRole.BULL_SPECIALIST, "Bull case (positive-tone news)", 2, ArgumentType.REBUTTAL,
                    cls._render_case("Further supporting evidence", bulls[3:6], "No further supporting evidence is stored."),
                    bulls[3:6], share(len(bulls[3:6])),
                )
            )
            messages.append(
                make_msg(
                    AgentDebateRole.BEAR_RISK_OFFICER, "Bear case (filing risks & negative news)", 2, ArgumentType.REBUTTAL,
                    cls._render_case("Further risk evidence", bears[3:6], "No further risk evidence is stored."),
                    bears[3:6], share(len(bears[3:6])),
                )
            )

        # Round 3 - regulatory & technical review
        if rounds >= 3:
            papers = [e for e in evidence if e.source == "ARXIV_PREPRINT"][:2]
            reg_pool = (regs + [p for p in papers if p not in regs])[:4]
            messages.append(
                make_msg(
                    AgentDebateRole.REGULATORY_AUDITOR, "Regulatory & technical review", 3,
                    ArgumentType.REGULATORY_CHALLENGE,
                    cls._render_case(
                        "Regulatory and technical evidence", reg_pool,
                        "No regulatory-update signals, regulatory terms in filings, or related arXiv papers are stored.",
                    ),
                    reg_pool, share(len(regs)),
                )
            )

        # Arbiter
        verdict = arbitration["verdict"]
        conviction = arbitration["conviction"]
        tripwires = cls._tripwires(bears)
        summary_text = cls._summary(entity, evidence, bulls, bears, arbitration)
        messages.append(
            make_msg(
                AgentDebateRole.PRINCIPAL_ARBITER, "Arbiter (rule-based)", rounds, ArgumentType.SYNTHESIS,
                (
                    f"### Rule-based verdict: {verdict.replace('_', ' ')}\n\n"
                    f"**Evidence coverage**: `{conviction:.0%}` | **Bull score** {arbitration['bull_score']:.2f} "
                    f"vs **Bear score** {arbitration['bear_score']:.2f}\n\n{summary_text}\n\n"
                    + (
                        "#### Monitoring triggers (from the cited risks)\n"
                        + "\n".join(f"- {t}" for t in tripwires)
                        if tripwires
                        else "No monitoring triggers: no risk evidence is stored."
                    )
                ),
                (bulls[:1] + bears[:2] + [e for e in evidence if e.source == "ARXIV_PREPRINT"][:1]),
                conviction,
            )
        )

        for msg in messages:
            session.add(msg)

        reg_share = round(share(len(regs)), 2)
        debate.status = DebateStatus.CONCLUDED.value
        debate.arbiter_verdict = verdict
        debate.conviction_score = conviction
        debate.executive_summary = summary_text
        debate.synthesis_matrix = {
            "bull_score": arbitration["bull_score"],
            "bear_score": arbitration["bear_score"],
            "regulatory_risk_score": reg_share,
            "primary_growth_vector": bulls[0].title if bulls else None,
            "primary_vulnerability": bears[0].title if bears else None,
            "tripwires": tripwires,
            "evidence_weighting": {
                "statutory_sec_weight": SOURCE_WEIGHTS["SEC_EDGAR"],
                "scientific_arxiv_weight": SOURCE_WEIGHTS["ARXIV_PREPRINT"],
                "commercial_news_weight": SOURCE_WEIGHTS["COMMERCIAL_NEWS"],
            },
            "evidence_counts": {
                "sec_filings": len(sec_filings),
                "arxiv_papers": len(arxiv_papers),
                "news_signals": len(market_signals),
                "bull": len(bulls),
                "bear": len(bears),
            },
        }
        debate.updated_at = datetime.now(UTC)

        await session.commit()
        await session.refresh(debate)

        stmt = select(Debate).options(joinedload(Debate.messages)).where(Debate.id == debate.id)
        full_debate = (await session.execute(stmt)).unique().scalar_one()
        logger.info(f"Concluded debate {full_debate.id} with verdict {verdict} and {len(messages)} messages.")
        return cls._to_detail_response(full_debate)

    # ------------------------------------------------------------------ helpers
    @classmethod
    async def _load_fused(cls, session: AsyncSession, entity: str):
        async def fetch(source_type: str, limit: int):
            stmt = (
                select(FusedEvidence)
                .where(
                    func.lower(FusedEvidence.entity_name).contains(entity.lower()),
                    FusedEvidence.source_type == source_type,
                )
                .order_by(desc(FusedEvidence.created_at))
                .limit(limit)
            )
            return (await session.execute(stmt)).scalars().all()

        return (
            await fetch(EvidenceSourceType.SEC_EDGAR.value, 5),
            await fetch(EvidenceSourceType.ARXIV_PREPRINT.value, 3),
        )

    @classmethod
    def _classify(cls, sec_filings, arxiv_papers, signals) -> list[_Evidence]:
        items: list[_Evidence] = []
        for f in sec_filings:
            meta = f.metadata_json or {}
            text = (f.content_excerpt or "").lower()
            is_1a = meta.get("excerpt_kind") == "item_1a_risk_factors"
            terms = [t for t in FILING_RISK_TERMS if t in text] if is_1a else []
            items.append(
                _Evidence(
                    source="SEC_EDGAR", title=f.title, reference_id=meta.get("accession_number", "SEC filing"),
                    url=f.source_url,
                    detail=f'"{_excerpt(f.content_excerpt)}"' + (f" [risk terms: {', '.join(terms)}]" if terms else ""),
                    polarity="BEAR" if terms else "NEUTRAL",
                    regulatory=any(t in text for t in REGULATORY_TERMS) if is_1a else False,
                    matched_terms=terms,
                )
            )
        for p in arxiv_papers:
            meta = p.metadata_json or {}
            text = (p.content_excerpt or "").lower()
            terms = [t for t in PAPER_LIMITATION_TERMS if t in text]
            items.append(
                _Evidence(
                    source="ARXIV_PREPRINT", title=p.title, reference_id=f"arXiv:{meta.get('arxiv_id', '')}",
                    url=p.source_url,
                    detail=f'"{_excerpt(p.content_excerpt)}"' + (f" [limitation terms: {', '.join(terms)}]" if terms else ""),
                    polarity="BEAR" if terms else "NEUTRAL",
                    matched_terms=terms,
                )
            )
        for s in signals:
            if s.sentiment_score >= POSITIVE_TONE:
                polarity = "BULL"
            elif s.sentiment_score <= NEGATIVE_TONE:
                polarity = "BEAR"
            else:
                polarity = "NEUTRAL"
            items.append(
                _Evidence(
                    source="COMMERCIAL_NEWS", title=s.headline, reference_id=s.source_domain, url=s.source_url,
                    detail=f"headline tone {s.sentiment_score:+.2f}, signal type {s.signal_type}",
                    polarity=polarity,
                    regulatory=s.signal_type == SignalType.REGULATORY_UPDATE.value,
                )
            )
        return items

    @classmethod
    def _arbitrate(cls, evidence: list[_Evidence]) -> dict:
        """
        Published rule:
          per source class: bull_share = bull items / items, bear_share = bear items / items;
          score = weighted average of shares over the source classes present (weights SOURCE_WEIGHTS).
          diff = bull - bear  ->  >=0.40 STRONG_BUY | >=0.15 STRATEGIC_ACCUMULATE | >-0.15 NEUTRAL_HOLD
                                  | >-0.40 DEFENSIVE_HEDGE | else DIVEST_AVOID
          conviction = polarised items / CONVICTION_FULL_AT, capped at 1 (evidence coverage, not a probability).
        """
        if not evidence:
            return {"verdict": ArbiterVerdict.NEUTRAL_HOLD.value, "conviction": 0.0, "bull_score": 0.0, "bear_score": 0.0}

        weight_sum = bull = bear = 0.0
        for source, weight in SOURCE_WEIGHTS.items():
            group = [e for e in evidence if e.source == source]
            if not group:
                continue
            weight_sum += weight
            bull += weight * sum(1 for e in group if e.polarity == "BULL") / len(group)
            bear += weight * sum(1 for e in group if e.polarity == "BEAR") / len(group)
        bull_score, bear_score = round(bull / weight_sum, 2), round(bear / weight_sum, 2)

        diff = bull_score - bear_score
        if diff >= 0.40:
            verdict = ArbiterVerdict.STRONG_BUY
        elif diff >= 0.15:
            verdict = ArbiterVerdict.STRATEGIC_ACCUMULATE
        elif diff > -0.15:
            verdict = ArbiterVerdict.NEUTRAL_HOLD
        elif diff > -0.40:
            verdict = ArbiterVerdict.DEFENSIVE_HEDGE
        else:
            verdict = ArbiterVerdict.DIVEST_AVOID

        polarised = sum(1 for e in evidence if e.polarity != "NEUTRAL")
        return {
            "verdict": verdict.value,
            "conviction": round(min(1.0, polarised / CONVICTION_FULL_AT), 2),
            "bull_score": bull_score,
            "bear_score": bear_score,
        }

    @staticmethod
    def _render_case(heading: str, items: list[_Evidence], empty_text: str) -> str:
        if not items:
            return f"### {heading}\n\n{empty_text}"
        return f"### {heading}\n\n" + "\n".join(e.line() for e in items)

    @staticmethod
    def _tripwires(bears: list[_Evidence]) -> list[str]:
        return [f"Re-run this debate when new evidence changes: {e.title} ({e.reference_id})." for e in bears[:3]]

    @staticmethod
    def _summary(entity: str, evidence: list[_Evidence], bulls, bears, arb: dict) -> str:
        if not evidence:
            return (
                f"No stored evidence (SEC filings, arXiv papers or news signals) was found for {entity}. "
                f"No verdict can be supported; the default is NEUTRAL HOLD with 0% evidence coverage."
            )
        by_source = {s: sum(1 for e in evidence if e.source == s) for s in SOURCE_WEIGHTS}
        return (
            f"Rule-based arbitration over {len(evidence)} stored item(s) for {entity} "
            f"({by_source['SEC_EDGAR']} SEC filing(s), {by_source['ARXIV_PREPRINT']} arXiv paper(s), "
            f"{by_source['COMMERCIAL_NEWS']} news signal(s)): {len(bulls)} favourable, {len(bears)} adverse. "
            f"Verdict {arb['verdict'].replace('_', ' ')} (bull {arb['bull_score']:.2f} vs bear {arb['bear_score']:.2f}); "
            f"evidence coverage {arb['conviction']:.0%}. This is a keyword/tone heuristic over the cited sources, not investment advice."
        )

    @classmethod
    async def get_debate(
        cls, session: AsyncSession, debate_id: uuid.UUID
    ) -> DebateDetailResponse | None:
        """Fetches full debate details including chronological messages and citations."""
        stmt = (
            select(Debate)
            .options(joinedload(Debate.messages))
            .where(Debate.id == debate_id)
        )
        res = await session.execute(stmt)
        debate = res.unique().scalar_one_or_none()
        if not debate:
            return None
        return cls._to_detail_response(debate)

    @classmethod
    async def list_debates(
        cls, session: AsyncSession, entity_name: str | None = None, limit: int = 20
    ) -> DebateListResponse:
        """Lists recent dialectic debates with optional entity filter."""
        query = select(Debate)
        if entity_name:
            query = query.where(func.lower(Debate.entity_name).contains(entity_name.lower().strip()))
        query = query.order_by(desc(Debate.created_at)).limit(limit)

        res = await session.execute(query)
        debates = res.scalars().all()
        total = len(debates)

        items = [
            DebateListItem(
                id=d.id,
                topic=d.topic,
                entity_name=d.entity_name,
                status=d.status,
                rounds_count=d.rounds_count,
                arbiter_verdict=d.arbiter_verdict,
                conviction_score=d.conviction_score,
                executive_summary=d.executive_summary,
                created_at=d.created_at,
            )
            for d in debates
        ]
        return DebateListResponse(debates=items, total=total)

    @classmethod
    def _to_detail_response(cls, debate: Debate) -> DebateDetailResponse:
        messages_sorted = sorted(debate.messages, key=lambda m: m.created_at)
        return DebateDetailResponse(
            id=debate.id,
            topic=debate.topic,
            entity_name=debate.entity_name,
            status=debate.status,
            rounds_count=debate.rounds_count,
            arbiter_verdict=debate.arbiter_verdict,
            conviction_score=debate.conviction_score,
            executive_summary=debate.executive_summary,
            synthesis_matrix=debate.synthesis_matrix or {},
            created_at=debate.created_at,
            updated_at=debate.updated_at,
            messages=[
                DebateMessageItem(
                    id=m.id,
                    debate_id=m.debate_id,
                    agent_role=m.agent_role,
                    agent_name=m.agent_name,
                    round_number=m.round_number,
                    argument_type=m.argument_type,
                    content=m.content,
                    evidence_citations=m.evidence_citations or [],
                    confidence_score=m.confidence_score,
                    created_at=m.created_at,
                )
                for m in messages_sorted
            ],
        )
