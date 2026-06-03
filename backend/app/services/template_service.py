from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.notification_template import NotificationTemplate


def render_template(template: str, **kwargs) -> str:
    for k, v in kwargs.items():
        template = template.replace(f"{{{k}}}", str(v or ""))
    return template


async def get_enabled_templates(db: AsyncSession, channel: str, event: str) -> list[NotificationTemplate]:
    result = await db.execute(
        select(NotificationTemplate).where(
            NotificationTemplate.channel == channel,
            NotificationTemplate.event == event,
            NotificationTemplate.is_enabled == True,
        )
    )
    return list(result.scalars().all())


async def get_template_by_slug(db: AsyncSession, slug: str) -> Optional[NotificationTemplate]:
    result = await db.execute(select(NotificationTemplate).where(NotificationTemplate.slug == slug))
    return result.scalars().first()


async def list_templates(db: AsyncSession, channel: str | None = None, event: str | None = None) -> list[NotificationTemplate]:
    q = select(NotificationTemplate).order_by(NotificationTemplate.channel, NotificationTemplate.event)
    if channel:
        q = q.where(NotificationTemplate.channel == channel)
    if event:
        q = q.where(NotificationTemplate.event == event)
    result = await db.execute(q)
    return list(result.scalars().all())


async def update_template(db: AsyncSession, template_id: int, updates: dict) -> Optional[NotificationTemplate]:
    result = await db.execute(select(NotificationTemplate).where(NotificationTemplate.id == template_id))
    tmpl = result.scalars().first()
    if not tmpl:
        return None
    allowed = {"label", "subject", "body", "is_enabled"}
    for k, v in updates.items():
        if k in allowed:
            setattr(tmpl, k, v)
    await db.flush()
    return tmpl


async def toggle_template(db: AsyncSession, template_id: int) -> Optional[NotificationTemplate]:
    result = await db.execute(select(NotificationTemplate).where(NotificationTemplate.id == template_id))
    tmpl = result.scalars().first()
    if not tmpl:
        return None
    tmpl.is_enabled = not tmpl.is_enabled
    await db.flush()
    return tmpl
