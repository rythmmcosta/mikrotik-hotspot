from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import require_admin
from app.db.models.user import User
from app.services import voucher_service

router = APIRouter(prefix="/vouchers", tags=["vouchers"])


class VoucherCreateRequest(BaseModel):
    count: int = 1
    description: str | None = None
    max_uses: int = 1
    session_hours: int = 4
    bandwidth_profile_id: int | None = None
    expires_at: datetime | None = None
    prefix: str = "WIFI"


@router.get("")
async def list_vouchers(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    items = await voucher_service.list_vouchers(db)
    return [
        {
            "id": v.id, "code": v.code, "description": v.description,
            "max_uses": v.max_uses, "used_count": v.used_count,
            "session_hours": v.session_hours, "expires_at": v.expires_at,
            "is_active": v.is_active, "created_at": v.created_at,
        }
        for v in items
    ]


@router.post("", status_code=201)
async def create_vouchers(
    body: VoucherCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    items = await voucher_service.create_vouchers(
        db, current_user, body.count, body.description,
        body.max_uses, body.session_hours, body.bandwidth_profile_id,
        body.expires_at, body.prefix,
    )
    return [{"id": v.id, "code": v.code} for v in items]


@router.delete("/{voucher_id}")
async def deactivate_voucher(
    voucher_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    await voucher_service.deactivate_voucher(db, voucher_id)
    return {"message": "Voucher deactivated"}


@router.post("/validate")
async def validate_voucher(body: dict, db: AsyncSession = Depends(get_db)):
    """Public endpoint — validate a voucher code without auth."""
    code = body.get("code", "")
    from app.services.guest_service import validate_voucher as _validate
    result = await _validate(db, code)
    if not result:
        return {"valid": False}
    return {"valid": True, **result}
