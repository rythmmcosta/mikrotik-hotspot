from typing import Any

from app.mikrotik.client import get_pool


async def list_simple() -> list[dict[str, Any]]:
    return await get_pool().call("/queue/simple/print")


async def add_simple(name: str, target: str, max_limit: str, **extra) -> None:
    await get_pool().call("/queue/simple/add", **{
        "name": name, "target": target, "max-limit": max_limit, **extra
    })


async def set_simple(queue_id: str, **params) -> None:
    await get_pool().call("/queue/simple/set", **{".id": queue_id, **params})


async def remove_simple(queue_id: str) -> None:
    await get_pool().call("/queue/simple/remove", **{".id": queue_id})


async def list_tree() -> list[dict[str, Any]]:
    return await get_pool().call("/queue/tree/print")
