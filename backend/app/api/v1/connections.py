from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_client_ip, require_operator_or_admin
from app.db.models.user import User
from app.schemas.connection import ConnectionListResponse, ConnectionResponse, ConnectionStatsResponse
from app.services import audit_service, connection_service

router = APIRouter(prefix="/connections", tags=["connections"])


@router.get("/active", response_model=list[ConnectionResponse])
async def active_connections(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_operator_or_admin),
):
    return await connection_service.list_active(db)


@router.get("/stats", response_model=ConnectionStatsResponse)
async def connection_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_operator_or_admin),
):
    return await connection_service.get_stats(db)


@router.get("/history", response_model=ConnectionListResponse)
async def connection_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_operator_or_admin),
):
    items, total = await connection_service.list_history(db, page, per_page)
    return {"items": items, "total": total}


@router.post("/{connection_id}/terminate", response_model=ConnectionResponse)
async def terminate(
    connection_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    conn = await connection_service.terminate_connection(db, connection_id, current_user)
    if not conn:
        from app.core.exceptions import NotFoundException
        raise NotFoundException("Connection not found or already inactive")
    await audit_service.log_action(db, "connection.terminated", current_user, "connection", connection_id,
                                   None, get_client_ip(request))
    return conn
