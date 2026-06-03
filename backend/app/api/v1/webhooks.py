from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services import connection_service

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


class HotspotEvent(BaseModel):
    type: str           # "login" or "logout"
    user: str           # hotspot username
    mac: str
    ip: str
    session_id: str
    bytes_in: int = 0
    bytes_out: int = 0
    uptime_seconds: int = 0
    user_type: str = "guest"  # "employee" or "guest"
    user_db_id: int = 0


@router.post("/hotspot-event")
async def hotspot_event(body: HotspotEvent, db: AsyncSession = Depends(get_db)):
    if body.type == "login":
        await connection_service.record_login(
            db=db,
            session_id=body.session_id,
            user_type=body.user_type,
            user_id=body.user_db_id,
            hotspot_username=body.user,
            mac_address=body.mac,
            ip_address=body.ip,
        )
        from app.services.notification_service import notify_admins
        await notify_admins(db, "hotspot_login",
            "📶 <b>Hotspot Login</b>\n{username} ({user_type}) connected from {ip}.",
            username=body.user, user_type=body.user_type, ip=body.ip)
    elif body.type == "logout":
        await connection_service.record_logout(
            db=db,
            session_id=body.session_id,
            bytes_in=body.bytes_in,
            bytes_out=body.bytes_out,
            uptime_seconds=body.uptime_seconds,
        )
    return {"status": "ok"}
