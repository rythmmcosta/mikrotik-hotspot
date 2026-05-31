from fastapi import APIRouter, Depends

from app.dependencies import require_admin
from app.db.models.user import User
from app.mikrotik import dhcp_manager

router = APIRouter(prefix="/mikrotik/dhcp", tags=["mikrotik"])


@router.get("/servers")
async def list_servers(_: User = Depends(require_admin)):
    return await dhcp_manager.list_servers()


@router.get("/leases")
async def list_leases(_: User = Depends(require_admin)):
    return await dhcp_manager.list_leases()


@router.post("/leases/{lease_id}/make-static")
async def make_static(lease_id: str, _: User = Depends(require_admin)):
    await dhcp_manager.make_static(lease_id)
    return {"message": "Lease made static"}


@router.delete("/leases/{lease_id}")
async def remove_lease(lease_id: str, _: User = Depends(require_admin)):
    await dhcp_manager.remove_lease(lease_id)
    return {"message": "Lease released"}


@router.get("/pools")
async def list_pools(_: User = Depends(require_admin)):
    return await dhcp_manager.list_pools()
