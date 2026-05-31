from typing import Any

from app.mikrotik.client import get_pool


async def list_filter_rules() -> list[dict[str, Any]]:
    return await get_pool().call("/ip/firewall/filter/print")


async def add_filter_rule(**params) -> None:
    await get_pool().call("/ip/firewall/filter/add", **params)


async def set_filter_rule(rule_id: str, **params) -> None:
    await get_pool().call("/ip/firewall/filter/set", **{".id": rule_id, **params})


async def remove_filter_rule(rule_id: str) -> None:
    await get_pool().call("/ip/firewall/filter/remove", **{".id": rule_id})


async def toggle_filter_rule(rule_id: str, disabled: bool) -> None:
    await get_pool().call("/ip/firewall/filter/set", **{
        ".id": rule_id, "disabled": "yes" if disabled else "no"
    })


async def list_nat_rules() -> list[dict[str, Any]]:
    return await get_pool().call("/ip/firewall/nat/print")


async def add_nat_rule(**params) -> None:
    await get_pool().call("/ip/firewall/nat/add", **params)


async def remove_nat_rule(rule_id: str) -> None:
    await get_pool().call("/ip/firewall/nat/remove", **{".id": rule_id})


async def list_address_lists() -> list[dict[str, Any]]:
    return await get_pool().call("/ip/firewall/address-list/print")
