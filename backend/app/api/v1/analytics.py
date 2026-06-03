from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import require_admin
from app.db.models.user import User
from app.db.models.guest import Guest
from app.db.models.connection import Connection
from app.db.models.browsing_log import BrowsingLog

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
async def analytics_overview(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    # Guest stats
    total_guests = (await db.execute(select(func.count(Guest.id)))).scalar()
    guests_today = (await db.execute(select(func.count(Guest.id)).where(Guest.created_at >= today))).scalar()
    approved_guests = (await db.execute(select(func.count(Guest.id)).where(Guest.status == "approved"))).scalar()
    pending_guests = (await db.execute(select(func.count(Guest.id)).where(Guest.status == "pending_approval"))).scalar()
    rejected_guests = (await db.execute(select(func.count(Guest.id)).where(Guest.status == "rejected"))).scalar()

    # Connection stats
    active_conns = (await db.execute(select(func.count(Connection.id)).where(Connection.is_active == True))).scalar()
    total_bytes_res = await db.execute(
        select(func.sum(Connection.bytes_in + Connection.bytes_out)).where(Connection.connected_at >= today)
    )
    total_bytes_today = total_bytes_res.scalar() or 0

    # Browsing stats
    domains_today = (await db.execute(
        select(func.count(func.distinct(BrowsingLog.domain))).where(BrowsingLog.queried_at >= today)
    )).scalar()

    return {
        "guests": {
            "total": total_guests,
            "today": guests_today,
            "approved": approved_guests,
            "pending": pending_guests,
            "rejected": rejected_guests,
        },
        "connections": {
            "active": active_conns,
            "total_bytes_today": total_bytes_today,
        },
        "browsing": {
            "unique_domains_today": domains_today,
        },
    }


@router.get("/registrations")
async def guest_registrations(
    days: int = Query(30, ge=7, le=90),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
    result = await db.execute(
        select(func.date(Guest.created_at).label("date"), func.count(Guest.id).label("count"))
        .where(Guest.created_at >= since)
        .group_by(func.date(Guest.created_at))
        .order_by(func.date(Guest.created_at))
    )
    return [{"date": str(row.date), "count": row.count} for row in result]


@router.get("/peak-hours")
async def peak_hours(
    days: int = Query(30, ge=7, le=90),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
    result = await db.execute(
        select(
            func.dayofweek(Connection.connected_at).label("dow"),
            func.hour(Connection.connected_at).label("hour"),
            func.count(Connection.id).label("count"),
        )
        .where(Connection.connected_at >= since)
        .group_by(func.dayofweek(Connection.connected_at), func.hour(Connection.connected_at))
    )
    return [{"dow": row.dow, "hour": row.hour, "count": row.count} for row in result]


@router.get("/bandwidth-top")
async def bandwidth_top(
    limit: int = Query(10, ge=5, le=50),
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
    result = await db.execute(
        select(
            Connection.hotspot_username,
            func.sum(Connection.bytes_in + Connection.bytes_out).label("total_bytes"),
        )
        .where(Connection.connected_at >= since)
        .group_by(Connection.hotspot_username)
        .order_by(func.sum(Connection.bytes_in + Connection.bytes_out).desc())
        .limit(limit)
    )
    return [{"username": row.hotspot_username, "total_bytes": row.total_bytes or 0} for row in result]


@router.get("/domains-top")
async def domains_top(
    limit: int = Query(10, ge=5, le=50),
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
    result = await db.execute(
        select(BrowsingLog.domain, func.count(BrowsingLog.id).label("count"))
        .where(BrowsingLog.queried_at >= since)
        .group_by(BrowsingLog.domain)
        .order_by(func.count(BrowsingLog.id).desc())
        .limit(limit)
    )
    return [{"domain": row.domain, "count": row.count} for row in result]
