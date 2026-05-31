from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_admin, get_current_user
from app.services import policy_service

router = APIRouter(prefix="/policies", tags=["policies"])


@router.get("")
async def list_policies(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    return await policy_service.list_policies(db)


@router.post("", status_code=201)
async def create_policy(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_admin),
):
    return await policy_service.create_policy(db, body, created_by=current_user.id)


@router.get("/{policy_id}")
async def get_policy(
    policy_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    p = await policy_service.get_policy(db, policy_id)
    if not p:
        raise HTTPException(404, "Policy not found")
    return policy_service._policy_to_dict(p)


@router.put("/{policy_id}")
async def update_policy(
    policy_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    result = await policy_service.update_policy(db, policy_id, body)
    if not result:
        raise HTTPException(404, "Policy not found")
    return result


@router.delete("/{policy_id}", status_code=204)
async def delete_policy(
    policy_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    deleted = await policy_service.delete_policy(db, policy_id)
    if not deleted:
        raise HTTPException(404, "Policy not found")


@router.get("/{policy_id}/rules")
async def get_rules(
    policy_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    p = await policy_service.get_policy(db, policy_id)
    if not p:
        raise HTTPException(404, "Policy not found")
    return [policy_service._rule_to_dict(r) for r in p.rules]


@router.post("/{policy_id}/rules", status_code=201)
async def add_rule(
    policy_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    result = await policy_service.add_rule(db, policy_id, body)
    if not result:
        raise HTTPException(404, "Policy not found")
    return result


@router.delete("/{policy_id}/rules/{rule_id}", status_code=204)
async def delete_rule(
    policy_id: int,
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    deleted = await policy_service.delete_rule(db, rule_id)
    if not deleted:
        raise HTTPException(404, "Rule not found")


@router.post("/{policy_id}/sync")
async def sync_policy(
    policy_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    return await policy_service.sync_to_mikrotik(db, policy_id)
