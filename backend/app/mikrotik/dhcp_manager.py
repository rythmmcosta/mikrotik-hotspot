from typing import Any

from app.mikrotik.client import get_pool


async def list_servers() -> list[dict[str, Any]]:
    return await get_pool().call("/ip/dhcp-server/print")


async def list_leases() -> list[dict[str, Any]]:
    return await get_pool().call("/ip/dhcp-server/lease/print")


async def make_static(lease_id: str) -> None:
    await get_pool().call("/ip/dhcp-server/lease/make-static", **{".id": lease_id})


async def remove_lease(lease_id: str) -> None:
    await get_pool().call("/ip/dhcp-server/lease/remove", **{".id": lease_id})


async def list_pools() -> list[dict[str, Any]]:
    return await get_pool().call("/ip/pool/print")
