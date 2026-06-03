from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.dependencies import get_current_user
from app.services import inbox_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(unread_only: bool = False, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    items = await inbox_service.list_notifications(db, user.id, unread_only)
    return [_out(n) for n in items]


@router.get("/unread-count")
async def unread_count(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    count = await inbox_service.get_unread_count(db, user.id)
    return {"count": count}


@router.put("/{notification_id}/read")
async def mark_read(notification_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    ok = await inbox_service.mark_read(db, notification_id, user.id)
    await db.commit()
    return {"success": ok}


@router.put("/read-all")
async def mark_all_read(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    count = await inbox_service.mark_all_read(db, user.id)
    await db.commit()
    return {"marked": count}


@router.delete("/{notification_id}")
async def delete_notification(notification_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    ok = await inbox_service.delete_notification(db, notification_id, user.id)
    await db.commit()
    return {"success": ok}


def _out(n):
    return {
        "id": n.id, "title": n.title, "body": n.body, "type": n.type,
        "action_url": n.action_url, "is_read": n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }
