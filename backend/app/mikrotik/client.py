"""
MikroTik RouterOS API connection pool.

librouteros is synchronous; we run each call in a thread pool executor
to avoid blocking FastAPI's async event loop. A semaphore limits pool
concurrency to avoid overwhelming the router's API listener.
"""

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import Any

import librouteros
from librouteros.exceptions import ConnectionClosed, FatalError

from app.mikrotik.exceptions import RouterOSCommandError, RouterOSConnectionError

logger = logging.getLogger(__name__)

_pool: "MikroTikPool | None" = None


class _Conn:
    def __init__(self, api: librouteros.Api):
        self.api = api
        self.last_used = time.monotonic()
        self.is_healthy = True


class MikroTikPool:
    def __init__(self, host: str, port: int, username: str, password: str, ssl: bool = False, size: int = 3):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.ssl = ssl
        self._pool: list[_Conn] = []
        self._sem = asyncio.Semaphore(size)
        self._lock = asyncio.Lock()

    def _connect(self) -> librouteros.Api:
        extra = {"ssl_wrapper": __import__("ssl").create_default_context} if self.ssl else {}
        try:
            return librouteros.connect(
                host=self.host,
                username=self.username,
                password=self.password,
                port=self.port,
                **extra,
            )
        except Exception as exc:
            raise RouterOSConnectionError(f"Cannot connect to MikroTik at {self.host}:{self.port}: {exc}") from exc

    async def _get_conn(self) -> _Conn:
        async with self._lock:
            for c in self._pool:
                if c.is_healthy:
                    c.last_used = time.monotonic()
                    return c
            loop = asyncio.get_event_loop()
            api = await loop.run_in_executor(None, self._connect)
            conn = _Conn(api)
            self._pool.append(conn)
            return conn

    @asynccontextmanager
    async def connection(self):
        async with self._sem:
            conn = await self._get_conn()
            try:
                yield conn.api
            except (ConnectionClosed, FatalError) as exc:
                conn.is_healthy = False
                async with self._lock:
                    self._pool = [c for c in self._pool if c is not conn]
                raise RouterOSConnectionError(f"RouterOS connection lost: {exc}") from exc

    async def call(self, path: str, **params) -> list[dict[str, Any]]:
        loop = asyncio.get_event_loop()
        async with self.connection() as api:
            def _do():
                try:
                    cmd = api(path)
                    return list(cmd(**params) if params else cmd())
                except librouteros.exceptions.TrapError as exc:
                    raise RouterOSCommandError(str(exc), getattr(exc, "category", ""), getattr(exc, "detail", "")) from exc
            return await loop.run_in_executor(None, _do)

    async def close(self):
        async with self._lock:
            for c in self._pool:
                try:
                    c.api.close()
                except Exception:
                    pass
            self._pool.clear()


def init_pool(host: str, port: int, username: str, password: str, ssl: bool = False) -> MikroTikPool:
    global _pool
    _pool = MikroTikPool(host, port, username, password, ssl)
    return _pool


def get_pool() -> MikroTikPool:
    if _pool is None:
        raise RouterOSConnectionError("MikroTik pool not initialized — configure router settings first")
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
