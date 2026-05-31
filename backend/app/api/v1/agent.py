"""Agent endpoints — accessible from MikroTik walled garden (no auth required at transport layer)."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.services import agent_service

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/heartbeat")
async def heartbeat(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    asset_id = body.get("asset_id")
    token = body.get("token", "")
    if not asset_id or not token:
        return {"authorized": False, "error": "asset_id and token required"}
    return await agent_service.heartbeat(
        db, asset_id, token,
        hostname=body.get("hostname"),
        agent_version=body.get("agent_version"),
        os_type=body.get("os_type"),
    )


@router.post("/metrics")
async def push_metrics(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    asset_id = body.get("asset_id")
    token = body.get("token", "")
    metrics = body.get("metrics", [])
    if not asset_id or not token:
        return {"authorized": False}
    return await agent_service.record_metrics(db, asset_id, token, metrics)


@router.post("/browsing")
async def push_browsing(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    asset_id = body.get("asset_id")
    token = body.get("token", "")
    entries = body.get("entries", [])
    if not asset_id or not token:
        return {"authorized": False}
    return await agent_service.record_browsing(db, asset_id, token, entries)
