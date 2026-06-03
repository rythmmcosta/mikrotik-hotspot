import time

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

    # MikroTik
    try:
        from app.mikrotik.client import get_pool
        pool = get_pool()
        services["mikrotik"] = {"status": "ok", "message": "Pool initialized"}
    except Exception as e:
        services["mikrotik"] = {"status": "warning", "message": "Not connected or not configured"}

    # System resources
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
