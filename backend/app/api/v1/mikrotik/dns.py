from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import require_admin
from app.db.models.user import User
from app.mikrotik import dns_manager

router = APIRouter(prefix="/mikrotik/dns", tags=["mikrotik"])


class DnsEntry(BaseModel):
    name: str
    address: str


@router.get("/static")
async def list_static(_: User = Depends(require_admin)):
    return await dns_manager.list_static()


@router.post("/static")
async def add_static(body: DnsEntry, _: User = Depends(require_admin)):
    await dns_manager.add_static(body.name, body.address)
    return {"message": "DNS entry added"}


@router.delete("/static/{entry_id}")
async def remove_static(entry_id: str, _: User = Depends(require_admin)):
    await dns_manager.remove_static(entry_id)
    return {"message": "DNS entry removed"}


@router.get("/settings")
async def dns_settings(_: User = Depends(require_admin)):
    return await dns_manager.get_dns_settings()
