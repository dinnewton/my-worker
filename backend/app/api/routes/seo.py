import json, logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.seo_project import SEOProject, SEOProjectStatus
from app.services.ai_agent import get_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/seo", tags=["seo"])

SYSTEM = """You are an expert SEO analyst. Provide detailed, actionable SEO analysis.
Always respond with valid JSON only."""


class SEOProjectOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int; client_name: str; website_url: str; status: SEOProjectStatus
    keywords: str | None; technical_issues: str | None; recommendations: str | None
    seo_score: int | None; technical_score: int | None; content_score: int | None; authority_score: int | None
    estimated_monthly_traffic: int | None; notes: str | None
    last_audit_at: datetime | None; created_at: datetime

class SEOProjectCreate(BaseModel):
    lead_id: int | None = None; client_name: str; website_url: str; notes: str | None = None

class SEOProjectUpdate(BaseModel):
    client_name: str | None = None; website_url: str | None = None
    notes: str | None = None; status: SEOProjectStatus | None = None

class AuditRequest(BaseModel):
    target_keywords: list[str] = []
    competitors: list[str] = []


@router.get("/stats")
async def stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SEOProject))
    projects = result.scalars().all()
    avg_score = round(sum(p.seo_score or 0 for p in projects) / len(projects), 1) if projects else 0
    return {
        "total": len(projects), "active": sum(1 for p in projects if p.status == SEOProjectStatus.ACTIVE),
        "avg_score": avg_score, "audited": sum(1 for p in projects if p.last_audit_at),
    }

@router.get("", response_model=list[SEOProjectOut])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SEOProject).order_by(desc(SEOProject.created_at)))
    return result.scalars().all()

@router.post("", response_model=SEOProjectOut, status_code=201)
async def create_project(payload: SEOProjectCreate, db: AsyncSession = Depends(get_db)):
    p = SEOProject(**payload.model_dump(exclude_none=True))
    db.add(p); await db.commit(); await db.refresh(p); return p

@router.get("/{pid}", response_model=SEOProjectOut)
async def get_project(pid: int, db: AsyncSession = Depends(get_db)):
    p = await db.get(SEOProject, pid)
    if not p: raise HTTPException(404, "Not found")
    return p

@router.patch("/{pid}", response_model=SEOProjectOut)
async def update_project(pid: int, payload: SEOProjectUpdate, db: AsyncSession = Depends(get_db)):
    p = await db.get(SEOProject, pid)
    if not p: raise HTTPException(404, "Not found")
    for k, v in payload.model_dump(exclude_none=True).items(): setattr(p, k, v)
    await db.commit(); await db.refresh(p); return p

@router.delete("/{pid}", status_code=204)
async def delete_project(pid: int, db: AsyncSession = Depends(get_db)):
    p = await db.get(SEOProject, pid)
    if not p: raise HTTPException(404, "Not found")
    await db.delete(p); await db.commit()

@router.post("/{pid}/audit")
async def run_audit(pid: int, req: AuditRequest, db: AsyncSession = Depends(get_db)):
    p = await db.get(SEOProject, pid)
    if not p: raise HTTPException(404, "Not found")
    client = get_client()

    prompt = f"""Perform a comprehensive SEO audit for:
URL: {p.website_url}
Client: {p.client_name}
Target keywords: {req.target_keywords or ['general business keywords']}
Competitors: {req.competitors or ['not specified']}

Return JSON:
{{
  "seo_score": 0-100,
  "technical_score": 0-100,
  "content_score": 0-100,
  "authority_score": 0-100,
  "estimated_monthly_traffic": integer,
  "keywords": [
    {{"keyword": "...", "volume": 1000, "difficulty": 45, "current_ranking": 12, "opportunity": "high/medium/low"}}
  ],
  "technical_issues": [
    {{"severity": "high/medium/low", "issue": "...", "fix": "...", "impact": "..."}}
  ],
  "recommendations": [
    {{"priority": 1, "action": "...", "expected_impact": "...", "timeframe": "1-2 weeks"}}
  ],
  "competitors_analysis": [
    {{"domain": "...", "strengths": "...", "opportunities": "..."}}
  ]
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

    p.seo_score       = data.get("seo_score")
    p.technical_score = data.get("technical_score")
    p.content_score   = data.get("content_score")
    p.authority_score = data.get("authority_score")
    p.estimated_monthly_traffic = data.get("estimated_monthly_traffic")
    p.keywords          = json.dumps(data.get("keywords", []))
    p.technical_issues  = json.dumps(data.get("technical_issues", []))
    p.recommendations   = json.dumps(data.get("recommendations", []))
    p.competitors       = json.dumps(data.get("competitors_analysis", []))
    p.last_audit_at     = datetime.now(timezone.utc)
    await db.commit(); await db.refresh(p)
    return data
