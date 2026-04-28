import json
import logging
from typing import Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)
        logger.info(f"WS connected. Total: {len(self.active)}")

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)
        logger.info(f"WS disconnected. Total: {len(self.active)}")

    async def send(self, ws: WebSocket, data: dict[str, Any]) -> None:
        try:
            await ws.send_text(json.dumps(data, default=str))
        except Exception as e:
            logger.warning(f"WS send error: {e}")
            self.disconnect(ws)

    async def broadcast(self, data: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in self.active:
            try:
                await ws.send_text(json.dumps(data, default=str))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


async def broadcast(data: dict[str, Any]) -> None:
    await manager.broadcast(data)
