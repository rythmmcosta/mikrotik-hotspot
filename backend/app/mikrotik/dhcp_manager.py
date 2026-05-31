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


async def add_static_lease(mac: str, ip: str, hostname: str) -> None:
    await get_pool().call("/ip/dhcp-server/lease/add", **{
        "mac-address": mac.upper(),
        "address": ip,
        "host-name": hostname,
        "comment": f"Asset: {hostname}",
    })


async def remove_static_lease(mac: str) -> None:
    pool = get_pool()
    leases = await pool.call("/ip/dhcp-server/lease/print")
    normalized = mac.upper()
    for lease in leases:
        if lease.get("mac-address", "").upper() == normalized:
            await pool.call("/ip/dhcp-server/lease/remove", **{".id": lease[".id"]})
