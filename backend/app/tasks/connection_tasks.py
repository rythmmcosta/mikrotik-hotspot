import asyncio
from datetime import datetime, timezone

from app.tasks.celery_app import celery


@celery.task
def sync_active_sessions():
    """Pull active hotspot sessions from MikroTik and update DB."""
    async def _run():
        from app.db.session import get_session_factory
        from app.mikrotik import hotspot_manager
        from app.mikrotik.exceptions import RouterOSConnectionError
        from app.db.models.connection import Connection
        from sqlalchemy import select, update

        factory = get_session_factory()
        async with factory() as db:
            try:
                active = await hotspot_manager.list_active_sessions()
                active_ids = {s.get(".id") for s in active}

                # Mark sessions no longer on router as inactive
                result = await db.execute(
                    select(Connection).where(Connection.is_active == True)
                )
                db_active = result.scalars().all()
                for conn in db_active:
                    # If session disappeared from router, mark logout
                    router_match = next((s for s in active if s.get("user") == conn.hotspot_username), None)
                    if not router_match:
                        conn.is_active = False
                        conn.disconnected_at = datetime.now(timezone.utc)
                        conn.disconnect_reason = "unknown"
                    else:
                        # Update bytes/uptime from router
                        try:
                            conn.bytes_in = int(router_match.get("bytes-in", 0))
                            conn.bytes_out = int(router_match.get("bytes-out", 0))
                            uptime_str = router_match.get("uptime", "0s")
                            conn.uptime_seconds = _parse_uptime(uptime_str)
                        except (ValueError, TypeError):
                            pass
                await db.commit()
            except RouterOSConnectionError:
                pass
    asyncio.run(_run())


@celery.task
def expire_guest_sessions():
    """Terminate guests whose access_expires_at has passed."""
    async def _run():
        from app.db.session import get_session_factory
        from app.db.models.guest import Guest
        from app.mikrotik import hotspot_manager
        from sqlalchemy import select
        from app.mikrotik.exceptions import RouterOSConnectionError

        factory = get_session_factory()
        async with factory() as db:
            now = datetime.now(timezone.utc)
            result = await db.execute(
                select(Guest).where(
                    Guest.status == "approved",
                    Guest.access_expires_at != None,
                    Guest.access_expires_at <= now,
                )
            )
            expired = result.scalars().all()
            for guest in expired:
                guest.status = "expired"
                if guest.hotspot_username:
                    try:
                        await hotspot_manager.remove_user(guest.hotspot_username)
                    except RouterOSConnectionError:
                        pass
            await db.commit()
    asyncio.run(_run())


def _parse_uptime(uptime: str) -> int:
    """Parse MikroTik uptime string like '1d2h3m4s' to seconds."""
    import re
    total = 0
    for value, unit in re.findall(r"(\d+)([wdhms])", uptime):
        v = int(value)
        if unit == "w":
            total += v * 604800
        elif unit == "d":
            total += v * 86400
        elif unit == "h":
            total += v * 3600
        elif unit == "m":
            total += v * 60
        elif unit == "s":
            total += v
    return total
