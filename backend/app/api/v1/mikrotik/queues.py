from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import require_admin
from app.db.models.user import User
from app.mikrotik import queue_manager

router = APIRouter(prefix="/mikrotik/queues", tags=["mikrotik"])


class QueueParams(BaseModel):
    params: dict


@router.get("/simple")
async def list_simple(_: User = Depends(require_admin)):
    return await queue_manager.list_simple()


@router.post("/simple")
async def add_simple(name: str, target: str, max_limit: str, _: User = Depends(require_admin)):
    await queue_manager.add_simple(name, target, max_limit)
    return {"message": "Queue added"}


@router.put("/simple/{queue_id}")
async def set_simple(queue_id: str, body: QueueParams, _: User = Depends(require_admin)):
    await queue_manager.set_simple(queue_id, **body.params)
    return {"message": "Queue updated"}


@router.delete("/simple/{queue_id}")
async def remove_simple(queue_id: str, _: User = Depends(require_admin)):
    await queue_manager.remove_simple(queue_id)
    return {"message": "Queue removed"}
