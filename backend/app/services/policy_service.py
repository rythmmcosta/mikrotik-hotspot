from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.policy_rule import PolicyRule
from app.db.models.usage_policy import UsagePolicy
from app.mikrotik import policy_manager


async def list_policies(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(UsagePolicy).options(selectinload(UsagePolicy.rules)).order_by(UsagePolicy.priority)
    )
    return [_policy_to_dict(p) for p in result.scalars().all()]


async def create_policy(db: AsyncSession, data: dict, created_by: int) -> dict:
    policy = UsagePolicy(
        name=data["name"],
        description=data.get("description"),
        scope=data.get("scope", "global"),
        scope_id=data.get("scope_id"),
        priority=data.get("priority", 5),
        mikrotik_address_list=data.get("mikrotik_address_list") or f"policy-{data['name'].replace(' ', '-')}",
        created_by=created_by,
    )
    db.add(policy)
    await db.commit()
    await db.refresh(policy)
    return _policy_to_dict(policy)


async def get_policy(db: AsyncSession, policy_id: int) -> UsagePolicy | None:
    result = await db.execute(
        select(UsagePolicy).where(UsagePolicy.id == policy_id).options(selectinload(UsagePolicy.rules))
    )
    return result.scalar_one_or_none()


async def update_policy(db: AsyncSession, policy_id: int, data: dict) -> dict | None:
    policy = await get_policy(db, policy_id)
    if not policy:
        return None
    for field in ("name", "description", "scope", "scope_id", "priority", "is_active", "mikrotik_address_list"):
        if field in data:
            setattr(policy, field, data[field])
    await db.commit()
    await db.refresh(policy)
    return _policy_to_dict(policy)


async def delete_policy(db: AsyncSession, policy_id: int) -> bool:
    policy = await get_policy(db, policy_id)
    if not policy:
        return False
    if policy.mikrotik_address_list:
        try:
            await policy_manager.remove_policy(policy.name, policy.mikrotik_address_list)
        except Exception:
            pass
    await db.delete(policy)
    await db.commit()
    return True


async def add_rule(db: AsyncSession, policy_id: int, data: dict) -> dict | None:
    policy = await get_policy(db, policy_id)
    if not policy:
        return None
    rule = PolicyRule(
        policy_id=policy_id,
        rule_type=data["rule_type"],
        value=data["value"],
        action=data.get("action", "block"),
        description=data.get("description"),
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return _rule_to_dict(rule)


async def delete_rule(db: AsyncSession, rule_id: int) -> bool:
    result = await db.execute(select(PolicyRule).where(PolicyRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        return False
    await db.delete(rule)
    await db.commit()
    return True


async def sync_to_mikrotik(db: AsyncSession, policy_id: int) -> dict:
    policy = await get_policy(db, policy_id)
    if not policy:
        return {"success": False, "error": "Policy not found"}

    domains = [r.value for r in policy.rules if r.rule_type == "domain" and r.is_active]
    address_list = policy.mikrotik_address_list or f"policy-{policy.name.replace(' ', '-')}"

    try:
        await policy_manager.sync_policy(policy.name, address_list, domains)
        if not policy.mikrotik_address_list:
            policy.mikrotik_address_list = address_list
            await db.commit()
        return {"success": True, "domains_synced": len(domains), "address_list": address_list}
    except Exception as e:
        return {"success": False, "error": str(e)}


def _policy_to_dict(p: UsagePolicy) -> dict[str, Any]:
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "scope": p.scope,
        "scope_id": p.scope_id,
        "is_active": p.is_active,
        "priority": p.priority,
        "mikrotik_address_list": p.mikrotik_address_list,
        "created_by": p.created_by,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        "rules": [_rule_to_dict(r) for r in (p.rules or [])],
    }


def _rule_to_dict(r: PolicyRule) -> dict[str, Any]:
    return {
        "id": r.id,
        "policy_id": r.policy_id,
        "rule_type": r.rule_type,
        "value": r.value,
        "action": r.action,
        "description": r.description,
        "is_active": r.is_active,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }
