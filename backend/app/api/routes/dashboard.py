from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.lead import Lead, LeadStatus
from app.models.proposal import Proposal, ProposalStatus
from app.models.activity import Activity, ActivityType
from app.schemas.dashboard import (
    KPIData, LeadOut, LeadCreate, ProposalOut, ProposalCreate, AgentTaskRequest
)
from app.services import ai_agent

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/kpis", response_model=KPIData)
async def get_kpis(db: AsyncSession = Depends(get_db)):
    active_leads = await db.scalar(
        select(func.count(Lead.id)).where(
            Lead.status.in_([LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED])
        )
    )
    posts = await db.scalar(
        select(func.count(Activity.id)).where(
            Activity.type == ActivityType.POST_PUBLISHED
        )
    )
    proposals_sent = await db.scalar(
        select(func.count(Proposal.id)).where(
            Proposal.status.in_([ProposalStatus.SENT, ProposalStatus.VIEWED, ProposalStatus.ACCEPTED])
        )
    )
    revenue = await db.scalar(
        select(func.coalesce(func.sum(Proposal.value), 0.0)).where(
            Proposal.status == ProposalStatus.ACCEPTED
        )
    )
    return KPIData(
        active_leads=active_leads or 0,
        posts_published=posts or 0,
        proposals_sent=proposals_sent or 0,
        sites_built=0,
        revenue=float(revenue or 0.0),
    )


@router.get("/leads", response_model=list[LeadOut])
async def get_leads(
    limit: int = 50, skip: int = 0, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Lead).order_by(Lead.created_at.desc()).offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.post("/leads", response_model=LeadOut)
async def create_lead(payload: LeadCreate, db: AsyncSession = Depends(get_db)):
    lead_dict = payload.model_dump()
    qualification = await ai_agent.qualify_lead(lead_dict)

    lead = Lead(
        **lead_dict,
        score=qualification.get("score", 50),
        ai_summary=qualification.get("summary"),
    )
    db.add(lead)

    from app.models.activity import Activity, ActivityStatus
    activity = Activity(
        type=ActivityType.LEAD_FOUND,
        status=ActivityStatus.SUCCESS,
        title=f"New lead: {lead.name}",
        description=qualification.get("summary", ""),
        module="leads",
    )
    db.add(activity)
    await db.commit()
    await db.refresh(lead)

    from app.api.websocket import broadcast
    await broadcast({
        "event": "activity",
        "data": {
            "type": ActivityType.LEAD_FOUND,
            "status": "success",
            "title": f"New lead: {lead.name}",
            "module": "leads",
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    })
    return lead


@router.get("/proposals", response_model=list[ProposalOut])
async def get_proposals(
    limit: int = 50, skip: int = 0, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Proposal).order_by(Proposal.created_at.desc()).offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.post("/proposals", response_model=ProposalOut)
async def create_proposal(payload: ProposalCreate, db: AsyncSession = Depends(get_db)):
    content = await ai_agent.generate_proposal(
        client_name=payload.client_name,
        services=payload.services or "Digital Marketing & Web Development",
    )
    proposal = Proposal(
        **payload.model_dump(),
        content=content,
        ai_generated=True,
    )
    db.add(proposal)

    from app.models.activity import Activity, ActivityStatus
    activity = Activity(
        type=ActivityType.PROPOSAL_SENT,
        status=ActivityStatus.SUCCESS,
        title=f"Proposal created: {payload.title}",
        description=f"AI-generated proposal for {payload.client_name}",
        module="proposals",
    )
    db.add(activity)
    await db.commit()
    await db.refresh(proposal)

    from app.api.websocket import broadcast
    await broadcast({
        "event": "activity",
        "data": {
            "type": ActivityType.PROPOSAL_SENT,
            "status": "success",
            "title": f"Proposal created: {payload.title}",
            "module": "proposals",
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    })
    return proposal


@router.post("/agent/task")
async def run_agent_task(payload: AgentTaskRequest):
    result = await ai_agent.run_agent_task(payload.task, payload.context)
    return {"result": result}
