import json
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.proposal import Proposal, ProposalStatus
from app.models.lead import Lead
from app.schemas.proposals import (
    ProposalOut, ProposalCreate, ProposalUpdate,
    ProposalStatusUpdate, AIGenerateRequest, SignProposalRequest, ProposalSummary,
)
from app.services.proposal_service import generate_proposal, get_win_tips, generate_pdf_bytes
from app.services.invoice_service import send_proposal_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/proposals", tags=["proposals"])


# ─── List & Stats ─────────────────────────────────────────────────────────────

@router.get("", response_model=list[ProposalSummary])
async def list_proposals(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Proposal).order_by(desc(Proposal.created_at))
    if status:
        q = q.where(Proposal.status == status)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/stats")
async def proposal_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Proposal))
    proposals = result.scalars().all()

    total = len(proposals)
    by_status = {}
    total_value = 0.0
    won_value = 0.0

    for p in proposals:
        by_status[p.status] = by_status.get(p.status, 0) + 1
        total_value += p.value
        if p.status == ProposalStatus.ACCEPTED:
            won_value += p.value

    sent = by_status.get(ProposalStatus.SENT, 0) + by_status.get(ProposalStatus.VIEWED, 0)
    accepted = by_status.get(ProposalStatus.ACCEPTED, 0)
    win_rate = round((accepted / sent * 100) if sent > 0 else 0, 1)

    return {
        "total": total,
        "by_status": by_status,
        "total_pipeline_value": total_value,
        "won_value": won_value,
        "win_rate": win_rate,
        "draft":    by_status.get(ProposalStatus.DRAFT, 0),
        "sent":     by_status.get(ProposalStatus.SENT, 0),
        "viewed":   by_status.get(ProposalStatus.VIEWED, 0),
        "accepted": accepted,
        "rejected": by_status.get(ProposalStatus.REJECTED, 0),
    }


# ─── CRUD ─────────────────────────────────────────────────────────────────────

@router.post("", response_model=ProposalOut, status_code=201)
async def create_proposal(
    payload: ProposalCreate,
    db: AsyncSession = Depends(get_db),
):
    proposal = Proposal(
        **payload.model_dump(exclude_none=True),
        ai_generated=False,
    )
    db.add(proposal)
    await db.commit()
    await db.refresh(proposal)
    return proposal


@router.get("/{proposal_id}", response_model=ProposalOut)
async def get_proposal(proposal_id: int, db: AsyncSession = Depends(get_db)):
    p = await db.get(Proposal, proposal_id)
    if not p:
        raise HTTPException(404, "Proposal not found")
    return p


