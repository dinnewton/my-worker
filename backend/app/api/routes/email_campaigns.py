import json, logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.email_campaign import EmailCampaign, CampaignStatus, CampaignType
from app.services.ai_agent import get_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/email", tags=["email"])

SYSTEM_PROMPT = """You are an expert email marketer. Write compelling, high-converting email campaigns.
Always respond with valid JSON only."""


# ── Schemas (inline for brevity) ────────────────────────────────────────────
class CampaignOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int; name: str; subject: str; preview_text: str | None
    campaign_type: CampaignType; status: CampaignStatus
    html_content: str | None; plain_text: str | None; ai_generated: bool
    segment: str | None; recipient_count: int
    sent_count: int; open_count: int; click_count: int
    open_rate: float; click_rate: float
    scheduled_at: datetime | None; sent_at: datetime | None
    created_at: datetime; updated_at: datetime

class CampaignCreate(BaseModel):
    name: str; subject: str; campaign_type: CampaignType = CampaignType.NEWSLETTER
    preview_text: str | None = None; segment: str | None = None

class CampaignUpdate(BaseModel):
    name: str | None = None; subject: str | None = None
    preview_text: str | None = None; html_content: str | None = None
    plain_text: str | None = None; segment: str | None = None
    scheduled_at: datetime | None = None

class AIGenerateEmailRequest(BaseModel):
    campaign_type: CampaignType; business_name: str; subject: str
    audience: str; key_message: str; cta_text: str = "Get Started"
    tone: str = "professional"

class CampaignStats(BaseModel):
    total: int; draft: int; sent: int; avg_open_rate: float; avg_click_rate: float; total_sent: int


# ── Stats ────────────────────────────────────────────────────────────────────
@router.get("/stats", response_model=CampaignStats)
async def stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EmailCampaign))
    camps = result.scalars().all()
    sent = [c for c in camps if c.status == CampaignStatus.SENT]
    return CampaignStats(
        total=len(camps),
        draft=sum(1 for c in camps if c.status == CampaignStatus.DRAFT),
        sent=len(sent),
        avg_open_rate=round(sum(c.open_rate for c in sent) / len(sent), 1) if sent else 0,
        avg_click_rate=round(sum(c.click_rate for c in sent) / len(sent), 1) if sent else 0,
        total_sent=sum(c.sent_count for c in sent),
    )


# ── CRUD ────────────────────────────────────────────────────────────────────
@router.get("", response_model=list[CampaignOut])
async def list_campaigns(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EmailCampaign).order_by(desc(EmailCampaign.created_at)))
    return result.scalars().all()

@router.post("", response_model=CampaignOut, status_code=201)
async def create_campaign(payload: CampaignCreate, db: AsyncSession = Depends(get_db)):
    c = EmailCampaign(**payload.model_dump(exclude_none=True))
    db.add(c); await db.commit(); await db.refresh(c); return c

@router.get("/{cid}", response_model=CampaignOut)
async def get_campaign(cid: int, db: AsyncSession = Depends(get_db)):
    c = await db.get(EmailCampaign, cid)
    if not c: raise HTTPException(404, "Not found")
    return c

@router.patch("/{cid}", response_model=CampaignOut)
async def update_campaign(cid: int, payload: CampaignUpdate, db: AsyncSession = Depends(get_db)):
    c = await db.get(EmailCampaign, cid)
    if not c: raise HTTPException(404, "Not found")
    for k, v in payload.model_dump(exclude_none=True).items(): setattr(c, k, v)
    await db.commit(); await db.refresh(c); return c

@router.delete("/{cid}", status_code=204)
async def delete_campaign(cid: int, db: AsyncSession = Depends(get_db)):
    c = await db.get(EmailCampaign, cid)
    if not c: raise HTTPException(404, "Not found")
    await db.delete(c); await db.commit()

@router.patch("/{cid}/send", response_model=CampaignOut)
async def mark_sent(cid: int, db: AsyncSession = Depends(get_db)):
    c = await db.get(EmailCampaign, cid)
    if not c: raise HTTPException(404, "Not found")
    c.status = CampaignStatus.SENT; c.sent_at = datetime.now(timezone.utc)
    c.sent_count = c.recipient_count
    # Simulate realistic open/click rates
    c.open_count = int(c.sent_count * 0.24)
    c.click_count = int(c.sent_count * 0.035)
    c.open_rate = 24.0; c.click_rate = 3.5
    await db.commit(); await db.refresh(c); return c


# ── AI Generation ────────────────────────────────────────────────────────────
@router.post("/ai/generate", response_model=CampaignOut, status_code=201)
async def ai_generate(req: AIGenerateEmailRequest, db: AsyncSession = Depends(get_db)):
    client = get_client()
    prompt = f"""Generate a complete email campaign:

Business: {req.business_name}
Type: {req.campaign_type.value}
Subject: {req.subject}
Audience: {req.audience}
Key message: {req.key_message}
CTA: {req.cta_text}
Tone: {req.tone}

Return JSON:
{{
  "subject": "optimized subject line",
  "preview_text": "preview text (50 chars)",
  "html_content": "full HTML email body (professional design using inline styles)",
  "plain_text": "plain text version"
}}"""

    try:
        resp = client.messages.create(
            model="claude-sonnet-4-6", max_tokens=3000,
            system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        if raw.startswith("```"): raw = raw.split("```")[1]; raw = raw[4:] if raw.startswith("json") else raw
        data = json.loads(raw)
    except Exception as e:
        raise HTTPException(500, str(e))

    c = EmailCampaign(
        name=f"{req.campaign_type.value.replace('_',' ').title()} — {req.business_name}",
        subject=data.get("subject", req.subject),
        preview_text=data.get("preview_text"),
        campaign_type=req.campaign_type,
        html_content=data.get("html_content"),
        plain_text=data.get("plain_text"),
        ai_generated=True,
        segment=req.audience,
    )
    db.add(c); await db.commit(); await db.refresh(c); return c
