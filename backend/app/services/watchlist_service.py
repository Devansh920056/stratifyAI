"""
Watchlist and Alerting Service for Competitor Tracking and Anomaly Detection.
Monitors competitor entities, scans incoming market signals against sentiment thresholds,
and issues structured real-time alerts.
"""

import logging
import uuid
from typing import Optional

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.db.base import utc_now
from backend.app.models.enums import AlertSeverity, SignalType
from backend.app.models.market_signal import MarketSignal
from backend.app.models.watchlist import Alert, Watchlist
from backend.app.schemas.watchlist import (
    AlertListResponse,
    AlertResponse,
    AlertSimulateRequest,
    WatchlistCreateRequest,
    WatchlistListResponse,
    WatchlistResponse,
)

logger = logging.getLogger("stratify.services.watchlist")


class WatchlistService:
    """
    Manages competitor target watchlists and automated anomaly/risk alert generation.
    """

    @classmethod
    async def list_watchlists(cls, session: AsyncSession) -> WatchlistListResponse:
        """
        Lists all watchlists with enriched alert metrics.
        """
        stmt = (
            select(Watchlist)
            .options(selectinload(Watchlist.alerts))
            .order_by(Watchlist.created_at.desc())
        )
        res = await session.execute(stmt)
        watchlists = res.scalars().all()

        items: list[WatchlistResponse] = []
        for w in watchlists:
            alerts = w.alerts or []
            unread = sum(1 for a in alerts if not a.is_read)
            recent = [
                AlertResponse(
                    id=a.id,
                    watchlist_id=a.watchlist_id,
                    signal_id=a.signal_id,
                    title=a.title,
                    message=a.message,
                    severity=a.severity,
                    is_read=a.is_read,
                    triggered_at=a.triggered_at,
                    watchlist_name=w.name,
                )
                for a in alerts[:5]
            ]
            items.append(
                WatchlistResponse(
                    id=w.id,
                    name=w.name,
                    sector=w.sector,
                    target_entities=w.target_entities or [],
                    alert_threshold=w.alert_threshold,
                    is_active=w.is_active,
                    created_at=w.created_at,
                    updated_at=w.updated_at,
                    alert_count=len(alerts),
                    unread_alert_count=unread,
                    recent_alerts=recent,
                )
            )

        return WatchlistListResponse(watchlists=items, total=len(items))

    @classmethod
    async def create_watchlist(
        cls, session: AsyncSession, req: WatchlistCreateRequest
    ) -> WatchlistResponse:
        """
        Creates a new competitor watchlist and retroactively evaluates recent signals.
        """
        clean_entities = [e.strip() for e in req.target_entities if e.strip()]
        watchlist = Watchlist(
            name=req.name.strip(),
            sector=req.sector.strip(),
            target_entities=clean_entities,
            alert_threshold=req.alert_threshold,
            is_active=req.is_active,
        )
        session.add(watchlist)
        await session.commit()
        await session.refresh(watchlist)

        # Retroactively evaluate recent signals against the new watchlist
        recent_signals_stmt = (
            select(MarketSignal)
            .order_by(MarketSignal.published_at.desc())
            .limit(50)
        )
        recent_signals = (await session.scalars(recent_signals_stmt)).all()
        if recent_signals:
            await cls.evaluate_signals_against_watchlists(
                session=session,
                signals=list(recent_signals),
                target_watchlist_id=watchlist.id,
            )

        # Re-fetch watchlist with alerts
        stmt = (
            select(Watchlist)
            .options(selectinload(Watchlist.alerts))
            .where(Watchlist.id == watchlist.id)
        )
        refreshed = (await session.execute(stmt)).scalar_one()

        alerts = refreshed.alerts or []
        unread = sum(1 for a in alerts if not a.is_read)
        recent = [
            AlertResponse(
                id=a.id,
                watchlist_id=a.watchlist_id,
                signal_id=a.signal_id,
                title=a.title,
                message=a.message,
                severity=a.severity,
                is_read=a.is_read,
                triggered_at=a.triggered_at,
                watchlist_name=refreshed.name,
            )
            for a in alerts[:5]
        ]

        return WatchlistResponse(
            id=refreshed.id,
            name=refreshed.name,
            sector=refreshed.sector,
            target_entities=refreshed.target_entities or [],
            alert_threshold=refreshed.alert_threshold,
            is_active=refreshed.is_active,
            created_at=refreshed.created_at,
            updated_at=refreshed.updated_at,
            alert_count=len(alerts),
            unread_alert_count=unread,
            recent_alerts=recent,
        )

    @classmethod
    async def get_watchlist(
        cls, session: AsyncSession, watchlist_id: uuid.UUID
    ) -> Optional[WatchlistResponse]:
        """
        Retrieves a single watchlist by ID.
        """
        stmt = (
            select(Watchlist)
            .options(selectinload(Watchlist.alerts))
            .where(Watchlist.id == watchlist_id)
        )
        w = (await session.execute(stmt)).scalar_one_or_none()
        if not w:
            return None

        alerts = w.alerts or []
        unread = sum(1 for a in alerts if not a.is_read)
        recent = [
            AlertResponse(
                id=a.id,
                watchlist_id=a.watchlist_id,
                signal_id=a.signal_id,
                title=a.title,
                message=a.message,
                severity=a.severity,
                is_read=a.is_read,
                triggered_at=a.triggered_at,
                watchlist_name=w.name,
            )
            for a in alerts[:5]
        ]
        return WatchlistResponse(
            id=w.id,
            name=w.name,
            sector=w.sector,
            target_entities=w.target_entities or [],
            alert_threshold=w.alert_threshold,
            is_active=w.is_active,
            created_at=w.created_at,
            updated_at=w.updated_at,
            alert_count=len(alerts),
            unread_alert_count=unread,
            recent_alerts=recent,
        )

    @classmethod
    async def delete_watchlist(cls, session: AsyncSession, watchlist_id: uuid.UUID) -> bool:
        """
        Deletes a watchlist and all linked alerts.
        """
        stmt = select(Watchlist).where(Watchlist.id == watchlist_id)
        w = (await session.execute(stmt)).scalar_one_or_none()
        if not w:
            return False

        await session.delete(w)
        await session.commit()
        return True

    @classmethod
    async def evaluate_signals_against_watchlists(
        cls,
        session: AsyncSession,
        signals: list[MarketSignal],
        target_watchlist_id: Optional[uuid.UUID] = None,
    ) -> list[Alert]:
        """
        Scans given signals against active watchlists.
        Detects entity mentions, sector overlaps, and sentiment breaches to generate alerts.
        """
        if not signals:
            return []

        w_stmt = select(Watchlist).where(Watchlist.is_active == True)
        if target_watchlist_id:
            w_stmt = w_stmt.where(Watchlist.id == target_watchlist_id)

        watchlists = (await session.scalars(w_stmt)).all()
        if not watchlists:
            return []

        new_alerts: list[Alert] = []

        for sig in signals:
            sig_text = f"{sig.headline} {sig.summary}".lower()
            sig_sector = (sig.market_sector or "").lower()

            for w in watchlists:
                w_sector = (w.sector or "").lower()
                sector_overlap = (
                    w_sector in sig_sector or sig_sector in w_sector or w_sector in ("all", "global")
                )

                # Check which tracked entities are mentioned
                matched_entities = [
                    ent for ent in (w.target_entities or [])
                    if ent.lower() in sig_text
                ]

                # If neither sector overlaps nor any entity matches, skip
                if not matched_entities and not sector_overlap:
                    continue

                # Check if alert already exists for this watchlist + signal
                existing = await session.scalar(
                    select(Alert).where(
                        Alert.watchlist_id == w.id,
                        Alert.signal_id == sig.id,
                    )
                )
                if existing:
                    continue

                # Trigger Logic
                primary_entity = matched_entities[0] if matched_entities else w.sector

                # Case 1: Sentiment breach (negative sentiment lower than alert_threshold)
                if sig.sentiment_score <= w.alert_threshold:
                    severity = (
                        AlertSeverity.CRITICAL.value
                        if sig.sentiment_score <= -0.4
                        else AlertSeverity.WARNING.value
                    )
                    title = f"[{primary_entity.upper()}] Negative Sentiment Alert: {sig.headline[:90]}"
                    msg = (
                        f"Tracked target '{primary_entity}' breached negative sentiment threshold "
                        f"({sig.sentiment_score:.2f} <= {w.alert_threshold:.2f}). "
                        f"Source: {sig.source_domain}. Summary: {sig.summary}"
                    )
                    alert = Alert(
                        watchlist_id=w.id,
                        signal_id=sig.id,
                        title=title[:255],
                        message=msg,
                        severity=severity,
                        is_read=False,
                        triggered_at=utc_now(),
                    )
                    session.add(alert)
                    new_alerts.append(alert)

                # Case 2: Regulatory update mentioning target entity or sector
                elif sig.signal_type == SignalType.REGULATORY_UPDATE.value:
                    title = f"[{primary_entity.upper()}] Regulatory Mandate: {sig.headline[:90]}"
                    msg = (
                        f"Compliance / Regulatory shift affecting '{primary_entity}' sector '{sig.market_sector}'. "
                        f"Source: {sig.source_domain}. Summary: {sig.summary}"
                    )
                    alert = Alert(
                        watchlist_id=w.id,
                        signal_id=sig.id,
                        title=title[:255],
                        message=msg,
                        severity=AlertSeverity.WARNING.value,
                        is_read=False,
                        triggered_at=utc_now(),
                    )
                    session.add(alert)
                    new_alerts.append(alert)

                # Case 3: Competitor move or funding with high relevance
                elif matched_entities and (
                    sig.signal_type in (SignalType.COMPETITOR_MOVE.value, SignalType.FUNDING.value)
                    or sig.sentiment_score >= 0.35
                ):
                    severity = (
                        AlertSeverity.INFO.value
                        if sig.sentiment_score >= 0
                        else AlertSeverity.WARNING.value
                    )
                    title = f"[{primary_entity.upper()}] Market Move: {sig.headline[:90]}"
                    msg = (
                        f"Strategic development for '{primary_entity}' ({sig.signal_type}). "
                        f"Sentiment: {sig.sentiment_score:+.2f}. Source: {sig.source_domain}."
                    )
                    alert = Alert(
                        watchlist_id=w.id,
                        signal_id=sig.id,
                        title=title[:255],
                        message=msg,
                        severity=severity,
                        is_read=False,
                        triggered_at=utc_now(),
                    )
                    session.add(alert)
                    new_alerts.append(alert)

        if new_alerts:
            await session.commit()
            for a in new_alerts:
                await session.refresh(a)
            logger.info(f"Triggered {len(new_alerts)} automated alerts across active watchlists.")

        return new_alerts

    @classmethod
    async def get_alerts(
        cls,
        session: AsyncSession,
        unread_only: bool = False,
        severity: Optional[str] = None,
        watchlist_id: Optional[uuid.UUID] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> AlertListResponse:
        """
        Lists alerts with optional filters and unread counter.
        """
        stmt = (
            select(Alert, Watchlist.name.label("watchlist_name"))
            .join(Watchlist, Alert.watchlist_id == Watchlist.id)
            .order_by(Alert.triggered_at.desc())
        )
        count_stmt = select(func.count(Alert.id)).select_from(Alert)
        unread_stmt = select(func.count(Alert.id)).where(Alert.is_read == False)

        if unread_only:
            stmt = stmt.where(Alert.is_read == False)
            count_stmt = count_stmt.where(Alert.is_read == False)

        if severity and severity.upper() != "ALL":
            stmt = stmt.where(Alert.severity == severity.upper())
            count_stmt = count_stmt.where(Alert.severity == severity.upper())
            unread_stmt = unread_stmt.where(Alert.severity == severity.upper())

        if watchlist_id:
            stmt = stmt.where(Alert.watchlist_id == watchlist_id)
            count_stmt = count_stmt.where(Alert.watchlist_id == watchlist_id)
            unread_stmt = unread_stmt.where(Alert.watchlist_id == watchlist_id)

        total = await session.scalar(count_stmt) or 0
        unread_count = await session.scalar(unread_stmt) or 0

        stmt = stmt.limit(limit).offset(offset)
        rows = (await session.execute(stmt)).all()

        alert_items: list[AlertResponse] = []
        for alert, wl_name in rows:
            alert_items.append(
                AlertResponse(
                    id=alert.id,
                    watchlist_id=alert.watchlist_id,
                    signal_id=alert.signal_id,
                    title=alert.title,
                    message=alert.message,
                    severity=alert.severity,
                    is_read=alert.is_read,
                    triggered_at=alert.triggered_at,
                    watchlist_name=wl_name,
                )
            )

        return AlertListResponse(
            alerts=alert_items,
            total=total,
            unread_count=unread_count,
        )

    @classmethod
    async def mark_alert_read(
        cls, session: AsyncSession, alert_id: uuid.UUID, is_read: bool = True
    ) -> Optional[AlertResponse]:
        """
        Updates read status of an alert.
        """
        stmt = (
            select(Alert, Watchlist.name.label("watchlist_name"))
            .join(Watchlist, Alert.watchlist_id == Watchlist.id)
            .where(Alert.id == alert_id)
        )
        row = (await session.execute(stmt)).first()
        if not row:
            return None

        alert, wl_name = row
        alert.is_read = is_read
        await session.commit()
        await session.refresh(alert)

        return AlertResponse(
            id=alert.id,
            watchlist_id=alert.watchlist_id,
            signal_id=alert.signal_id,
            title=alert.title,
            message=alert.message,
            severity=alert.severity,
            is_read=alert.is_read,
            triggered_at=alert.triggered_at,
            watchlist_name=wl_name,
        )

    @classmethod
    async def simulate_alert(
        cls, session: AsyncSession, req: AlertSimulateRequest
    ) -> AlertResponse:
        """
        Simulates an incoming market alert for demonstration and testing.
        """
        watchlist = None
        if req.watchlist_id:
            watchlist = await session.get(Watchlist, req.watchlist_id)

        if not watchlist:
            # Fetch first active watchlist or create a sensible default
            watchlist = await session.scalar(
                select(Watchlist).where(Watchlist.is_active == True).limit(1)
            )
            if not watchlist:
                watchlist = Watchlist(
                    name="Direct EV & Climate Tech Competitors",
                    sector="Climate Tech",
                    target_entities=["Tesla", "Rivian", "Lucid Motors", "Northvolt"],
                    alert_threshold=-0.2,
                    is_active=True,
                )
                session.add(watchlist)
                await session.commit()
                await session.refresh(watchlist)

        severity = req.severity.upper() if req.severity else AlertSeverity.WARNING.value
        title = req.title or f"[{watchlist.name[:20]}] Sudden Regulatory Compliance Audit Announced"
        message = req.message or (
            f"Department of Energy announced strict supply chain provenance audits affecting "
            f"sector '{watchlist.sector}'. Key tracked competitors {watchlist.target_entities[:2]} "
            f"face estimated 15% verification overhead in Q4."
        )

        alert = Alert(
            watchlist_id=watchlist.id,
            signal_id=None,
            title=title[:255],
            message=message,
            severity=severity,
            is_read=False,
            triggered_at=utc_now(),
        )
        session.add(alert)
        await session.commit()
        await session.refresh(alert)

        return AlertResponse(
            id=alert.id,
            watchlist_id=alert.watchlist_id,
            signal_id=alert.signal_id,
            title=alert.title,
            message=alert.message,
            severity=alert.severity,
            is_read=alert.is_read,
            triggered_at=alert.triggered_at,
            watchlist_name=watchlist.name,
        )
