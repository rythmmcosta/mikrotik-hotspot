from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.guest import OtpSendRequest, OtpVerifyRequest
from app.services import otp_service
from app.services.guest_service import verify_guest_otp

router = APIRouter(prefix="/otp", tags=["otp"])


@router.post("/send")
async def send_otp(body: OtpSendRequest, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    from app.db.models.guest import Guest
    from app.core.exceptions import NotFoundException
    result = await db.execute(select(Guest).where(Guest.id == body.guest_id))
    guest = result.scalar_one_or_none()
    if not guest:
        raise NotFoundException("Guest not found")
    target_value = guest.email if body.target_type == "guest_email" else guest.mobile
    await otp_service.send_otp(db, body.guest_id, body.target_type, target_value)
    return {"message": "OTP sent"}


@router.post("/verify")
async def verify_otp(body: OtpVerifyRequest, db: AsyncSession = Depends(get_db)):
    guest = await verify_guest_otp(db, body.guest_id, body.target_type, body.code)
    return {"status": guest.status, "message": "Verification successful"}


@router.post("/resend")
async def resend_otp(body: OtpSendRequest, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    from app.db.models.guest import Guest
    from app.core.exceptions import NotFoundException
    result = await db.execute(select(Guest).where(Guest.id == body.guest_id))
    guest = result.scalar_one_or_none()
    if not guest:
        raise NotFoundException("Guest not found")
    target_value = guest.email if body.target_type == "guest_email" else guest.mobile
    await otp_service.send_otp(db, body.guest_id, body.target_type, target_value)
    return {"message": "OTP resent"}
