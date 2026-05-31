import asyncio
from datetime import datetime, timezone

from app.tasks.celery_app import celery


@celery.task
def cleanup_expired_otps():
    async def _run():
        from app.db.session import get_session_factory
        from app.db.models.otp_log import OtpLog
        from sqlalchemy import update
        factory = get_session_factory()
        async with factory() as db:
            now = datetime.now(timezone.utc)
            await db.execute(
                update(OtpLog)
                .where(OtpLog.expires_at < now, OtpLog.is_expired == False)
                .values(is_expired=True)
            )
            await db.commit()
    asyncio.run(_run())
