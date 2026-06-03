from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.dependencies import get_current_user
from app.db.models.admin_session import AdminSession

router = APIRouter(prefix="/admin/sessions", tags=["admin-sessions"])


@router.get("")
async def get_my_sessions(limit: int = 50, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    result = await db.execute(
        select(AdminSession).where(AdminSession.user_id == user.id)
        .order_by(AdminSession.created_at.desc()).limit(limit)
    )
    return [{"id": s.id, "ip_address": s.ip_address, "user_agent": s.user_agent,
             "success": s.success, "created_at": s.created_at.isoformat()} for s in result.scalars()]
