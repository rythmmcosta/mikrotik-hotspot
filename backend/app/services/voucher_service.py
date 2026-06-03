import secrets as _secrets
import string
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.db.models.user import User
from app.db.models.voucher import Voucher


def _generate_code(prefix: str = "WIFI") -> str:
    chars = string.ascii_uppercase + string.digits
    suffix = "".join(_secrets.choice(chars) for _ in range(8))
    return f"{prefix}-{suffix}"


async def list_vouchers(db: AsyncSession) -> list[Voucher]:
    result = await db.execute(select(Voucher).order_by(Voucher.created_at.desc()))
    return list(result.scalars())


async def create_vouchers(
    db: AsyncSession,
    creator: User,
    count: int = 1,
    description: str | None = None,
    max_uses: int = 1,
    session_hours: int = 4,
    bandwidth_profile_id: int | None = None,
    expires_at: datetime | None = None,
    prefix: str = "WIFI",
) -> list[Voucher]:
    vouchers = []
    for _ in range(min(count, 100)):
        code = ""
        for _ in range(10):
            code = _generate_code(prefix)
            dupe = await db.execute(select(Voucher).where(Voucher.code == code))
            if not dupe.scalar_one_or_none():
                break
        v = Voucher(
            code=code,
            description=description,
            max_uses=max_uses,
            session_hours=session_hours,
            bandwidth_profile_id=bandwidth_profile_id,
            expires_at=expires_at,
            created_by=creator.id,
        )
        db.add(v)
        vouchers.append(v)
    await db.flush()
    return vouchers


async def deactivate_voucher(db: AsyncSession, voucher_id: int) -> Voucher:
    result = await db.execute(select(Voucher).where(Voucher.id == voucher_id))
    v = result.scalar_one_or_none()
    if not v:
        raise NotFoundException("Voucher not found")
    v.is_active = False
    return v


async def use_voucher(db: AsyncSession, code: str) -> Voucher:
    result = await db.execute(select(Voucher).where(Voucher.code == code.upper(), Voucher.is_active == True))
    v = result.scalar_one_or_none()
    if not v:
        raise BadRequestException("Invalid voucher code")
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if v.expires_at and v.expires_at < now:
        raise BadRequestException("Voucher has expired")
    if v.max_uses > 0 and v.used_count >= v.max_uses:
        raise BadRequestException("Voucher has been fully used")
    v.used_count += 1
    if v.max_uses > 0 and v.used_count >= v.max_uses:
        v.is_active = False
    return v
