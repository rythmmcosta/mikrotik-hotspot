from typing import Any

from app.mikrotik.client import get_pool


async def list_servers() -> list[dict[str, Any]]:
    return await get_pool().call("/interface/pppoe-server/server/print")


async def list_active() -> list[dict[str, Any]]:
    return await get_pool().call("/ppp/active/print")


async def list_secrets() -> list[dict[str, Any]]:
    return await get_pool().call("/ppp/secret/print")


async def add_secret(name: str, password: str, profile: str = "default", service: str = "pppoe") -> None:
    await get_pool().call("/ppp/secret/add", **{
        "name": name, "password": password, "profile": profile, "service": service
    })


async def remove_secret(secret_id: str) -> None:
    await get_pool().call("/ppp/secret/remove", **{".id": secret_id})
