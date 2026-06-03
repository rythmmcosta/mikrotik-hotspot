import logging
from datetime import datetime, timedelta

from app.tasks.celery_app import celery

logger = logging.getLogger(__name__)


@celery.task(name="app.tasks.cleanup_tasks.cleanup_old_logs")
def cleanup_old_logs():
    import asyncio

    async def _run():
        from app.db.session import get_session_factory
        from app.services.settings_service import get_value
        from sqlalchemy import text

        factory = get_session_factory()
        async with factory() as db:
            now = datetime.utcnow()

            async def purge(table: str, col: str, setting_key: str, default_days: int):
                days = int(await get_value(db, "system", setting_key) or default_days)
                cutoff = now - timedelta(days=days)
                await db.execute(text(f"DELETE FROM {table} WHERE {col} < :cutoff"), {"cutoff": cutoff})
                logger.info("Purged %s older than %d days", table, days)

            await purge("browsing_log", "queried_at", "browsing_log_retention_days", 30)
            await purge("audit_log", "created_at", "audit_log_retention_days", 365)
            await purge("otp_log", "created_at", "otp_log_retention_days", 7)
            await purge("asset_metrics", "collected_at", "asset_metrics_retention_days", 7)

            # Connection history: only purge disconnected ones
            conn_days = int(await get_value(db, "system", "connection_history_retention_days") or 90)
            conn_cutoff = now - timedelta(days=conn_days)
            await db.execute(text(
                "DELETE FROM connections WHERE is_active = 0 AND connected_at < :cutoff"
            ), {"cutoff": conn_cutoff})
            logger.info("Purged connection history older than %d days", conn_days)

            await db.commit()

    asyncio.run(_run())
