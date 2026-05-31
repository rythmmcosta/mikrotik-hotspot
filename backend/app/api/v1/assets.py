from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_operator_or_admin, get_current_user
from app.services import asset_service

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("")
async def list_assets(
    status: str | None = None,
    employee_id: int | None = None,
    connection_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_operator_or_admin),
):
    return await asset_service.list_assets(db, status=status, employee_id=employee_id, connection_type=connection_type)


@router.post("", status_code=201)
async def create_asset(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ("admin", "operator"):
        raise HTTPException(403, "Insufficient permissions")
    return await asset_service.create_asset(db, body, added_by=current_user.id)


@router.get("/{asset_id}")
async def get_asset(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_operator_or_admin),
):
    asset = await asset_service.get_asset(db, asset_id)
    if not asset:
        raise HTTPException(404, "Asset not found")
    return asset_service._asset_to_dict(asset)


@router.put("/{asset_id}")
async def update_asset(
    asset_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_operator_or_admin),
):
    result = await asset_service.update_asset(db, asset_id, body)
    if not result:
        raise HTTPException(404, "Asset not found")
    return result


@router.delete("/{asset_id}", status_code=204)
async def delete_asset(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_operator_or_admin),
):
    deleted = await asset_service.delete_asset(db, asset_id)
    if not deleted:
        raise HTTPException(404, "Asset not found")


@router.post("/{asset_id}/block")
async def block_asset(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_operator_or_admin),
):
    result = await asset_service.block_asset(db, asset_id)
    if not result:
        raise HTTPException(404, "Asset not found")
    return result


@router.post("/{asset_id}/unblock")
async def unblock_asset(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_operator_or_admin),
):
    result = await asset_service.unblock_asset(db, asset_id)
    if not result:
        raise HTTPException(404, "Asset not found")
    return result


@router.get("/{asset_id}/metrics")
async def get_asset_metrics(
    asset_id: int,
    window: str = "1h",
    db: AsyncSession = Depends(get_db),
    _=Depends(require_operator_or_admin),
):
    return await asset_service.get_asset_metrics(db, asset_id, window=window)


@router.post("/generate-token")
async def generate_token(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ("admin", "operator"):
        raise HTTPException(403, "Insufficient permissions")
    asset_id = body.get("asset_id")
    if not asset_id:
        raise HTTPException(400, "asset_id required")
    result = await asset_service.generate_agent_token(db, asset_id)
    if not result:
        raise HTTPException(404, "Asset not found")
    return result
