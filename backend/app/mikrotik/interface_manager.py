from typing import Any

from app.mikrotik.client import get_pool


async def list_interfaces() -> list[dict[str, Any]]:
    pool = get_pool()
    return await pool.call("/interface/print")


async def get_interface(name: str) -> dict[str, Any] | None:
    pool = get_pool()
    result = await pool.call("/interface/print", **{"?name": name})
    return result[0] if result else None


async def set_interface(iface_id: str, **params) -> None:
    pool = get_pool()
    await pool.call("/interface/set", **{".id": iface_id, **params})


async def enable_interface(name: str) -> None:
    pool = get_pool()
    iface = await get_interface(name)
    if iface:
        await pool.call("/interface/enable", **{".id": iface[".id"]})


async def disable_interface(name: str) -> None:
    pool = get_pool()
    iface = await get_interface(name)
    if iface:
        await pool.call("/interface/disable", **{".id": iface[".id"]})


async def get_traffic(interface: str) -> dict[str, Any]:
    pool = get_pool()
    result = await pool.call("/interface/monitor-traffic", **{"interface": interface, "once": ""})
    return result[0] if result else {}
