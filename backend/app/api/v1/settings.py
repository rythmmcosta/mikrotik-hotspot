from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user, require_admin
from app.db.models.user import User
from app.schemas.settings import SettingsCategoryResponse, SettingsUpdateRequest, TestConnectionResponse, SettingItem
from app.services import settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=dict)
async def get_all_settings(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    all_settings = await settings_service.get_all_settings(db)
    return {
        cat: [
            SettingItem(
                key_name=s.key_name,
                value="***" if s.is_encrypted and s.value else s.value,
                is_encrypted=s.is_encrypted,
                description=s.description,
            )
            for s in rows
        ]
        for cat, rows in all_settings.items()
    }


@router.get("/{category}")
async def get_category(
    category: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    rows = await settings_service.get_category(db, category)
    return {
        "category": category,
        "settings": [
            SettingItem(
                key_name=s.key_name,
                value="***" if s.is_encrypted and s.value else s.value,
                is_encrypted=s.is_encrypted,
                description=s.description,
            )
            for s in rows
        ],
    }


@router.put("/{category}")
async def update_category(
    category: str,
    body: SettingsUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    await settings_service.update_category(db, category, body.settings, current_user)
    return {"message": f"Settings for {category} updated"}


@router.post("/mikrotik/test", response_model=TestConnectionResponse)
async def test_mikrotik(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    try:
        from app.mikrotik.client import get_pool
        pool = get_pool()
        identity = await pool.call("/system/identity/print")
        return {"success": True, "message": "Connected", "details": {"identity": identity[0].get("name", "")}}
    except Exception as exc:
        return {"success": False, "message": str(exc)}


@router.post("/smtp/test", response_model=TestConnectionResponse)
async def test_smtp(
    to_email: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.services.notification_service import send_email
    ok = await send_email(db, to_email, "SMTP Test", "<p>SMTP configuration is working.</p>")
    return {"success": ok, "message": "Email sent" if ok else "Failed to send email"}


@router.post("/sms/test", response_model=TestConnectionResponse)
async def test_sms(
    to_number: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.services.notification_service import send_sms
    ok = await send_sms(db, to_number, "SMS configuration test from Hotspot Manager.")
    return {"success": ok, "message": "SMS sent" if ok else "Failed to send SMS"}


@router.post("/telegram/test", response_model=TestConnectionResponse)
async def test_telegram(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Test Telegram by sending to the configured default_chat_id."""
    from app.services.notification_service import send_telegram
    from app.services.settings_service import get_value
    chat_id = await get_value(db, "telegram", "default_chat_id") or ""
    if not chat_id:
        return {"success": False, "message": "No default chat ID configured"}
    ok = await send_telegram(db, chat_id, "✅ <b>HotspotMgr</b>\nTelegram notification test successful.")
    return {"success": ok, "message": "Message sent" if ok else "Failed to send Telegram message"}


@router.post("/telegram/test-me", response_model=TestConnectionResponse)
async def test_telegram_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Test Telegram by sending to the current user's personal telegram_chat_id."""
    from app.services.notification_service import send_telegram
    chat_id = current_user.telegram_chat_id or ""
    if not chat_id:
        return {"success": False, "message": "No Telegram chat ID in your profile"}
    ok = await send_telegram(db, chat_id, f"✅ <b>HotspotMgr</b>\nHello {current_user.username}! Your Telegram notifications are working.")
    return {"success": ok, "message": "Message sent to your Telegram" if ok else "Failed to send Telegram message"}


@router.get("/public/portal")
async def get_portal_settings_public(db: AsyncSession = Depends(get_db)):
    """Public endpoint — returns portal branding settings without auth."""
    rows = await settings_service.get_category(db, "portal")
    return {s.key_name: s.value for s in rows}
