"""MikroTik operations for office asset provisioning."""
import logging

from app.mikrotik.client import _pool
from app.mikrotik.dhcp_manager import add_static_lease, remove_static_lease
from app.mikrotik.exceptions import MikroTikError

logger = logging.getLogger(__name__)


def _get_pool():
    from app.mikrotik.client import _pool as p
    if p is None:
        raise MikroTikError("MikroTik not connected")
    return p


async def add_wifi_asset(mac: str, name: str, profile: str = "default") -> None:
    """Bind MAC address in hotspot — device auto-authenticates without portal."""
    pool = _get_pool()
    normalized = mac.upper()
    existing = await pool.call("/ip/hotspot/user/print", **{"?mac-address": normalized})
    if not existing:
        await pool.call("/ip/hotspot/user/add", **{
            "name": f"asset-{normalized.replace(':', '')}",
            "mac-address": normalized,
            "profile": profile,
            "comment": f"Asset: {name}",
        })


async def remove_wifi_asset(mac: str) -> None:
    try:
        pool = _get_pool()
    except MikroTikError:
        return
    normalized = mac.upper()
    rows = await pool.call("/ip/hotspot/user/print", **{"?mac-address": normalized})
    for row in rows:
        try:
            await pool.call("/ip/hotspot/user/remove", **{".id": row[".id"]})
        except Exception as e:
            logger.warning("Failed to remove hotspot user: %s", e)


async def add_lan_asset(mac: str, ip: str, hostname: str) -> None:
    """Add a static DHCP lease for a LAN-connected asset."""
    _get_pool()
    await add_static_lease(mac, ip, hostname)


async def remove_lan_asset(mac: str) -> None:
    try:
        _get_pool()
    except MikroTikError:
        return
    await remove_static_lease(mac)


async def block_asset(mac: str) -> None:
    """Add MAC to address list and disable hotspot user."""
    pool = _get_pool()
    normalized = mac.upper()
    await pool.call("/ip/firewall/address-list/add", **{
        "list": "blocked-macs",
        "address": normalized,
        "comment": "Asset blocked",
    })
    rows = await pool.call("/ip/hotspot/user/print", **{"?mac-address": normalized})
    for row in rows:
        await pool.call("/ip/hotspot/user/set", **{".id": row[".id"], "disabled": "yes"})


async def unblock_asset(mac: str) -> None:
    pool = _get_pool()
    normalized = mac.upper()
    rows = await pool.call("/ip/firewall/address-list/print", **{
        "?list": "blocked-macs", "?address": normalized
    })
    for row in rows:
        try:
            await pool.call("/ip/firewall/address-list/remove", **{".id": row[".id"]})
        except Exception:
            pass
    rows = await pool.call("/ip/hotspot/user/print", **{"?mac-address": normalized})
    for row in rows:
        await pool.call("/ip/hotspot/user/set", **{".id": row[".id"], "disabled": "no"})
