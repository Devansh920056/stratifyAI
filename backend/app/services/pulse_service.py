"""
Market Pulse Ingestion Service.
Ingests, canonicalizes and deduplicates real news articles from the GDELT 2.0 DOC API.
Sentiment and signal type are computed from each headline with a transparent keyword lexicon.
If GDELT is unreachable the sync fails with PulseSyncError - no substitute data is generated.
"""

import logging
import re
import urllib.parse
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.base import utc_now
from backend.app.models.enums import SignalType
from backend.app.models.market_signal import MarketSignal
from backend.app.providers.search.sanitizer import normalize_url
from backend.app.schemas.pulse import (
    DomainStatItem,
    MarketPulseStatsResponse,
    SectorStatItem,
)

logger = logging.getLogger("stratify.services.pulse")

GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc"


class PulseSyncError(Exception):
    """Raised when the upstream news source cannot be reached or returns an invalid response."""


def parse_gdelt_seendate(value: str | None) -> datetime | None:
    """Parses GDELT's 'YYYYMMDDTHHMMSSZ' timestamp; returns None when absent/invalid."""
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y%m%dT%H%M%SZ").replace(tzinfo=UTC)
    except ValueError:
        return None


def term_coverage(terms_source: str, text: str) -> float:
    """Share of the significant words of `terms_source` that appear in `text` (0-1)."""
    terms = {w.lower() for w in re.findall(r"[A-Za-z0-9]{3,}", terms_source)}
    terms -= {"and", "the", "for"}
    if not terms:
        return 0.0
    hay = text.lower()
    return round(sum(1 for t in terms if t in hay) / len(terms), 2)


