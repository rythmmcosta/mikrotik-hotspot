from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import require_admin
from app.db.models.user import User

router = APIRouter(prefix="/system/health", tags=["health"])


@router.get("")
async def system_health(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    import psutil

    services = {}

    # Database
    try:
        await db.execute(text("SELECT 1"))
        services["database"] = {"status": "ok", "message": "Connected"}
    except Exception as e:
        services["database"] = {"status": "error", "message": str(e)}

    # Redis
    try:
        from app.tasks.celery_app import celery
        celery.backend.client.ping()
        services["redis"] = {"status": "ok", "message": "Connected"}
    except Exception as e:
        services["redis"] = {"status": "error", "message": str(e)}

    # MikroTik — actually test with a live command
    try:
        from app.mikrotik.client import get_pool
        from app.mikrotik.exceptions import RouterOSConnectionError
        pool = get_pool()
        result = await pool.call("/system/identity/print")
        identity = result[0].get("name", "MikroTik") if result else "MikroTik"
        res_result = await pool.call("/system/resource/print")
        version = res_result[0].get("version", "") if res_result else ""
        cpu = res_result[0].get("cpu-load", "0") if res_result else "0"
        services["mikrotik"] = {
            "status": "ok",
            "message": f"Connected — {identity}",
            "details": {"identity": identity, "version": version, "cpu_load": f"{cpu}%"},
        }
    except RouterOSConnectionError:
        services["mikrotik"] = {"status": "warning", "message": "Not connected or not configured"}
    except Exception as e:
        services["mikrotik"] = {"status": "error", "message": str(e)}

    # System resources (this server, not router)
    cpu = psutil.cpu_percent(interval=0.1)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    return {
        "services": services,
        "system": {
            "cpu_percent": cpu,
            "ram_percent": ram.percent,
            "ram_total_mb": ram.total // 1024 // 1024,
            "ram_used_mb": ram.used // 1024 // 1024,
            "disk_percent": disk.percent,
            "disk_total_gb": disk.total // 1024 // 1024 // 1024,
            "disk_used_gb": disk.used // 1024 // 1024 // 1024,
        },
    }
