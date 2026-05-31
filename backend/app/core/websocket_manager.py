import asyncio
import json
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket, room: str) -> None:
        await ws.accept()
        async with self._lock:
            self._rooms[room].add(ws)

    async def disconnect(self, ws: WebSocket, room: str) -> None:
        async with self._lock:
            self._rooms[room].discard(ws)

    async def broadcast(self, room: str, data: dict) -> None:
        payload = json.dumps(data)
        dead: list[WebSocket] = []
        for ws in list(self._rooms.get(room, [])):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._rooms[room].discard(ws)

    async def broadcast_many(self, rooms: list[str], data: dict) -> None:
        for room in rooms:
            await self.broadcast(room, data)


ws_manager = ConnectionManager()
