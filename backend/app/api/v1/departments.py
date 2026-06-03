from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.dependencies import require_admin
from app.db.models.department import Department

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("")
async def list_departments(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(Department).order_by(Department.name))
    return [{"id": d.id, "name": d.name, "bandwidth_profile_id": d.bandwidth_profile_id} for d in result.scalars()]


@router.post("")
async def create_department(body: dict, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    d = Department(name=body["name"], bandwidth_profile_id=body.get("bandwidth_profile_id"))
    db.add(d)
    await db.commit()
    await db.refresh(d)
    return {"id": d.id, "name": d.name, "bandwidth_profile_id": d.bandwidth_profile_id}


@router.put("/{dept_id}")
async def update_department(dept_id: int, body: dict, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    d = result.scalars().first()
    if not d:
        raise HTTPException(404, "Department not found")
    if "name" in body:
        d.name = body["name"]
    if "bandwidth_profile_id" in body:
        d.bandwidth_profile_id = body.get("bandwidth_profile_id")
    await db.commit()
    return {"id": d.id, "name": d.name, "bandwidth_profile_id": d.bandwidth_profile_id}


@router.delete("/{dept_id}")
async def delete_department(dept_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    d = result.scalars().first()
    if not d:
        raise HTTPException(404, "Department not found")
    await db.delete(d)
    await db.commit()
    return {"success": True}
