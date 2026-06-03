from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.dependencies import require_admin
from app.db.models.guest_blacklist import GuestBlacklist

router = APIRouter(prefix="/guests/blacklist", tags=["blacklist"])


@router.get("")
async def list_blacklist(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(GuestBlacklist).order_by(GuestBlacklist.created_at.desc()))
    return [_out(b) for b in result.scalars()]


@router.post("")
async def add_to_blacklist(body: dict, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    entry = GuestBlacklist(type=body["type"], value=body["value"].strip().lower(),
                           reason=body.get("reason"), added_by=user.id)
    db.add(entry)
    try:
        await db.commit()
        await db.refresh(entry)
    except Exception:
        await db.rollback()
        raise HTTPException(400, "Already blacklisted")
    return _out(entry)


@router.delete("/{entry_id}")
async def remove_from_blacklist(entry_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(GuestBlacklist).where(GuestBlacklist.id == entry_id))
    entry = result.scalars().first()
    if not entry:
        raise HTTPException(404, "Not found")
    await db.delete(entry)
    await db.commit()
    return {"success": True}


def _out(b):
    return {"id": b.id, "type": b.type, "value": b.value, "reason": b.reason,
            "created_at": b.created_at.isoformat() if b.created_at else None}
