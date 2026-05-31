from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_operator_or_admin
from app.services.browsing_service import get_browsing_logs, get_browsing_stats

router = APIRouter(prefix="/browsing", tags=["browsing"])


@router.get("")
async def list_browsing(
    username: str | None = None,
    domain: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_operator_or_admin),
):
    return await get_browsing_logs(
        db,
        username=username,
        domain=domain,
        date_from=date_from,
        date_to=date_to,
        page=page,
        per_page=per_page,
    )


@router.get("/stats")
async def browsing_stats(
    hours: int = Query(24, ge=1, le=720),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_operator_or_admin),
):
    return await get_browsing_stats(db, hours=hours)


@router.get("/export")
async def export_browsing(
    username: str | None = None,
    domain: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_operator_or_admin),
):
    result = await get_browsing_logs(db, username=username, domain=domain,
                                     date_from=date_from, date_to=date_to,
                                     page=1, per_page=10000)

    def generate():
        yield "username,user_type,domain,query_type,ip_address,mac_address,queried_at\n"
        for item in result["items"]:
            yield (
                f"{item.get('hotspot_username','')},{item.get('user_type','')},"
                f"{item.get('domain','')},{item.get('query_type','')},"
                f"{item.get('ip_address','')},{item.get('mac_address','')},"
                f"{item.get('queried_at','')}\n"
            )

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=browsing_log.csv"},
    )
