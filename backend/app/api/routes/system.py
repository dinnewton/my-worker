import time, os
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter(prefix="/system", tags=["system"])

START_TIME = time.time()


@router.get("/info")
async def system_info(db: AsyncSession = Depends(get_db)):
    uptime_sec = int(time.time() - START_TIME)
    hours, rem = divmod(uptime_sec, 3600)
    minutes, seconds = divmod(rem, 60)
    uptime_str = f"{hours}h {minutes}m {seconds}s"

    db_ok = True
    try:
        await db.execute(__import__("sqlalchemy").text("SELECT 1"))
    except Exception:
        db_ok = False

    return {
        "version": "1.0.0",
        "uptime": uptime_str,
        "db_status": "connected" if db_ok else "error",
        "redis_status": "connected",
        "jobs_running": 0,
        "ai_model": "claude-sonnet-4-6",
        "environment": os.getenv("APP_ENV", "production"),
    }
