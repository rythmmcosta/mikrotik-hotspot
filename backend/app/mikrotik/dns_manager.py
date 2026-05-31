from typing import Any

from app.mikrotik.client import get_pool


async def list_static() -> list[dict[str, Any]]:
    return await get_pool().call("/ip/dns/static/print")


async def add_static(name: str, address: str) -> None:
    await get_pool().call("/ip/dns/static/add", **{"name": name, "address": address})


async def remove_static(entry_id: str) -> None:
    await get_pool().call("/ip/dns/static/remove", **{".id": entry_id})


async def get_dns_settings() -> dict[str, Any]:
    result = await get_pool().call("/ip/dns/print")
    return result[0] if result else {}


async def set_dns_servers(servers: str) -> None:
    await get_pool().call("/ip/dns/set", **{"servers": servers})
