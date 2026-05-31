from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.config import get_settings
from app.core.middleware import RequestIDMiddleware
from app.db.session import get_engine
from app.mikrotik import client as mt_client


@asynccontextmanager
async def lifespan(app: FastAPI):
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

    yield

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
