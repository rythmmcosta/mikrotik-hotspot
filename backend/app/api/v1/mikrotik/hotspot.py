from fastapi import APIRouter, Depends

from app.dependencies import require_admin
from app.db.models.user import User
from app.mikrotik import hotspot_manager

router = APIRouter(prefix="/mikrotik/hotspot", tags=["mikrotik"])


@router.get("/users")
async def list_users(_: User = Depends(require_admin)):
    return await hotspot_manager.list_users()


@router.get("/active")
async def list_active(_: User = Depends(require_admin)):
    return await hotspot_manager.list_active_sessions()


@router.get("/profiles")
async def list_profiles(_: User = Depends(require_admin)):
    return await hotspot_manager.list_profiles()


@router.delete("/active/{session_id}")
async def terminate_session(session_id: str, _: User = Depends(require_admin)):
    await hotspot_manager.terminate_session(session_id)
    return {"message": "Session terminated"}
