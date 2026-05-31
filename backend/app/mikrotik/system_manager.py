from typing import Any

from app.mikrotik.client import get_pool


async def get_resources() -> dict[str, Any]:
    result = await get_pool().call("/system/resource/print")
    return result[0] if result else {}


async def get_identity() -> str:
    result = await get_pool().call("/system/identity/print")
    return result[0].get("name", "") if result else ""


async def get_routerboard() -> dict[str, Any]:
    result = await get_pool().call("/system/routerboard/print")
    return result[0] if result else {}


async def get_logs(lines: int = 50) -> list[dict[str, Any]]:
    return await get_pool().call("/log/print")


async def list_ip_addresses() -> list[dict[str, Any]]:
    return await get_pool().call("/ip/address/print")


async def list_routes() -> list[dict[str, Any]]:
    return await get_pool().call("/ip/route/print")


async def get_clock() -> dict[str, Any]:
    result = await get_pool().call("/system/clock/print")
    return result[0] if result else {}
