import logging

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
