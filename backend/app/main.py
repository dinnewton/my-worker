from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import create_tables
from app.core.redis_client import close_redis
import app.models  # noqa: F401 — registers all ORM models with Base.metadata before create_tables()
from app.api.routes import dashboard, activity, content, leads, proposals, websites, email_campaigns, seo, campaigns, system, whatsapp, invoices, agent
from app.api.routes import settings as settings_router
from app.services.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME}...")
    await create_tables()
    start_scheduler()
    logger.info("Database tables created. Scheduler running.")
    yield
    stop_scheduler()
    await close_redis()
    logger.info("Shutdown complete.")


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered Digital Marketing & Web Development Agency",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(activity.router, prefix="/api/v1")
app.include_router(content.router, prefix="/api/v1")
app.include_router(leads.router, prefix="/api/v1")
app.include_router(proposals.router, prefix="/api/v1")
app.include_router(websites.router, prefix="/api/v1")
app.include_router(email_campaigns.router, prefix="/api/v1")
app.include_router(seo.router, prefix="/api/v1")
app.include_router(campaigns.router, prefix="/api/v1")
app.include_router(system.router, prefix="/api/v1")
app.include_router(whatsapp.router, prefix="/api/v1")
app.include_router(invoices.router, prefix="/api/v1")
app.include_router(agent.router, prefix="/api/v1")
app.include_router(settings_router.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}
