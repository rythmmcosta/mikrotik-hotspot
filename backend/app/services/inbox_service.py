from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.notification import Notification


async def create_notification(
    db: AsyncSession,
    title: str,
    body: str | None = None,
    type: str = "info",
    action_url: str | None = None,
    user_id: int | None = None,
) -> Notification:
    notif = Notification(user_id=user_id, title=title, body=body, type=type, action_url=action_url)
    db.add(notif)
    await db.flush()
    return notif


async def list_notifications(db: AsyncSession, user_id: int | None, unread_only: bool = False, limit: int = 50) -> list[Notification]:
    q = select(Notification).where(
        (Notification.user_id == user_id) | (Notification.user_id.is_(None))
    ).order_by(Notification.created_at.desc()).limit(limit)
    if unread_only:
        q = q.where(Notification.is_read == False)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_unread_count(db: AsyncSession, user_id: int | None) -> int:
    q = select(func.count(Notification.id)).where(
        Notification.is_read == False,
        (Notification.user_id == user_id) | (Notification.user_id.is_(None))
    )
    result = await db.execute(q)
    return result.scalar_one() or 0


async def mark_read(db: AsyncSession, notification_id: int, user_id: int | None) -> bool:
    result = await db.execute(select(Notification).where(Notification.id == notification_id))
    n = result.scalars().first()
    if n and (n.user_id == user_id or n.user_id is None):
        n.is_read = True
        await db.flush()
        return True
    return False


async def mark_all_read(db: AsyncSession, user_id: int | None) -> int:
    q = update(Notification).where(
        Notification.is_read == False,
        (Notification.user_id == user_id) | (Notification.user_id.is_(None))
    ).values(is_read=True)
    result = await db.execute(q)
    return result.rowcount


async def delete_notification(db: AsyncSession, notification_id: int, user_id: int | None) -> bool:
    result = await db.execute(select(Notification).where(Notification.id == notification_id))
    n = result.scalars().first()
    if n and (n.user_id == user_id or n.user_id is None):
        await db.delete(n)
        await db.flush()
        return True
    return False
