from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()

celery = Celery(
    "hotspot",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.tasks.otp_tasks",
        "app.tasks.connection_tasks",
        "app.tasks.sync_tasks",
        "app.tasks.cleanup_tasks",
    ],
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_expires=3600,
    timezone="UTC",
    beat_schedule={
        "cleanup-expired-otps": {
            "task": "app.tasks.otp_tasks.cleanup_expired_otps",
            "schedule": crontab(minute="*/15"),
        },
        "sync-active-sessions": {
            "task": "app.tasks.connection_tasks.sync_active_sessions",
            "schedule": 30.0,
        },
        "expire-guest-sessions": {
            "task": "app.tasks.connection_tasks.expire_guest_sessions",
            "schedule": crontab(minute="*/5"),
        },
        "sync-hotspot-users": {
            "task": "app.tasks.sync_tasks.sync_hotspot_users",
            "schedule": crontab(minute="*/30"),
        },
        "cleanup-old-logs": {
            "task": "app.tasks.cleanup_tasks.cleanup_old_logs",
            "schedule": crontab(hour=3, minute=0),
        },
    },
)
