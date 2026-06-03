import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.config import get_settings
from app.core.middleware import RequestIDMiddleware
from app.db.session import get_engine
from app.mikrotik import client as mt_client

_syslog_task: asyncio.Task | None = None
_metrics_task: asyncio.Task | None = None


async def _metrics_loop() -> None:
    """Poll MikroTik every 5 s → broadcast router metrics to the 'metrics' WS room."""
    from app.mikrotik.exceptions import RouterOSConnectionError
    from app.core.websocket_manager import ws_manager

    prev_tx: int | None = None
    prev_rx: int | None = None
    prev_ts: float | None = None

    while True:
        await asyncio.sleep(5)
        try:
            pool = mt_client.get_pool()
        except RouterOSConnectionError:
            prev_tx = prev_rx = prev_ts = None
            continue

        try:
            resources = await pool.call("/system/resource/print")
            if not resources:
                continue
            r = resources[0]
            cpu = float(r.get("cpu-load", 0))
            total_mem = int(r.get("total-memory", 1))
            free_mem = int(r.get("free-memory", 0))
            ram_pct = round((total_mem - free_mem) / max(total_mem, 1) * 100, 1)

            # TX/RX bytes-per-second from interface counter deltas
            tx_bps: float | None = None
            rx_bps: float | None = None
            now = asyncio.get_event_loop().time()
            try:
                ifaces = await pool.call("/interface/print")
                cur_tx = sum(int(i.get("tx-byte", 0)) for i in ifaces if i.get("tx-byte"))
                cur_rx = sum(int(i.get("rx-byte", 0)) for i in ifaces if i.get("rx-byte"))
                if prev_tx is not None and prev_ts is not None:
                    elapsed = now - prev_ts
                    if elapsed > 0:
                        tx_bps = max(0.0, (cur_tx - prev_tx) / elapsed)
                        rx_bps = max(0.0, (cur_rx - prev_rx) / elapsed)
                prev_tx, prev_rx, prev_ts = cur_tx, cur_rx, now
            except Exception:
                prev_tx = prev_rx = prev_ts = None

            payload: dict = {"type": "metrics", "cpu_percent": cpu, "ram_percent": ram_pct}
            if tx_bps is not None:
                payload["tx_bps"] = tx_bps
                payload["rx_bps"] = rx_bps

            await ws_manager.broadcast("metrics", payload)
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _syslog_task, _metrics_task
    # Ensure DB tables exist (dev convenience; production uses Alembic)
    settings = get_settings()
    if settings.environment == "development":
        from app.db.base import Base
        from app.db import models  # noqa: F401 — import all models to register them
        from sqlalchemy.ext.asyncio import AsyncEngine
        engine: AsyncEngine = get_engine()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    # Initialize MikroTik connection pool from DB settings (if configured)
    from app.db.session import get_session_factory
    from app.services.settings_service import get_value
    factory = get_session_factory()
    async with factory() as db:
        host = await get_value(db, "mikrotik", "host")
        if host:
            port = int(await get_value(db, "mikrotik", "port") or 8728)
            username = await get_value(db, "mikrotik", "username") or "admin"
            password = await get_value(db, "mikrotik", "password") or ""
            use_ssl = (await get_value(db, "mikrotik", "use_ssl") or "false").lower() == "true"
            mt_client.init_pool(host, port, username, password, use_ssl)

    # Start syslog listener for DNS browsing capture
    from app.core.syslog_listener import start_syslog_listener
    syslog_port = getattr(settings, "syslog_port", 514)
    _syslog_task = asyncio.create_task(start_syslog_listener(syslog_port))

    # Start router metrics broadcaster (CPU/RAM/TX/RX → WS 'metrics' room)
    _metrics_task = asyncio.create_task(_metrics_loop())

    yield

    for task in (_syslog_task, _metrics_task):
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    await mt_client.close_pool()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="MikroTik Hotspot Manager",
        description="Full-featured hotspot management with MikroTik RouterOS integration",
        version="1.0.0",
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url="/redoc" if settings.environment != "production" else None,
        lifespan=lifespan,
    )

    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
