from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import require_admin
from app.db.models.user import User
from app.mikrotik import firewall_manager

router = APIRouter(prefix="/mikrotik/firewall", tags=["mikrotik"])


class FirewallRuleParams(BaseModel):
    params: dict


@router.get("/filter")
async def list_filter(_: User = Depends(require_admin)):
    return await firewall_manager.list_filter_rules()


@router.post("/filter")
async def add_filter(body: FirewallRuleParams, _: User = Depends(require_admin)):
    await firewall_manager.add_filter_rule(**body.params)
    return {"message": "Rule added"}


@router.put("/filter/{rule_id}")
async def set_filter(rule_id: str, body: FirewallRuleParams, _: User = Depends(require_admin)):
    await firewall_manager.set_filter_rule(rule_id, **body.params)
    return {"message": "Rule updated"}


@router.delete("/filter/{rule_id}")
async def remove_filter(rule_id: str, _: User = Depends(require_admin)):
    await firewall_manager.remove_filter_rule(rule_id)
    return {"message": "Rule removed"}


@router.post("/filter/{rule_id}/toggle")
async def toggle_filter(rule_id: str, disabled: bool, _: User = Depends(require_admin)):
    await firewall_manager.toggle_filter_rule(rule_id, disabled)
    return {"message": "Rule toggled"}


@router.get("/nat")
async def list_nat(_: User = Depends(require_admin)):
    return await firewall_manager.list_nat_rules()


@router.post("/nat")
async def add_nat(body: FirewallRuleParams, _: User = Depends(require_admin)):
    await firewall_manager.add_nat_rule(**body.params)
    return {"message": "NAT rule added"}


@router.delete("/nat/{rule_id}")
async def remove_nat(rule_id: str, _: User = Depends(require_admin)):
    await firewall_manager.remove_nat_rule(rule_id)
    return {"message": "NAT rule removed"}
