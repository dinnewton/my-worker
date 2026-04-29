import json, logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.campaign import MarketingCampaign, MarketingCampaignStatus, CampaignChannel
from app.services.ai_agent import get_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/campaigns", tags=["campaigns"])

SYSTEM = """You are an expert digital marketing strategist. Create data-driven campaign strategies.
Always respond with valid JSON only."""


class CampaignOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int; name: str; description: str | None; status: MarketingCampaignStatus
    channels: str | None; target_audience: str | None; goals: str | None
    budget: float; spent: float; revenue: float; roi: float
    metrics: str | None; ai_strategy: str | None
    start_date: datetime | None; end_date: datetime | None; created_at: datetime

class CampaignCreate(BaseModel):
    name: str; description: str | None = None
    channels: list[CampaignChannel] = []
    target_audience: str | None = None; goals: list[str] = []
    budget: float = 0.0
    start_date: datetime | None = None; end_date: datetime | None = None

class CampaignUpdate(BaseModel):
    name: str | None = None; description: str | None = None
    status: MarketingCampaignStatus | None = None
    spent: float | None = None; revenue: float | None = None
    metrics: str | None = None

class AIStrategyRequest(BaseModel):
    business_name: str; industry: str; goal: str
    budget: float; channels: list[CampaignChannel]
    target_audience: str; duration_weeks: int = 4


@router.get("/stats")
async def stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MarketingCampaign))
    camps = result.scalars().all()
    active = [c for c in camps if c.status == MarketingCampaignStatus.ACTIVE]
    total_revenue = sum(c.revenue for c in camps)
    total_spent   = sum(c.spent for c in camps)
    avg_roi = round((total_revenue - total_spent) / total_spent * 100 if total_spent else 0, 1)
    return {
        "total": len(camps), "active": len(active),
        "total_budget": sum(c.budget for c in camps),
        "total_spent": total_spent, "total_revenue": total_revenue, "avg_roi": avg_roi,
    }

@router.get("", response_model=list[CampaignOut])
async def list_campaigns(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MarketingCampaign).order_by(desc(MarketingCampaign.created_at)))
    return result.scalars().all()

@router.post("", response_model=CampaignOut, status_code=201)
async def create_campaign(payload: CampaignCreate, db: AsyncSession = Depends(get_db)):
    data = payload.model_dump(exclude_none=True)
    data["channels"] = json.dumps([c.value for c in data.get("channels", [])])
    data["goals"]    = json.dumps(data.get("goals", []))
    c = MarketingCampaign(**data)
    db.add(c); await db.commit(); await db.refresh(c); return c

@router.get("/{cid}", response_model=CampaignOut)
async def get_campaign(cid: int, db: AsyncSession = Depends(get_db)):
    c = await db.get(MarketingCampaign, cid)
    if not c: raise HTTPException(404, "Not found")
    return c

@router.patch("/{cid}", response_model=CampaignOut)
async def update_campaign(cid: int, payload: CampaignUpdate, db: AsyncSession = Depends(get_db)):
    c = await db.get(MarketingCampaign, cid)
    if not c: raise HTTPException(404, "Not found")
    for k, v in payload.model_dump(exclude_none=True).items(): setattr(c, k, v)
    if c.spent > 0: c.roi = round((c.revenue - c.spent) / c.spent * 100, 1)
    await db.commit(); await db.refresh(c); return c

@router.delete("/{cid}", status_code=204)
async def delete_campaign(cid: int, db: AsyncSession = Depends(get_db)):
    c = await db.get(MarketingCampaign, cid)
    if not c: raise HTTPException(404, "Not found")
    await db.delete(c); await db.commit()

@router.post("/ai/strategy", response_model=CampaignOut, status_code=201)
async def ai_strategy(req: AIStrategyRequest, db: AsyncSession = Depends(get_db)):
    client = get_client()
    prompt = f"""Create a complete marketing campaign strategy:

Business: {req.business_name} ({req.industry})
Goal: {req.goal}
Budget: ${req.budget:,.0f}
Channels: {[c.value for c in req.channels]}
Audience: {req.target_audience}
Duration: {req.duration_weeks} weeks

Return JSON:
{{
  "campaign_name": "...",
  "description": "...",
  "goals": ["goal1", "goal2"],
  "strategy": {{
    "overview": "...",
    "channel_breakdown": [
      {{"channel": "...", "budget_allocation": "30%", "tactics": ["..."], "kpis": ["..."]}}
    ],
    "week_by_week_plan": [
      {{"week": 1, "focus": "...", "actions": ["..."]}}
    ],
    "expected_results": {{
      "impressions": 50000, "clicks": 2500, "conversions": 125, "leads": 80,
      "estimated_revenue": 15000, "estimated_roi": "180%"
    }}
  }},
  "budget_breakdown": [{{"item": "...", "amount": 0.0}}]
}}"""

    try:
        resp = client.messages.create(
            model="claude-sonnet-4-6", max_tokens=3000,
            system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        if raw.startswith("```"): raw = raw.split("```")[1]; raw = raw[4:] if raw.startswith("json") else raw
        data = json.loads(raw)
    except Exception as e:
        raise HTTPException(500, str(e))

    c = MarketingCampaign(
        name=data.get("campaign_name", req.business_name + " Campaign"),
        description=data.get("description"),
        channels=json.dumps([ch.value for ch in req.channels]),
        target_audience=req.target_audience,
        goals=json.dumps(data.get("goals", [])),
        budget=req.budget,
        ai_strategy=json.dumps(data.get("strategy", {})),
    )
    db.add(c); await db.commit(); await db.refresh(c); return c
