import logging
import urllib.parse

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.settings_service import get_value

logger = logging.getLogger(__name__)


async def _render_template(template: str, **kwargs) -> str:
    for k, v in kwargs.items():
        template = template.replace(f"{{{k}}}", str(v or ""))
    return template


async def get_template(db: AsyncSession, key: str, default: str) -> str:
    val = await get_value(db, "notifications", key)
    return val if val else default


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
            msg, hostname=host, port=port, username=username,
            password=password, start_tls=use_tls,
        )
        return True
    except Exception as exc:
        logger.error("Email send failed to %s: %s", to_address, exc)
        return False


async def _send_ssl_wireless(api_token: str, sender_id: str, number: str, message: str) -> bool:
    url = "https://smsplus.sslwireless.com/api/v3/send-sms"
    payload = {"senderid": sender_id, "csmsid": "hotspot", "msisdn": number, "sms": message}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(url, json=payload, headers={"api_token": api_token})
    return r.status_code == 200


async def _send_bulksmsbd(api_key: str, sender_id: str, number: str, message: str) -> bool:
    params = {"api_key": api_key, "number": number, "senderid": sender_id, "msg": message}
    url = "https://bulksmsbd.net/api/smsapi?" + urllib.parse.urlencode(params)
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url)
    return r.status_code == 200


async def _send_custom_http(url_template: str, method: str, auth_header: str, number: str, message: str) -> bool:
    url = url_template.replace("{number}", urllib.parse.quote(number)).replace("{message}", urllib.parse.quote(message))
    headers = {}
    if auth_header:
        k, _, v = auth_header.partition(":")
        headers[k.strip()] = v.strip()
    async with httpx.AsyncClient(timeout=15) as client:
        if method.upper() == "POST":
            r = await client.post(url, headers=headers)
        else:
            r = await client.get(url, headers=headers)
    return r.status_code < 400


async def send_sms(db: AsyncSession, to_number: str, message: str) -> bool:
    try:
        provider = (await get_value(db, "sms", "provider") or "ssl_wireless").lower()

        if provider == "ssl_wireless":
            api_token = await get_value(db, "sms", "ssl_wireless_api_token") or ""
            sender_id = await get_value(db, "sms", "ssl_wireless_sender_id") or "HotspotMgr"
            if not api_token:
                logger.error("SSL Wireless api_token not configured")
                return False
            return await _send_ssl_wireless(api_token, sender_id, to_number, message)

        elif provider == "bulksmsbd":
            api_key = await get_value(db, "sms", "bulksmsbd_api_key") or ""
            sender_id = await get_value(db, "sms", "bulksmsbd_sender_id") or "HotspotMgr"
            if not api_key:
                logger.error("BulkSMS BD api_key not configured")
                return False
            return await _send_bulksmsbd(api_key, sender_id, to_number, message)

        elif provider == "twilio":
            from twilio.rest import Client
            account_sid = await get_value(db, "sms", "account_sid") or ""
            auth_token = await get_value(db, "sms", "auth_token") or ""
            from_number = await get_value(db, "sms", "from_number") or ""
            client = Client(account_sid, auth_token)
            client.messages.create(body=message, from_=from_number, to=to_number)
            return True

        elif provider == "custom_http":
            url_template = await get_value(db, "sms", "custom_http_url") or ""
            method = await get_value(db, "sms", "custom_http_method") or "GET"
            auth_header = await get_value(db, "sms", "custom_http_auth_header") or ""
            if not url_template:
                logger.error("Custom HTTP URL not configured")
                return False
            return await _send_custom_http(url_template, method, auth_header, to_number, message)

        else:
            logger.error("Unknown SMS provider: %s", provider)
            return False

    except Exception as exc:
        logger.error("SMS send failed to %s: %s", to_number, exc)
        return False


async def send_telegram(db: AsyncSession, chat_id: str, message: str) -> bool:
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


async def send_by_event(db: AsyncSession, channel: str, event: str, recipient: str, **kwargs) -> bool:
    """Find all enabled templates for (channel, event) and send to recipient."""
    from app.services.template_service import get_enabled_templates, render_template
    templates = await get_enabled_templates(db, channel, event)
    if not templates:
        return False
    ok = False
    for tmpl in templates:
        body = render_template(tmpl.body, **kwargs)
        if channel == "email":
            subject = render_template(tmpl.subject or tmpl.label, **kwargs)
            ok = await send_email(db, recipient, subject, body) or ok
        elif channel == "sms":
            ok = await send_sms(db, recipient, body) or ok
        elif channel == "telegram":
            ok = await send_telegram(db, recipient, body) or ok
    return ok


async def notify_admins(db: AsyncSession, event: str, default_message: str, **kwargs) -> None:
    """Send Telegram notification to admin channel using enabled templates for this event."""
    try:
        enabled = (await get_value(db, "telegram", "enabled") or "false").lower() == "true"
        if not enabled:
            return
        chat_id = await get_value(db, "telegram", "default_chat_id") or ""
        if not chat_id:
            return
        # Try template table first (event maps to tg_{event} slug pattern)
        from app.services.template_service import get_enabled_templates, render_template
        templates = await get_enabled_templates(db, "telegram", event)
        if templates:
            for tmpl in templates:
                message = render_template(tmpl.body, **kwargs)
                await send_telegram(db, chat_id, message)
        else:
            # Fallback to default message with variable substitution
            message = default_message
            for k, v in kwargs.items():
                message = message.replace(f"{{{k}}}", str(v or ""))
            await send_telegram(db, chat_id, message)
    except Exception as exc:
        logger.debug("notify_admins skipped: %s", exc)
