"""Module 7 — Agent Brain API
REST endpoints for monitoring agent runs and manually triggering tasks.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.agent import AgentRun, AgentAction, AgentRunType, AgentRunStatus, AgentTrigger
from app.services.scheduler import scheduler

router = APIRouter(prefix="/agent", tags=["agent"])
logger = logging.getLogger(__name__)


# ─── Response schemas ─────────────────────────────────────────────────────────

class AgentActionOut(BaseModel):
    id:          int
    tool_name:   str
    tool_input:  str | None
    tool_output: str | None
    status:      str
    error:       str | None
    duration_ms: int | None
    created_at:  datetime

    model_config = {"from_attributes": True}


class AgentRunOut(BaseModel):
    id:                int
    run_type:          str
    status:            str
    trigger:           str
    actions_taken:     int
    actions_succeeded: int
    actions_failed:    int
    summary:           str | None
    error_message:     str | None
    started_at:        datetime
    completed_at:      datetime | None
    duration_seconds:  float | None
    actions:           list[AgentActionOut] = []

    model_config = {"from_attributes": True}


class TriggerRequest(BaseModel):
    task_type: str   # value from AgentRunType


class AgentStatusOut(BaseModel):
    enabled:    bool
    jobs:       list[dict]
    last_runs:  list[dict]


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/runs", response_model=list[AgentRunOut])
async def list_runs(
    limit: int = 50,
    run_type: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(AgentRun).options(selectinload(AgentRun.actions)).order_by(desc(AgentRun.started_at))
    if run_type:
        q = q.where(AgentRun.run_type == run_type)
    q = q.limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/runs/{run_id}", response_model=AgentRunOut)
async def get_run(run_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentRun)
        .options(selectinload(AgentRun.actions))
        .where(AgentRun.id == run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(404, "Run not found")
    return run


@router.post("/trigger", status_code=202)
async def trigger_task(req: TriggerRequest, background: BackgroundTasks):
    """Manually trigger a specific agent task."""
    valid = {t.value for t in AgentRunType}
    if req.task_type not in valid:
        raise HTTPException(400, f"Unknown task_type. Valid: {sorted(valid)}")

    from app.services.agent_brain import (
        run_whatsapp_check, run_email_leads, run_followup_leads,
        run_auto_proposals, run_website_queue, run_daily_summary,
        run_full_agent_loop,
    )

    job_map = {
        AgentRunType.WHATSAPP_CHECK: lambda: run_whatsapp_check(AgentTrigger.MANUAL),
        AgentRunType.EMAIL_LEADS:    lambda: run_email_leads(AgentTrigger.MANUAL),
        AgentRunType.FOLLOWUP_LEADS: lambda: run_followup_leads(AgentTrigger.MANUAL),
        AgentRunType.AUTO_PROPOSALS: lambda: run_auto_proposals(AgentTrigger.MANUAL),
        AgentRunType.WEBSITE_QUEUE:  lambda: run_website_queue(AgentTrigger.MANUAL),
        AgentRunType.DAILY_SUMMARY:  lambda: run_daily_summary(AgentTrigger.MANUAL),
        AgentRunType.FULL_LOOP:      run_full_agent_loop,
    }

    fn = job_map[AgentRunType(req.task_type)]
    background.add_task(fn)
    return {"queued": True, "task_type": req.task_type}


@router.get("/status", response_model=AgentStatusOut)
async def get_status(db: AsyncSession = Depends(get_db)):
    from app.core.config import settings

    # Scheduler job next-run info
    jobs_info = []
    for job in scheduler.get_jobs():
        jobs_info.append({
            "id": job.id,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
        })

    # Last run per type
    last_runs = []
    for run_type in AgentRunType:
        result = await db.execute(
            select(AgentRun)
            .where(AgentRun.run_type == run_type)
            .order_by(desc(AgentRun.started_at))
            .limit(1)
        )
        run = result.scalar_one_or_none()
        if run:
            last_runs.append({
                "run_type": run.run_type,
                "status": run.status,
                "started_at": run.started_at.isoformat(),
                "actions_taken": run.actions_taken,
                "duration_seconds": run.duration_seconds,
            })

    return AgentStatusOut(
        enabled=settings.AGENT_ENABLED,
        jobs=jobs_info,
        last_runs=last_runs,
    )


@router.delete("/runs/{run_id}", status_code=204)
async def delete_run(run_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentRun).where(AgentRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(404, "Run not found")
    await db.delete(run)
    await db.commit()
