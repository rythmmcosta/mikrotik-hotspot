from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.browsing_log import BrowsingLog
from app.db.models.connection import Connection


async def resolve_user_for_ip(db: AsyncSession, ip: str) -> dict:
    """Look up hotspot username and user info from an active connection by IP."""
    result = await db.execute(
        select(Connection).where(
            Connection.ip_address == ip,
            Connection.is_active == True,
        ).order_by(Connection.connected_at.desc()).limit(1)
    )
    conn = result.scalar_one_or_none()
    if not conn:
        return {"ip_address": ip}
    return {
        "hotspot_username": conn.hotspot_username,
        "user_type": conn.user_type,
        "user_id": conn.user_id,
        "mac_address": conn.mac_address,
    }


async def get_browsing_logs(
    db: AsyncSession,
    username: str | None = None,
    domain: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = 1,
    per_page: int = 50,
) -> dict[str, Any]:
    q = select(BrowsingLog)
    if username:
        q = q.where(BrowsingLog.hotspot_username == username)
    if domain:
        q = q.where(BrowsingLog.domain.contains(domain))
    if date_from:
        q = q.where(BrowsingLog.queried_at >= date_from)
    if date_to:
        q = q.where(BrowsingLog.queried_at <= date_to)

    total_res = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_res.scalar_one()

    q = q.order_by(BrowsingLog.queried_at.desc())
    q = q.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    rows = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "items": [_log_to_dict(r) for r in rows],
    }


async def get_browsing_stats(
    db: AsyncSession,
    hours: int = 24,
) -> dict[str, Any]:
    since = datetime.utcnow() - timedelta(hours=hours)

    top_domains = await db.execute(
        select(BrowsingLog.domain, func.count().label("count"))
        .where(BrowsingLog.queried_at >= since)
        .group_by(BrowsingLog.domain)
        .order_by(func.count().desc())
        .limit(20)
    )

    top_users = await db.execute(
        select(BrowsingLog.hotspot_username, func.count().label("count"))
        .where(BrowsingLog.queried_at >= since, BrowsingLog.hotspot_username.isnot(None))
        .group_by(BrowsingLog.hotspot_username)
        .order_by(func.count().desc())
        .limit(10)
    )

    total_queries = await db.execute(
        select(func.count()).where(BrowsingLog.queried_at >= since)
    )

    return {
        "period_hours": hours,
        "total_queries": total_queries.scalar_one(),
        "top_domains": [{"domain": r[0], "count": r[1]} for r in top_domains],
        "top_users": [{"username": r[0], "count": r[1]} for r in top_users],
    }


def _log_to_dict(log: BrowsingLog) -> dict:
    return {
        "id": log.id,
        "hotspot_username": log.hotspot_username,
        "user_type": log.user_type,
        "user_id": log.user_id,
        "domain": log.domain,
        "query_type": log.query_type,
        "ip_address": log.ip_address,
        "mac_address": log.mac_address,
        "queried_at": log.queried_at.isoformat() if log.queried_at else None,
    }
