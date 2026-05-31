from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.websocket_manager import ws_manager
from app.db.models.asset import Asset
from app.db.models.asset_metric import AssetMetric
from app.db.models.browsing_log import BrowsingLog
from app.services.asset_service import verify_agent_token, _metric_to_dict


async def heartbeat(
    db: AsyncSession,
    asset_id: int,
    token: str,
    hostname: str | None,
    agent_version: str | None,
    os_type: str | None,
) -> dict:
    asset = await verify_agent_token(db, asset_id, token)
    if not asset:
        return {"authorized": False}

    asset.agent_last_seen = datetime.utcnow()
    asset.agent_installed = True
    if hostname:
        asset.hostname = hostname
    if agent_version:
        asset.agent_version = agent_version
    if os_type and asset.os_type is None:
        asset.os_type = os_type
    if asset.status == "offline":
        asset.status = "active"
    await db.commit()

    await ws_manager.broadcast(f"asset:{asset_id}", {
        "type": "heartbeat",
        "asset_id": asset_id,
        "status": "active",
        "agent_last_seen": asset.agent_last_seen.isoformat(),
    })

    return {"authorized": True, "asset_id": asset_id}


async def record_metrics(
    db: AsyncSession,
    asset_id: int,
    token: str,
    metrics_batch: list[dict],
) -> dict:
    asset = await verify_agent_token(db, asset_id, token)
    if not asset:
        return {"authorized": False}

    stored = []
    for m in metrics_batch:
        metric = AssetMetric(
            asset_id=asset_id,
            collected_at=datetime.fromisoformat(m["collected_at"]) if "collected_at" in m else datetime.utcnow(),
            cpu_percent=m.get("cpu_percent"),
            cpu_per_core=m.get("cpu_per_core"),
            ram_total=m.get("ram_total"),
            ram_used=m.get("ram_used"),
            ram_percent=m.get("ram_percent"),
            disk_read_bytes=m.get("disk_read_bytes"),
            disk_write_bytes=m.get("disk_write_bytes"),
            net_bytes_sent=m.get("net_bytes_sent"),
            net_bytes_recv=m.get("net_bytes_recv"),
            net_packets_sent=m.get("net_packets_sent"),
            net_packets_recv=m.get("net_packets_recv"),
            active_connections=m.get("active_connections"),
        )
        db.add(metric)
        stored.append(metric)

    asset.agent_last_seen = datetime.utcnow()
    await db.flush()
    await db.commit()

    if stored:
        latest = stored[-1]
        await db.refresh(latest)
        await ws_manager.broadcast(f"asset:{asset_id}", {
            "type": "metrics",
            "asset_id": asset_id,
            "data": _metric_to_dict(latest),
        })

    return {"authorized": True, "stored": len(stored)}


async def record_browsing(
    db: AsyncSession,
    asset_id: int,
    token: str,
    entries: list[dict],
) -> dict:
    asset = await verify_agent_token(db, asset_id, token)
    if not asset:
        return {"authorized": False}

    for entry in entries:
        domain = entry.get("domain", "").lower().rstrip(".")
        if not domain or len(domain) < 4:
            continue
        log = BrowsingLog(
            hotspot_username=None,
            user_type="asset",
            user_id=asset_id,
            domain=domain,
            query_type=entry.get("query_type", "A"),
            ip_address=entry.get("ip_address"),
            mac_address=asset.mac_address,
            queried_at=datetime.fromisoformat(entry["queried_at"]) if "queried_at" in entry else datetime.utcnow(),
        )
        db.add(log)

    await db.commit()
    return {"authorized": True, "stored": len(entries)}
