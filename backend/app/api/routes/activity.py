from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.activity import Activity
from app.schemas.activity import ActivityOut
from app.api.websocket import manager

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("/feed", response_model=list[ActivityOut])
async def get_activity_feed(
    limit: int = 50, skip: int = 0, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Activity).order_by(Activity.created_at.desc()).offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            data = await ws.receive_text()
            await manager.send(ws, {"event": "pong", "data": data})
    except WebSocketDisconnect:
        manager.disconnect(ws)
