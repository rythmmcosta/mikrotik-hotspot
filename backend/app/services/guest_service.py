import re
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.core.security import encrypt_value
from app.db.models.access_queue import AccessQueue
from app.db.models.bandwidth_profile import BandwidthProfile
from app.db.models.guest import Guest
from app.db.models.user import User
from app.mikrotik import hotspot_manager
from app.mikrotik.exceptions import RouterOSConnectionError
from app.services.otp_service import send_otp, verify_otp
from app.services.settings_service import get_value


BLOCKED_DOMAINS = {"mailinator.com", "guerrillamail.com", "tempmail.com", "trashmail.com"}


async def _validate_email_domain(db: AsyncSession, email: str) -> None:
    domain = email.split("@")[-1].lower()
    if domain in BLOCKED_DOMAINS:
        raise BadRequestException(f"Email provider {domain!r} is not allowed.")

    allowed_csv = await get_value(db, "system", "allowed_email_domains") or ""
    allowed = [d.strip().lower() for d in allowed_csv.split(",") if d.strip()]
    if allowed and domain not in allowed:
        raise BadRequestException(f"Email domain @{domain} is not permitted for guest access.")


def _make_guest_username(full_name: str, guest_id: int) -> str:
    base = re.sub(r"[^a-zA-Z0-9]", "", full_name.lower())[:12]
    return f"guest-{base}-{guest_id}"


async def register_guest(db: AsyncSession, full_name: str, email: str, mobile: str) -> Guest:
    await _validate_email_domain(db, email)

    guest = Guest(full_name=full_name, email=email, mobile=mobile, status="pending_otp")
    db.add(guest)
    await db.flush()

    await send_otp(db, guest.id, "guest_email", email)
    return guest


async def verify_guest_otp(db: AsyncSession, guest_id: int, target_type: str, code: str) -> Guest:
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    guest = result.scalar_one_or_none()
    if not guest:
        raise NotFoundException("Guest not found")

    if guest.status not in ("pending_otp",):
        raise BadRequestException(f"Cannot verify OTP in status: {guest.status}")

    target_value = guest.email if target_type == "guest_email" else guest.mobile
    await verify_otp(db, guest_id, target_type, code)

    if target_type == "guest_email":
        guest.email_verified = True
    else:
        guest.mobile_verified = True

    otp_method = await get_value(db, "otp", "method") or "email"

    # Determine if verification is complete
    if otp_method == "email" and guest.email_verified:
        await _move_to_queue(db, guest)
    elif otp_method == "sms" and guest.email_verified and guest.mobile_verified:
        await _move_to_queue(db, guest)
    elif otp_method == "sms" and guest.email_verified and not guest.mobile_verified:
        # Trigger mobile OTP next
        await send_otp(db, guest.id, "guest_mobile", guest.mobile)

    return guest


async def _move_to_queue(db: AsyncSession, guest: Guest) -> None:
    guest.status = "pending_approval"
    entry = AccessQueue(
        guest_id=guest.id,
        full_name=guest.full_name,
        email=guest.email,
        mobile=guest.mobile,
    )
    db.add(entry)


async def approve_guest(
    db: AsyncSession,
    guest_id: int,
    approver: User,
    bandwidth_profile_id: int | None = None,
    notes: str | None = None,
    access_hours: int | None = None,
) -> Guest:
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    guest = result.scalar_one_or_none()
    if not guest:
        raise NotFoundException("Guest not found")
    if guest.status != "pending_approval":
        raise BadRequestException(f"Guest is not pending approval (status: {guest.status})")

    # Resolve bandwidth profile
    if bandwidth_profile_id is None:
        bp = await db.execute(
            select(BandwidthProfile).where(BandwidthProfile.is_default_guest == True, BandwidthProfile.is_active == True)
        )
        bp_row = bp.scalar_one_or_none()
        bandwidth_profile_id = bp_row.id if bp_row else None

    guest.bandwidth_profile_id = bandwidth_profile_id
    guest.hotspot_username = _make_guest_username(guest.full_name, guest.id)
    hotspot_pass = secrets.token_urlsafe(10)
    guest.hotspot_password = encrypt_value(hotspot_pass)
    guest.status = "approved"
    guest.approved_by = approver.id
    guest.approved_at = datetime.now(timezone.utc)
    guest.approval_notes = notes

    if access_hours:
        guest.access_expires_at = datetime.now(timezone.utc) + timedelta(hours=access_hours)
    else:
        default_hours = int(await get_value(db, "system", "guest_session_max_hours") or 8)
        if default_hours:
            guest.access_expires_at = datetime.now(timezone.utc) + timedelta(hours=default_hours)

    profile = "default"
    if bandwidth_profile_id:
        bp_res = await db.execute(select(BandwidthProfile).where(BandwidthProfile.id == bandwidth_profile_id))
        bp_row = bp_res.scalar_one_or_none()
        if bp_row and bp_row.mikrotik_profile_name:
            profile = bp_row.mikrotik_profile_name

    try:
        await hotspot_manager.add_user(
            username=guest.hotspot_username,
            password=hotspot_pass,
            profile=profile,
            comment=f"guest_id:{guest.id}",
        )
    except RouterOSConnectionError:
        pass

    # Remove from queue
    q_result = await db.execute(select(AccessQueue).where(AccessQueue.guest_id == guest_id))
    q_entry = q_result.scalar_one_or_none()
    if q_entry:
        await db.delete(q_entry)

    return guest


async def reject_guest(db: AsyncSession, guest_id: int, rejecter: User, notes: str | None = None) -> Guest:
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    guest = result.scalar_one_or_none()
    if not guest:
        raise NotFoundException("Guest not found")

    guest.status = "rejected"
    guest.rejected_by = rejecter.id
    guest.rejected_at = datetime.now(timezone.utc)
    guest.approval_notes = notes

    q_result = await db.execute(select(AccessQueue).where(AccessQueue.guest_id == guest_id))
    q_entry = q_result.scalar_one_or_none()
    if q_entry:
        await db.delete(q_entry)

    return guest


async def terminate_guest(db: AsyncSession, guest_id: int, terminator: User) -> Guest:
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    guest = result.scalar_one_or_none()
    if not guest:
        raise NotFoundException("Guest not found")

    if guest.hotspot_username:
        try:
            await hotspot_manager.remove_user(guest.hotspot_username)
        except RouterOSConnectionError:
            pass

    guest.status = "suspended"
    return guest


async def get_guest_status(db: AsyncSession, guest_id: int) -> dict:
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    guest = result.scalar_one_or_none()
    if not guest:
        raise NotFoundException("Guest not found")

    resp = {"guest_id": guest.id, "status": guest.status}
    if guest.status == "approved":
        from app.core.security import decrypt_value
        resp["hotspot_username"] = guest.hotspot_username
        resp["hotspot_password"] = decrypt_value(guest.hotspot_password) if guest.hotspot_password else None
    return resp


async def list_guests(
    db: AsyncSession, page: int = 1, per_page: int = 20, status: str | None = None
) -> tuple[list[Guest], int]:
    q = select(Guest)
    cq = select(func.count(Guest.id))
    if status:
        q = q.where(Guest.status == status)
        cq = cq.where(Guest.status == status)
    q = q.offset((page - 1) * per_page).limit(per_page).order_by(Guest.created_at.desc())
    result = await db.execute(q)
    count = await db.execute(cq)
    return list(result.scalars()), count.scalar()


async def list_queue(db: AsyncSession) -> list[AccessQueue]:
    result = await db.execute(
        select(AccessQueue).order_by(AccessQueue.priority, AccessQueue.submitted_at)
    )
    return list(result.scalars())
