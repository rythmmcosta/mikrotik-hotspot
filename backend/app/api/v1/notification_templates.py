from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.dependencies import require_admin
from app.services import template_service, notification_service

router = APIRouter(prefix="/notification-templates", tags=["notification-templates"])


@router.get("")
async def list_templates(channel: str | None = None, event: str | None = None,
                          db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    items = await template_service.list_templates(db, channel, event)
    return [_tmpl_out(t) for t in items]


@router.put("/{template_id}")
async def update_template(template_id: int, body: dict, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    tmpl = await template_service.update_template(db, template_id, body)
    if not tmpl:
        raise HTTPException(404, "Template not found")
    await db.commit()
    return _tmpl_out(tmpl)


@router.post("/{template_id}/toggle")
async def toggle_template(template_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    tmpl = await template_service.toggle_template(db, template_id)
    if not tmpl:
        raise HTTPException(404, "Template not found")
    await db.commit()
    return _tmpl_out(tmpl)


@router.post("/{template_id}/test")
async def test_template(template_id: int, body: dict, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    from app.services.template_service import render_template
    from app.db.models.notification_template import NotificationTemplate
    tmpl = await db.get(NotificationTemplate, template_id)
    if not tmpl:
        raise HTTPException(404, "Template not found")
    rendered_body = render_template(tmpl.body, **body.get("vars", {}))
    rendered_subject = render_template(tmpl.subject or "", **body.get("vars", {})) if tmpl.subject else None
    to = body.get("to") or user.email or ""
    if not to:
        raise HTTPException(400, "No recipient — set email/phone in your profile first")
    if tmpl.channel == "email":
        ok = await notification_service.send_email(db, to, rendered_subject or tmpl.label, rendered_body)
    elif tmpl.channel == "sms":
        ok = await notification_service.send_sms(db, to, rendered_body)
    elif tmpl.channel == "telegram":
        ok = await notification_service.send_telegram(db, to, rendered_body)
    else:
        ok = False
    return {"success": ok, "channel": tmpl.channel, "to": to}


def _tmpl_out(t):
    return {
        "id": t.id, "slug": t.slug, "channel": t.channel, "event": t.event,
        "label": t.label, "subject": t.subject, "body": t.body,
        "variables": t.variables or [], "is_enabled": t.is_enabled, "is_system": t.is_system,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }
