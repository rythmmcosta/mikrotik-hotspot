from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.connection import Connection
from app.db.models.user import User
from app.mikrotik import hotspot_manager
from app.mikrotik.exceptions import RouterOSConnectionError


async def record_login(
    db: AsyncSession,
    session_id: str,
    user_type: str,
    user_id: int,
    hotspot_username: str,
    mac_address: str,
    ip_address: str,
) -> Connection:
    # Idempotent: ignore if already exists
    existing = await db.execute(select(Connection).where(Connection.session_id == session_id))
    if existing.scalar_one_or_none():
        return existing.scalar_one_or_none()

    conn = Connection(
        session_id=session_id,
        user_type=user_type,
        user_id=user_id,
        hotspot_username=hotspot_username,
        mac_address=mac_address,
        ip_address=ip_address,
        connected_at=datetime.now(timezone.utc),
        is_active=True,
    )
    db.add(conn)
    return conn


async def record_logout(
    db: AsyncSession,
    session_id: str,
    bytes_in: int = 0,
    bytes_out: int = 0,
    uptime_seconds: int = 0,
) -> Connection | None:
    result = await db.execute(select(Connection).where(Connection.session_id == session_id))
    conn = result.scalar_one_or_none()
    if not conn:
        return None
    conn.is_active = False
    conn.disconnected_at = datetime.now(timezone.utc)
    conn.disconnect_reason = "logout"
    conn.bytes_in = bytes_in
    conn.bytes_out = bytes_out
    conn.uptime_seconds = uptime_seconds
    return conn


async def terminate_connection(db: AsyncSession, connection_id: int, terminator: User) -> Connection | None:
    result = await db.execute(select(Connection).where(Connection.id == connection_id))
    conn = result.scalar_one_or_none()
    if not conn or not conn.is_active:
        return None

    try:
        sessions = await hotspot_manager.list_active_sessions()
        for s in sessions:
            if s.get("user") == conn.hotspot_username:
                await hotspot_manager.terminate_session(s[".id"])
                break
    except RouterOSConnectionError:
        pass

    conn.is_active = False
    conn.disconnected_at = datetime.now(timezone.utc)
    conn.disconnect_reason = "admin_terminate"
    conn.terminated_by = terminator.id
    return conn


async def list_active(db: AsyncSession) -> list[Connection]:
    result = await db.execute(
        select(Connection).where(Connection.is_active == True).order_by(Connection.connected_at.desc())
    )
    return list(result.scalars())


async def list_history(
    db: AsyncSession, page: int = 1, per_page: int = 50
) -> tuple[list[Connection], int]:
    q = select(Connection).where(Connection.is_active == False).order_by(Connection.connected_at.desc())
    cq = select(func.count(Connection.id)).where(Connection.is_active == False)
    q = q.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    count = await db.execute(cq)
    return list(result.scalars()), count.scalar()


async def get_stats(db: AsyncSession) -> dict:
    from datetime import date
    today_start = datetime.combine(date.today(), datetime.min.time())

    active_count = await db.execute(
        select(func.count(Connection.id)).where(Connection.is_active == True)
    )
    today_sessions = await db.execute(
        select(func.count(Connection.id)).where(Connection.connected_at >= today_start)
    )
    today_bytes_in = await db.execute(
        select(func.sum(Connection.bytes_in)).where(Connection.connected_at >= today_start)
    )
    today_bytes_out = await db.execute(
        select(func.sum(Connection.bytes_out)).where(Connection.connected_at >= today_start)
    )
    unique_users = await db.execute(
        select(func.count(func.distinct(Connection.user_id))).where(Connection.connected_at >= today_start)
    )

    db_active = active_count.scalar() or 0

    # Prefer live MikroTik count over stale DB count
    live_count: int | None = None
    try:
        sessions = await hotspot_manager.list_active_sessions()
        live_count = len(sessions)
    except Exception:
        pass

    return {
        "active_count": live_count if live_count is not None else db_active,
        "live_session_count": live_count,
        "db_active_count": db_active,
        "total_sessions_today": today_sessions.scalar() or 0,
        "total_bytes_in": today_bytes_in.scalar() or 0,
        "total_bytes_out": today_bytes_out.scalar() or 0,
        "unique_users_today": unique_users.scalar() or 0,
    }