class MarketPulseService:
    """
    Coordinates real-time ingestion, sentiment scoring, and signal tracking.
    """

    @classmethod
    async def get_signals(
        cls,
        session: AsyncSession,
        sector: str | None = None,
        signal_type: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[MarketSignal], int]:
        """
        Retrieves paginated market signals with optional sector and signal type filters.
        """
        stmt = select(MarketSignal)
        count_stmt = select(func.count(MarketSignal.id))

        if sector and sector.lower() not in ("all", "global"):
            stmt = stmt.where(MarketSignal.market_sector.ilike(f"%{sector}%"))
            count_stmt = count_stmt.where(MarketSignal.market_sector.ilike(f"%{sector}%"))

        if signal_type and signal_type.upper() != "ALL":
            stmt = stmt.where(MarketSignal.signal_type == signal_type.upper())
            count_stmt = count_stmt.where(MarketSignal.signal_type == signal_type.upper())

        total = await session.scalar(count_stmt) or 0

        stmt = stmt.order_by(MarketSignal.published_at.desc(), MarketSignal.created_at.desc())
        stmt = stmt.limit(limit).offset(offset)

        result = await session.scalars(stmt)
        return list(result.all()), int(total)

    @classmethod
    async def get_stats(cls, session: AsyncSession) -> MarketPulseStatsResponse:
        """
        Computes aggregate volume velocity, sentiment distributions, and top domains.
        """
        total = await session.scalar(select(func.count(MarketSignal.id))) or 0
        if total == 0:
            return MarketPulseStatsResponse(
                total_signals=0,
                positive_signals=0,
                neutral_signals=0,
                negative_signals=0,
                average_sentiment=0.0,
                top_sectors=[],
                top_domains=[],
            )

        # Sentiment breakdown
        pos_count = await session.scalar(
            select(func.count(MarketSignal.id)).where(MarketSignal.sentiment_score > 0.15)
        ) or 0
        neg_count = await session.scalar(
            select(func.count(MarketSignal.id)).where(MarketSignal.sentiment_score < -0.15)
        ) or 0
        neutral_count = total - (pos_count + neg_count)

        avg_sentiment = await session.scalar(select(func.avg(MarketSignal.sentiment_score))) or 0.0

        # Top sectors
        sector_rows = await session.execute(
            select(
                MarketSignal.market_sector,
                func.count(MarketSignal.id).label("cnt"),
                func.avg(MarketSignal.sentiment_score).label("avg_sent"),
            )
            .group_by(MarketSignal.market_sector)
            .order_by(func.count(MarketSignal.id).desc())
            .limit(5)
        )
        top_sectors = [
            SectorStatItem(
                sector=row[0],
                count=int(row[1]),
                avg_sentiment=round(float(row[2] or 0.0), 2),
            )
            for row in sector_rows.all()
        ]

        # Top domains
        domain_rows = await session.execute(
            select(MarketSignal.source_domain, func.count(MarketSignal.id))
            .group_by(MarketSignal.source_domain)
            .order_by(func.count(MarketSignal.id).desc())
            .limit(5)
        )
        top_domains = [
            DomainStatItem(domain=row[0], count=int(row[1]))
            for row in domain_rows.all()
        ]

        return MarketPulseStatsResponse(
            total_signals=total,
            positive_signals=pos_count,
            neutral_signals=neutral_count,
            negative_signals=neg_count,
            average_sentiment=round(float(avg_sentiment), 2),
            top_sectors=top_sectors,
            top_domains=top_domains,
        )

    @classmethod
    async def ingest_live_signals(
        cls,
        session: AsyncSession,
        sector: str = "Climate Tech",
        max_records: int = 15,
    ) -> list[MarketSignal]:
        """
        Fetches live news events via GDELT 2.0 DOC API (with graceful fallback),
        normalizes URLs, scores sentiment tone, and inserts new records idempotently.
        """
        articles = await cls._fetch_gdelt_articles(sector=sector, max_records=max_records)

        inserted_signals: list[MarketSignal] = []

        for art in articles:
            raw_url = art.get("url", "")
            headline = (art.get("title") or "").strip()
            if not raw_url or not headline:
                continue

            canonical_url = normalize_url(raw_url)
            parsed = urllib.parse.urlparse(canonical_url)
            domain = (art.get("domain") or parsed.netloc.replace("www.", "") or "unknown")

            existing = await session.scalar(
                select(MarketSignal).where(MarketSignal.canonical_url == canonical_url)
            )
            if existing:
                continue

            sentiment = cls._analyze_sentiment(headline)
            sig_type = cls._classify_signal_type(headline)

            signal = MarketSignal(
                market_sector=sector,
                headline=headline[:500],
                summary=art.get("summary") or f"Reported by {domain}.",
                source_url=raw_url,
                canonical_url=canonical_url,
                source_domain=domain[:100],
                sentiment_score=sentiment,
                relevance_score=term_coverage(sector, headline),
                signal_type=sig_type.value,
                published_at=art.get("published_at") or utc_now(),
            )
            session.add(signal)
            inserted_signals.append(signal)

        if inserted_signals:
            await session.commit()
            for s in inserted_signals:
                await session.refresh(s)
            logger.info(f"Ingested {len(inserted_signals)} new market signals for '{sector}'.")

            # Trigger automated competitor watchlist alerts
            try:
                from backend.app.services.watchlist_service import WatchlistService
                await WatchlistService.evaluate_signals_against_watchlists(session, inserted_signals)
            except Exception as ex:
                logger.warning(f"Error evaluating alerts for ingested signals: {ex}")

        # Return latest signals for this sector
        signals, _ = await cls.get_signals(session=session, sector=sector, limit=max_records)
        return signals

    @classmethod
    async def _fetch_gdelt_articles(
        cls,
        sector: str,
        max_records: int = 15,
        client: httpx.AsyncClient | None = None,
    ) -> list[dict[str, Any]]:
        """
        Queries the GDELT 2.0 DOC API for real news coverage of the sector.
        Raises PulseSyncError on any network/HTTP/parse failure.
        """
        params = {
            "query": sector,
            "mode": "artlist",
            "maxrecords": str(max_records),
            "format": "json",
            "sort": "datedesc",
        }
        headers = {"User-Agent": "StratifyAI-SignalIngestion/2.0"}
        try:
            if client is not None:
                res = await client.get(GDELT_DOC_URL, params=params, headers=headers)
            else:
                async with httpx.AsyncClient(timeout=15.0) as own_client:
                    res = await own_client.get(GDELT_DOC_URL, params=params, headers=headers)
        except httpx.HTTPError as exc:
            raise PulseSyncError(f"GDELT request failed: {exc!s}") from exc

        if res.status_code != 200:
            raise PulseSyncError(f"GDELT returned HTTP {res.status_code}")
        try:
            data = res.json()
        except ValueError as exc:
            # GDELT answers plain-text error messages (e.g. query too short / rate limited).
            raise PulseSyncError(f"GDELT returned a non-JSON response: {res.text[:120]!r}") from exc

        results: list[dict[str, Any]] = []
        for item in data.get("articles", []) or []:
            domain = item.get("domain", "") or ""
            details = [f"Reported by {domain}" if domain else "Reported by an unnamed source"]
            if item.get("sourcecountry"):
                details.append(f"source country: {item['sourcecountry']}")
            if item.get("language"):
                details.append(f"language: {item['language']}")
            results.append(
                {
                    "title": (item.get("title") or "").strip(),
                    "url": item.get("url", ""),
                    "domain": domain,
                    "published_at": parse_gdelt_seendate(item.get("seendate")),
                    "summary": "; ".join(details) + ".",
                }
            )
        return results

    @classmethod
    def _analyze_sentiment(cls, text: str) -> float:
        """
        Keyword-lexicon tone rating between -1.0 and +1.0 (+/-0.35 per matched word).
        This is a transparent heuristic on the headline text, not a trained sentiment model.
        """
        lower = text.lower()
        pos_words = ("surge", "record", "growth", "breakthrough", "secures", "advances", "partnership", "funding", "expands", "soars")
        neg_words = ("slump", "headwind", "risk", "decline", "stricter", "layoff", "fine", "antitrust", "breach", "scrutiny", "probe")

        score = 0.0
        for w in pos_words:
            if w in lower:
                score += 0.35
        for w in neg_words:
            if w in lower:
                score -= 0.35

        return round(max(-1.0, min(1.0, score)), 2)

    @classmethod
    def _classify_signal_type(cls, text: str) -> SignalType:
        """
        Infers signal classification based on headline content.
        """
        lower = text.lower()
        if any(w in lower for w in ("regulatory", "regulators", "directive", "scrutiny", "compliance", "policy", "antitrust", "fine", "court")):
            return SignalType.REGULATORY_UPDATE
        if any(w in lower for w in ("funding", "secures", "raises", "valuation", "venture", "series")):
            return SignalType.FUNDING
        if any(w in lower for w in ("partnership", "partners", "partner", "teams up", "alliance", "collaborates")):
            return SignalType.PARTNERSHIP
        if any(w in lower for w in ("unveils", "launches", "pricing", "feature", "counter")):
            return SignalType.COMPETITOR_MOVE
        return SignalType.MARKET_SHIFT
