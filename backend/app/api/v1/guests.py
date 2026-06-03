from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_client_ip, require_operator_or_admin
from app.db.models.user import User
from app.schemas.guest import (
    GuestApproveRequest,
    GuestListResponse,
    GuestRegister,
    GuestRegisterResponse,
    GuestRejectRequest,
    GuestResponse,
    GuestStatusResponse,
    QueueEntryResponse,
)
from app.services import audit_service, guest_service

router = APIRouter(prefix="/guests", tags=["guests"])


@router.post("/register", response_model=GuestRegisterResponse, status_code=201)
async def register(body: GuestRegister, db: AsyncSession = Depends(get_db)):
    guest = await guest_service.register_guest(db, body.full_name, body.email, body.mobile)
    return {"guest_id": guest.id, "status": guest.status, "message": "OTP sent to your email"}


@router.get("/{guest_id}/status", response_model=GuestStatusResponse)
async def guest_status(guest_id: int, db: AsyncSession = Depends(get_db)):
    return await guest_service.get_guest_status(db, guest_id)


@router.get("", response_model=GuestListResponse)
async def list_guests(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_operator_or_admin),
):
    items, total = await guest_service.list_guests(db, page, per_page, status)
    return {"items": items, "total": total, "page": page, "per_page": per_page}


@router.get("/queue", response_model=list[QueueEntryResponse])
async def get_queue(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_operator_or_admin),
):
    return await guest_service.list_queue(db)


@router.get("/{guest_id}", response_model=GuestResponse)
async def get_guest(
    guest_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_operator_or_admin),
):
    from sqlalchemy import select
    from app.db.models.guest import Guest
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    g = result.scalar_one_or_none()
    if not g:
        from app.core.exceptions import NotFoundException
        raise NotFoundException()
    return g


@router.post("/{guest_id}/approve", response_model=GuestResponse)
async def approve_guest(
    guest_id: int,
    body: GuestApproveRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    guest = await guest_service.approve_guest(
        db, guest_id, current_user, body.bandwidth_profile_id, body.notes, body.access_hours
    )
    await audit_service.log_action(db, "guest.approved", current_user, "guest", guest_id,
                                   None, get_client_ip(request))
    return guest


@router.post("/{guest_id}/reject", response_model=GuestResponse)
async def reject_guest(
    guest_id: int,
    body: GuestRejectRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    guest = await guest_service.reject_guest(db, guest_id, current_user, body.notes)
    await audit_service.log_action(db, "guest.rejected", current_user, "guest", guest_id,
                                   None, get_client_ip(request))
    return guest


@router.post("/{guest_id}/terminate", response_model=GuestResponse)
async def terminate_guest(
    guest_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    guest = await guest_service.terminate_guest(db, guest_id, current_user)
    await audit_service.log_action(db, "guest.terminated", current_user, "guest", guest_id,
                                   None, get_client_ip(request))
    return guest


class BulkApproveRequest(BaseModel):
    guest_ids: list[int]
    access_hours: int | None = None
    bandwidth_profile_id: int | None = None


class BulkRejectRequest(BaseModel):
    guest_ids: list[int]
    notes: str | None = None


@router.post("/bulk-approve")
async def bulk_approve(
    body: BulkApproveRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    results = await guest_service.bulk_approve_guests(
        db, body.guest_ids, current_user, body.bandwidth_profile_id, body.access_hours
    )
    for g in results:
        await audit_service.log_action(db, "guest.bulk_approved", current_user, "guest", g.id, None, get_client_ip(request))
    return {"approved": len(results), "ids": [g.id for g in results]}


@router.post("/bulk-reject")
async def bulk_reject(
    body: BulkRejectRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    results = await guest_service.bulk_reject_guests(db, body.guest_ids, current_user, body.notes)
    for g in results:
        await audit_service.log_action(db, "guest.bulk_rejected", current_user, "guest", g.id, None, get_client_ip(request))
    return {"rejected": len(results), "ids": [g.id for g in results]}
