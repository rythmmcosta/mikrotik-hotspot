from fastapi import APIRouter, Depends

from app.dependencies import require_admin
from app.db.models.user import User
from app.mikrotik import system_manager, interface_manager

router = APIRouter(prefix="/mikrotik", tags=["mikrotik"])


@router.get("/system/resources")
async def system_resources(_: User = Depends(require_admin)):
    return await system_manager.get_resources()


@router.get("/system/identity")
async def system_identity(_: User = Depends(require_admin)):
    return {"identity": await system_manager.get_identity()}


@router.get("/system/logs")
async def system_logs(_: User = Depends(require_admin)):
    return await system_manager.get_logs()


@router.get("/ip/addresses")
async def ip_addresses(_: User = Depends(require_admin)):
    return await system_manager.list_ip_addresses()


@router.get("/ip/routes")
async def ip_routes(_: User = Depends(require_admin)):
    return await system_manager.list_routes()
