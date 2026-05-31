import asyncio

from app.tasks.celery_app import celery


@celery.task
def sync_hotspot_users():
    """Reconcile DB employees vs MikroTik hotspot users."""
    async def _run():
        from app.db.session import get_session_factory
        from app.db.models.employee import Employee
        from app.mikrotik import hotspot_manager
        from app.mikrotik.exceptions import RouterOSConnectionError
        from app.core.security import decrypt_value
        from sqlalchemy import select

        factory = get_session_factory()
        async with factory() as db:
            try:
                router_users = {u["name"] for u in await hotspot_manager.list_users()}
                result = await db.execute(
                    select(Employee).where(Employee.status == "active")
                )
                employees = result.scalars().all()
                for emp in employees:
                    if emp.hotspot_username not in router_users:
                        try:
                            await hotspot_manager.add_user(
                                username=emp.hotspot_username,
                                password=decrypt_value(emp.hotspot_password),
                                profile="default",
                                comment=f"db_id:{emp.id}",
                            )
                            emp.mikrotik_synced = True
                        except RouterOSConnectionError:
                            emp.mikrotik_synced = False
                await db.commit()
            except RouterOSConnectionError:
                pass
    asyncio.run(_run())
