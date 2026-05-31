from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import require_admin
from app.db.models.audit_log import AuditLog
from app.db.models.user import User
from app.schemas.audit import AuditLogListResponse

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=AuditLogListResponse)
async def list_audit(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    action: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    q = select(AuditLog)
    cq = select(func.count(AuditLog.id))
    if action:
        q = q.where(AuditLog.action.like(f"%{action}%"))
        cq = cq.where(AuditLog.action.like(f"%{action}%"))
    q = q.order_by(AuditLog.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    count = await db.execute(cq)
    return {"items": list(result.scalars()), "total": count.scalar(), "page": page, "per_page": per_page}
