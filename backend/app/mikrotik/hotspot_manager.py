from typing import Any

from app.mikrotik.client import get_pool
from app.mikrotik.exceptions import RouterOSCommandError


async def add_user(username: str, password: str, profile: str = "default", comment: str = "") -> None:
    pool = get_pool()
    await pool.call(
        "/ip/hotspot/user/add",
        **{"name": username, "password": password, "profile": profile, "comment": comment},
    )


async def remove_user(username: str) -> None:
    pool = get_pool()
    users = await pool.call("/ip/hotspot/user/print", **{"?name": username})
    for u in users:
        await pool.call("/ip/hotspot/user/remove", **{".id": u[".id"]})


async def disable_user(username: str) -> None:
    pool = get_pool()
    users = await pool.call("/ip/hotspot/user/print", **{"?name": username})
    for u in users:
        await pool.call("/ip/hotspot/user/set", **{".id": u[".id"], "disabled": "yes"})


async def enable_user(username: str) -> None:
    pool = get_pool()
    users = await pool.call("/ip/hotspot/user/print", **{"?name": username})
    for u in users:
        await pool.call("/ip/hotspot/user/set", **{".id": u[".id"], "disabled": "no"})


async def list_users() -> list[dict[str, Any]]:
    pool = get_pool()
    return await pool.call("/ip/hotspot/user/print")


async def list_active_sessions() -> list[dict[str, Any]]:
    pool = get_pool()
    return await pool.call("/ip/hotspot/active/print")


async def terminate_session(session_id: str) -> None:
    pool = get_pool()
    await pool.call("/ip/hotspot/active/remove", **{".id": session_id})


async def list_profiles() -> list[dict[str, Any]]:
    pool = get_pool()
    return await pool.call("/ip/hotspot/user/profile/print")


async def add_profile(name: str, rate_limit: str, shared_users: int = 1) -> None:
    pool = get_pool()
    await pool.call(
        "/ip/hotspot/user/profile/add",
        **{"name": name, "rate-limit": rate_limit, "shared-users": str(shared_users)},
    )


async def remove_profile(name: str) -> None:
    pool = get_pool()
    profiles = await pool.call("/ip/hotspot/user/profile/print", **{"?name": name})
    for p in profiles:
        await pool.call("/ip/hotspot/user/profile/remove", **{".id": p[".id"]})
