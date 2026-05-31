from fastapi import APIRouter, Depends

from app.dependencies import require_admin
from app.db.models.user import User
from app.mikrotik import interface_manager

router = APIRouter(prefix="/mikrotik/interfaces", tags=["mikrotik"])


@router.get("")
async def list_interfaces(_: User = Depends(require_admin)):
    return await interface_manager.list_interfaces()


@router.get("/{name}")
async def get_interface(name: str, _: User = Depends(require_admin)):
    return await interface_manager.get_interface(name)


@router.post("/{name}/enable")
async def enable_interface(name: str, _: User = Depends(require_admin)):
    await interface_manager.enable_interface(name)
    return {"message": f"Interface {name} enabled"}


@router.post("/{name}/disable")
async def disable_interface(name: str, _: User = Depends(require_admin)):
    await interface_manager.disable_interface(name)
    return {"message": f"Interface {name} disabled"}


@router.get("/{name}/traffic")
async def get_traffic(name: str, _: User = Depends(require_admin)):
    return await interface_manager.get_traffic(name)
