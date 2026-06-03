from datetime import timedelta, timezone
import datetime as _datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_client_ip, require_operator_or_admin
from app.db.models.user import User
from app.db.models.connection import Connection as Conn
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


@router.get("/bandwidth-usage")
async def bandwidth_usage(
    days: int = Query(1, ge=1, le=30),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_operator_or_admin),
):
    since = _datetime.datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
    result = await db.execute(
        select(
            Conn.hotspot_username,
            func.sum(Conn.bytes_in).label("bytes_in"),
            func.sum(Conn.bytes_out).label("bytes_out"),
        )
        .where(Conn.connected_at >= since)
        .group_by(Conn.hotspot_username)
        .order_by(func.sum(Conn.bytes_in + Conn.bytes_out).desc())
        .limit(limit)
    )
    return [{"username": r.hotspot_username, "bytes_in": r.bytes_in or 0, "bytes_out": r.bytes_out or 0} for r in result]
