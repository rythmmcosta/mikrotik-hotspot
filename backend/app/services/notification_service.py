import logging

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.settings_service import get_value

logger = logging.getLogger(__name__)


async def send_email(db: AsyncSession, to_address: str, subject: str, body: str) -> bool:
    try:
        import aiosmtplib
        from email.mime.text import MIMEText

        host = await get_value(db, "smtp", "host") or ""
        port = int(await get_value(db, "smtp", "port") or 587)
        username = await get_value(db, "smtp", "username") or ""
        password = await get_value(db, "smtp", "password") or ""
        from_addr = await get_value(db, "smtp", "from_address") or username
        use_tls = (await get_value(db, "smtp", "use_tls") or "true").lower() == "true"

        msg = MIMEText(body, "html")
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = to_address

        await aiosmtplib.send(
            msg,
            hostname=host,
            port=port,
            username=username,
            password=password,
            start_tls=use_tls,
        )
        return True
    except Exception as exc:
        logger.error("Email send failed to %s: %s", to_address, exc)
        return False


async def send_sms(db: AsyncSession, to_number: str, message: str) -> bool:
    try:
        from twilio.rest import Client

        account_sid = await get_value(db, "sms", "account_sid") or ""
        auth_token = await get_value(db, "sms", "auth_token") or ""
        from_number = await get_value(db, "sms", "from_number") or ""

        client = Client(account_sid, auth_token)
        client.messages.create(body=message, from_=from_number, to=to_number)
        return True
    except Exception as exc:
        logger.error("SMS send failed to %s: %s", to_number, exc)
        return False


async def send_telegram(db: AsyncSession, chat_id: str, message: str) -> bool:
    """Send a message via Telegram Bot API."""
    try:
        token = await get_value(db, "telegram", "bot_token") or ""
        if not token or not chat_id:
            return False
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url, json={"chat_id": chat_id, "text": message, "parse_mode": "HTML"})
        if r.status_code != 200:
            logger.error("Telegram send failed (chat %s): %s", chat_id, r.text)
            return False
        return True
    except Exception as exc:
        logger.error("Telegram send failed to chat %s: %s", chat_id, exc)
        return False


async def notify_admins(db: AsyncSession, message: str) -> None:
    """Send message to the configured default Telegram chat if enabled."""
    try:
        enabled = (await get_value(db, "telegram", "enabled") or "false").lower() == "true"
        if not enabled:
            return
        chat_id = await get_value(db, "telegram", "default_chat_id") or ""
        if chat_id:
            await send_telegram(db, chat_id, message)
    except Exception as exc:
        logger.debug("notify_admins skipped: %s", exc)
