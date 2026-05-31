import hashlib
import secrets
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.asset import Asset
from app.db.models.asset_metric import AssetMetric
from app.mikrotik import asset_manager


async def list_assets(
    db: AsyncSession,
    status: str | None = None,
    employee_id: int | None = None,
    connection_type: str | None = None,
) -> list[dict]:
    q = select(Asset)
    if status:
        q = q.where(Asset.status == status)
    if employee_id:
        q = q.where(Asset.employee_id == employee_id)
    if connection_type:
        q = q.where(Asset.connection_type == connection_type)
    q = q.order_by(Asset.created_at.desc())
    result = await db.execute(q)
    return [_asset_to_dict(a) for a in result.scalars().all()]


async def get_asset(db: AsyncSession, asset_id: int) -> Asset | None:
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    return result.scalar_one_or_none()


async def create_asset(db: AsyncSession, data: dict, added_by: int) -> dict:
    asset = Asset(
        name=data["name"],
        asset_type=data.get("asset_type", "desktop"),
        mac_address=data["mac_address"].upper(),
        ip_address=data.get("ip_address"),
        connection_type=data.get("connection_type", "wifi"),
        employee_id=data.get("employee_id"),
        serial_number=data.get("serial_number"),
        os_type=data.get("os_type"),
        hostname=data.get("hostname"),
        notes=data.get("notes"),
        added_by=added_by,
        status="offline",
    )
    db.add(asset)
    await db.flush()

    try:
        if asset.connection_type == "wifi":
            await asset_manager.add_wifi_asset(asset.mac_address, asset.name)
        elif asset.connection_type == "lan" and asset.ip_address:
            await asset_manager.add_lan_asset(
                asset.mac_address, asset.ip_address, asset.hostname or asset.name
            )
        asset.status = "active"
    except Exception:
        pass

    await db.commit()
    await db.refresh(asset)
    return _asset_to_dict(asset)


async def update_asset(db: AsyncSession, asset_id: int, data: dict) -> dict | None:
    asset = await get_asset(db, asset_id)
    if not asset:
        return None
    for field in ("name", "employee_id", "notes", "os_type", "hostname", "serial_number"):
        if field in data:
            setattr(asset, field, data[field])
    await db.commit()
    await db.refresh(asset)
    return _asset_to_dict(asset)


async def delete_asset(db: AsyncSession, asset_id: int) -> bool:
    asset = await get_asset(db, asset_id)
    if not asset:
        return False
    try:
        if asset.connection_type == "wifi":
            await asset_manager.remove_wifi_asset(asset.mac_address)
        else:
            await asset_manager.remove_lan_asset(asset.mac_address)
    except Exception:
        pass
    await db.delete(asset)
    await db.commit()
    return True


async def block_asset(db: AsyncSession, asset_id: int) -> dict | None:
    asset = await get_asset(db, asset_id)
    if not asset:
        return None
    try:
        await asset_manager.block_asset(asset.mac_address)
    except Exception:
        pass
    asset.status = "blocked"
    await db.commit()
    return _asset_to_dict(asset)


async def unblock_asset(db: AsyncSession, asset_id: int) -> dict | None:
    asset = await get_asset(db, asset_id)
    if not asset:
        return None
    try:
        await asset_manager.unblock_asset(asset.mac_address)
    except Exception:
        pass
    asset.status = "active"
    await db.commit()
    return _asset_to_dict(asset)


async def generate_agent_token(db: AsyncSession, asset_id: int) -> dict | None:
    asset = await get_asset(db, asset_id)
    if not asset:
        return None
    token = secrets.token_urlsafe(32)
    asset.agent_token_hash = hashlib.sha256(token.encode()).hexdigest()
    asset.agent_installed = False
    await db.commit()
    return {"asset_id": asset_id, "token": token}


async def verify_agent_token(db: AsyncSession, asset_id: int, token: str) -> Asset | None:
    asset = await get_asset(db, asset_id)
    if not asset or not asset.agent_token_hash:
        return None
    expected = hashlib.sha256(token.encode()).hexdigest()
    if not secrets.compare_digest(asset.agent_token_hash, expected):
        return None
    return asset


async def get_asset_metrics(
    db: AsyncSession,
    asset_id: int,
    window: str = "1h",
) -> list[dict]:
    from datetime import timedelta
    windows = {"1h": 1, "6h": 6, "24h": 24, "7d": 168}
    hours = windows.get(window, 1)
    since = datetime.utcnow() - timedelta(hours=hours)

    result = await db.execute(
        select(AssetMetric)
        .where(AssetMetric.asset_id == asset_id, AssetMetric.collected_at >= since)
        .order_by(AssetMetric.collected_at.asc())
    )
    return [_metric_to_dict(m) for m in result.scalars().all()]


def _asset_to_dict(a: Asset) -> dict[str, Any]:
    return {
        "id": a.id,
        "name": a.name,
        "asset_type": a.asset_type,
        "mac_address": a.mac_address,
        "ip_address": a.ip_address,
        "connection_type": a.connection_type,
        "employee_id": a.employee_id,
        "serial_number": a.serial_number,
        "os_type": a.os_type,
        "hostname": a.hostname,
        "status": a.status,
        "agent_installed": a.agent_installed,
        "agent_version": a.agent_version,
        "agent_last_seen": a.agent_last_seen.isoformat() if a.agent_last_seen else None,
        "notes": a.notes,
        "added_by": a.added_by,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


def _metric_to_dict(m: AssetMetric) -> dict[str, Any]:
    return {
        "id": m.id,
        "asset_id": m.asset_id,
        "collected_at": m.collected_at.isoformat() if m.collected_at else None,
        "cpu_percent": m.cpu_percent,
        "cpu_per_core": m.cpu_per_core,
        "ram_total": m.ram_total,
        "ram_used": m.ram_used,
        "ram_percent": m.ram_percent,
        "disk_read_bytes": m.disk_read_bytes,
        "disk_write_bytes": m.disk_write_bytes,
        "net_bytes_sent": m.net_bytes_sent,
        "net_bytes_recv": m.net_bytes_recv,
        "net_packets_sent": m.net_packets_sent,
        "net_packets_recv": m.net_packets_recv,
        "active_connections": m.active_connections,
    }
