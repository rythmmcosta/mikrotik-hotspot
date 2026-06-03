import hashlib
import random
import string
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException
from app.db.models.otp_log import OtpLog
from app.services.notification_service import send_email, send_sms
from app.services.settings_service import get_value

OTP_LENGTH = 6


def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=OTP_LENGTH))


def _hash_otp(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


async def send_otp(db: AsyncSession, guest_id: int, target_type: str, target_value: str) -> str:
    otp_method = await get_value(db, "otp", "method") or "email"
    ttl_minutes = int(await get_value(db, "otp", "ttl_minutes") or 10)

    # Rate-limit: max 3 sends per target per hour
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = await db.execute(
        select(OtpLog).where(
            OtpLog.target_id == guest_id,
            OtpLog.target_type == target_type,
            OtpLog.created_at >= one_hour_ago,
        )
    )
    if len(list(recent.scalars())) >= 3:
        raise BadRequestException("Too many OTP requests. Please wait before requesting again.")

    code = _generate_otp()
    channel = otp_method if target_type == "guest_mobile" else "email"

    log = OtpLog(
        target_type=target_type,
        target_id=guest_id,
        target_value=target_value,
        otp_code=_hash_otp(code),
        channel=channel,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes),
    )
    db.add(log)
    await db.flush()

    from app.services.template_service import get_enabled_templates, render_template
    ttl_str = str(ttl_minutes)

    if channel == "email":
        templates = await get_enabled_templates(db, "email", "otp_verification")
        if templates:
            body = render_template(templates[0].body, otp=code, minutes=ttl_str, name="")
            subject = render_template(templates[0].subject or "Your WiFi Access Code", otp=code, minutes=ttl_str)
        else:
            subject = "WiFi Access - Verification Code"
            body = f"<p>Your WiFi code: <b style='font-size:24px'>{code}</b>. Expires in {ttl_minutes} min.</p>"
        await send_email(db, target_value, subject, body)
    else:
        templates = await get_enabled_templates(db, "sms", "otp_verification")
        if templates:
            msg = render_template(templates[0].body, otp=code, minutes=ttl_str)
        else:
            msg = f"Your WiFi verification code is: {code}. Valid for {ttl_minutes} minutes."
        await send_sms(db, target_value, msg)

    return code  # Only returned in tests; not exposed via API


async def verify_otp(db: AsyncSession, guest_id: int, target_type: str, code: str) -> bool:
    max_attempts = int(await get_value(db, "otp", "max_attempts") or 3)
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(OtpLog).where(
            OtpLog.target_id == guest_id,
            OtpLog.target_type == target_type,
            OtpLog.is_used == False,
            OtpLog.is_expired == False,
            OtpLog.expires_at >= now,
        ).order_by(OtpLog.created_at.desc())
    )
    log = result.scalars().first()

    if not log:
        raise BadRequestException("No active OTP found. Please request a new code.")

    log.attempts += 1

    if log.attempts >= max_attempts:
        log.is_expired = True
        raise BadRequestException("Too many failed attempts. Please request a new code.")

    if log.otp_code != _hash_otp(code):
        raise BadRequestException(
            f"Invalid code. {max_attempts - log.attempts} attempt(s) remaining."
        )

    log.is_used = True
    log.used_at = now
    return True
