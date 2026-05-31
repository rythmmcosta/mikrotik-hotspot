import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.core.websocket_manager import ws_manager
from app.dependencies import get_current_user_ws

logger = logging.getLogger(__name__)

router = APIRouter(tags=["realtime"])

VALID_ROOMS = {"metrics", "connections", "queue"}


@router.websocket("/ws/{room}")
async def websocket_endpoint(websocket: WebSocket, room: str, token: str = ""):
    # Validate room name (allow "asset:{id}" pattern too)
    if room not in VALID_ROOMS and not room.startswith("asset:"):
        await websocket.close(code=4004)
        return

    # Authenticate via token query param
    user = await get_current_user_ws(token)
    if not user:
        await websocket.close(code=4001)
        return

    await ws_manager.connect(websocket, room)
    try:
        while True:
            await websocket.receive_text()  # keep connection alive; ignore client messages
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket, room)
    except Exception:
        await ws_manager.disconnect(websocket, room)
