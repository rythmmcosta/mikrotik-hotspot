"""MikroTik firewall operations for usage policies."""
import logging

from app.mikrotik.exceptions import MikroTikError

logger = logging.getLogger(__name__)


def _get_pool():
    from app.mikrotik.client import _pool as p
    if p is None:
        raise MikroTikError("MikroTik not connected")
    return p


async def sync_policy(policy_name: str, address_list: str, domains: list[str]) -> None:
    """Push domain-based block rules to MikroTik as address-list + firewall filter."""
    pool = _get_pool()

    # Remove old entries for this address list
    existing = await pool.call("/ip/firewall/address-list/print", **{"?list": address_list})
    for entry in existing:
        try:
            await pool.call("/ip/firewall/address-list/remove", **{".id": entry[".id"]})
        except Exception:
            pass

    # Add domain entries (MikroTik resolves them via DNS)
    for domain in domains:
        try:
            await pool.call("/ip/firewall/address-list/add", **{
                "list": address_list,
                "address": domain,
                "comment": f"Policy: {policy_name}",
            })
        except Exception as e:
            logger.warning("Failed to add %s to address list: %s", domain, e)

    # Ensure a DROP rule exists for this address list
    existing_rules = await pool.call("/ip/firewall/filter/print", **{
        "?comment": f"policy:{policy_name}"
    })
    if not existing_rules:
        await pool.call("/ip/firewall/filter/add", **{
            "chain": "forward",
            "dst-address-list": address_list,
            "action": "drop",
            "comment": f"policy:{policy_name}",
        })


async def remove_policy(policy_name: str, address_list: str) -> None:
    """Remove address-list entries and firewall rules for a policy."""
    pool = _get_pool()

    existing = await pool.call("/ip/firewall/address-list/print", **{"?list": address_list})
    for entry in existing:
        try:
            await pool.call("/ip/firewall/address-list/remove", **{".id": entry[".id"]})
        except Exception:
            pass

    rules = await pool.call("/ip/firewall/filter/print", **{
        "?comment": f"policy:{policy_name}"
    })
    for rule in rules:
        try:
            await pool.call("/ip/firewall/filter/remove", **{".id": rule[".id"]})
        except Exception:
            pass