@router.patch("/{proposal_id}", response_model=ProposalOut)
async def update_proposal(
    proposal_id: int,
    payload: ProposalUpdate,
    db: AsyncSession = Depends(get_db),
):
    p = await db.get(Proposal, proposal_id)
    if not p:
        raise HTTPException(404, "Proposal not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(p, field, value)
    await db.commit()
    await db.refresh(p)
    return p


@router.delete("/{proposal_id}", status_code=204)
async def delete_proposal(proposal_id: int, db: AsyncSession = Depends(get_db)):
    p = await db.get(Proposal, proposal_id)
    if not p:
        raise HTTPException(404, "Proposal not found")
    await db.delete(p)
    await db.commit()


@router.patch("/{proposal_id}/status", response_model=ProposalOut)
async def update_status(
    proposal_id: int,
    payload: ProposalStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    p = await db.get(Proposal, proposal_id)
    if not p:
        raise HTTPException(404, "Proposal not found")

    p.status = payload.status
    now = datetime.now(timezone.utc)
    if payload.status == ProposalStatus.SENT and not p.sent_at:
        p.sent_at = now
    elif payload.status == ProposalStatus.VIEWED and not p.viewed_at:
        p.viewed_at = now
    elif payload.status == ProposalStatus.ACCEPTED:
        p.accepted_at = now
    elif payload.status == ProposalStatus.REJECTED:
        p.rejected_at = now

    await db.commit()
    await db.refresh(p)
    return p


# ─── AI Generation ────────────────────────────────────────────────────────────

@router.post("/ai/generate", response_model=ProposalOut, status_code=201)
async def ai_generate_proposal(
    req: AIGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    lead_data = None
    if req.lead_id:
        lead = await db.get(Lead, req.lead_id)
        if lead:
            lead_data = {
                "industry": lead.industry,
                "status": lead.status,
                "score": lead.score,
                "notes": lead.notes,
                "ai_summary": lead.ai_summary,
            }

    try:
        result = await generate_proposal(
            client_name=req.client_name,
            client_company=req.client_company,
            template_type=req.template_type,
            services=req.services,
            budget=req.budget,
            timeline_weeks=req.timeline_weeks,
            notes=req.notes,
            lead_data=lead_data,
        )
    except Exception as e:
        logger.error(f"AI proposal generation failed: {e}")
        raise HTTPException(500, f"AI generation failed: {str(e)}")

    proposal = Proposal(
        lead_id=req.lead_id,
        client_name=req.client_name,
        client_company=req.client_company,
        client_email=req.client_email,
        template_type=req.template_type,
        title=result.get("title", f"{req.client_name} — Proposal"),
        cover_letter=result.get("cover_letter"),
        sections=json.dumps(result.get("sections", [])),
        deliverables=json.dumps(result.get("deliverables", [])),
        timeline=json.dumps(result.get("timeline", [])),
        pricing_breakdown=json.dumps(result.get("pricing_breakdown", [])),
        services=json.dumps(req.services),
        value=result.get("value", req.budget),
        monthly_retainer=result.get("monthly_retainer", 0.0),
        setup_fee=result.get("setup_fee", 0.0),
        timeline_weeks=req.timeline_weeks,
        ai_generated=True,
        ai_win_tips=json.dumps(result.get("ai_win_tips", [])),
        valid_until=datetime.now(timezone.utc) + timedelta(days=30),
    )

    db.add(proposal)
    await db.commit()
    await db.refresh(proposal)
    return proposal


@router.post("/{proposal_id}/ai/win-tips")
async def refresh_win_tips(proposal_id: int, db: AsyncSession = Depends(get_db)):
    p = await db.get(Proposal, proposal_id)
    if not p:
        raise HTTPException(404, "Proposal not found")
    try:
        tips = await get_win_tips(p)
        p.ai_win_tips = json.dumps(tips)
        await db.commit()
        return {"tips": tips}
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── PDF Export ───────────────────────────────────────────────────────────────

@router.get("/{proposal_id}/pdf")
async def download_pdf(proposal_id: int, db: AsyncSession = Depends(get_db)):
    p = await db.get(Proposal, proposal_id)
    if not p:
        raise HTTPException(404, "Proposal not found")
    try:
        pdf_bytes = generate_pdf_bytes(p)
        filename = f"proposal_{p.id}_{p.client_name.replace(' ', '_')}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        raise HTTPException(500, f"PDF generation failed: {str(e)}")


# ─── Public Share Link ────────────────────────────────────────────────────────

@router.get("/share/{token}", response_model=ProposalOut)
async def view_shared_proposal(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Proposal).where(Proposal.share_token == token))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Proposal not found")
    if p.status == ProposalStatus.SENT:
        p.status = ProposalStatus.VIEWED
        p.viewed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(p)
    return p


# ─── Email delivery ───────────────────────────────────────────────────────────

@router.post("/{proposal_id}/send-email")
async def send_email(proposal_id: int, db: AsyncSession = Depends(get_db)):
    p = await db.get(Proposal, proposal_id)
    if not p:
        raise HTTPException(404, "Proposal not found")
    if not p.client_email:
        raise HTTPException(400, "Proposal has no client email address")

    share_url = f"{__import__('app.core.config', fromlist=['settings']).settings.ALLOWED_ORIGINS.split(',')[0]}/proposals/share/{p.share_token}"
    try:
        pdf_bytes = generate_pdf_bytes(p)
        ok = await send_proposal_email(p, pdf_bytes, share_url)
    except Exception as e:
        raise HTTPException(500, str(e))

    if ok:
        if p.status == ProposalStatus.DRAFT:
            p.status = ProposalStatus.SENT
            p.sent_at = datetime.now(timezone.utc)
            await db.commit()
    return {"sent": ok, "share_url": share_url}


# ─── E-Signature ──────────────────────────────────────────────────────────────

@router.post("/share/{token}/sign", response_model=ProposalOut)
async def sign_proposal(
    token: str,
    payload: SignProposalRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Proposal).where(Proposal.share_token == token))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Proposal not found")
    if p.status in (ProposalStatus.REJECTED, ProposalStatus.EXPIRED):
        raise HTTPException(400, f"Proposal is {p.status} and cannot be signed")

    p.signature_name = payload.signature_name
    p.signature_date = datetime.now(timezone.utc)
    p.status = ProposalStatus.ACCEPTED
    p.accepted_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(p)
    return p
