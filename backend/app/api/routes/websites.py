import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.website import Website, WebsitePage, WebsiteStatus
from app.models.lead import Lead
from app.schemas.websites import (
    WebsiteOut, WebsiteSummary, WebsiteCreate, WebsiteUpdate,
    WebsitePageOut, WebsitePageCreate, WebsitePageUpdate,
    AIGenerateSiteRequest, AIGenerateSectionRequest, WebsiteStats,
)
from app.services.website_service import generate_full_site, generate_section, generate_seo_audit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/websites", tags=["websites"])


# ─── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=WebsiteStats)
async def website_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Website))
    sites = result.scalars().all()
    by_template, by_status = {}, {}
    total_value = 0.0
    live = in_progress = 0

    for s in sites:
        by_template[s.template] = by_template.get(s.template, 0) + 1
        by_status[s.status] = by_status.get(s.status, 0) + 1
        total_value += s.project_value
        if s.status == WebsiteStatus.LIVE:
            live += 1
        elif s.status == WebsiteStatus.IN_PROGRESS:
            in_progress += 1

    return WebsiteStats(
        total=len(sites), live=live, in_progress=in_progress,
        total_value=total_value, sites_by_template=by_template, sites_by_status=by_status,
    )


# ─── CRUD ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[WebsiteSummary])
async def list_websites(status: str | None = None, db: AsyncSession = Depends(get_db)):
    q = select(Website).order_by(desc(Website.created_at))
    if status:
        q = q.where(Website.status == status)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=WebsiteOut, status_code=201)
async def create_website(payload: WebsiteCreate, db: AsyncSession = Depends(get_db)):
    site = Website(**payload.model_dump(exclude_none=True))
    db.add(site)
    await db.commit()
    await db.refresh(site)
    return site


@router.get("/{site_id}", response_model=WebsiteOut)
async def get_website(site_id: int, db: AsyncSession = Depends(get_db)):
    site = await db.get(Website, site_id)
    if not site:
        raise HTTPException(404, "Website not found")
    return site


@router.patch("/{site_id}", response_model=WebsiteOut)
async def update_website(site_id: int, payload: WebsiteUpdate, db: AsyncSession = Depends(get_db)):
    site = await db.get(Website, site_id)
    if not site:
        raise HTTPException(404, "Website not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(site, field, value)
    if payload.status == WebsiteStatus.LIVE and not site.launched_at:
        site.launched_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(site)
    return site


@router.delete("/{site_id}", status_code=204)
async def delete_website(site_id: int, db: AsyncSession = Depends(get_db)):
    site = await db.get(Website, site_id)
    if not site:
        raise HTTPException(404, "Website not found")
    await db.delete(site)
    await db.commit()


# ─── Pages ────────────────────────────────────────────────────────────────────

@router.get("/{site_id}/pages", response_model=list[WebsitePageOut])
async def list_pages(site_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WebsitePage).where(WebsitePage.website_id == site_id).order_by(WebsitePage.order)
    )
    return result.scalars().all()


@router.post("/{site_id}/pages", response_model=WebsitePageOut, status_code=201)
async def create_page(site_id: int, payload: WebsitePageCreate, db: AsyncSession = Depends(get_db)):
    site = await db.get(Website, site_id)
    if not site:
        raise HTTPException(404, "Website not found")
    page = WebsitePage(website_id=site_id, **payload.model_dump(exclude_none=True))
    db.add(page)
    site.pages_count = site.pages_count + 1
    await db.commit()
    await db.refresh(page)
    return page


@router.patch("/{site_id}/pages/{page_id}", response_model=WebsitePageOut)
async def update_page(site_id: int, page_id: int, payload: WebsitePageUpdate, db: AsyncSession = Depends(get_db)):
    page = await db.get(WebsitePage, page_id)
    if not page or page.website_id != site_id:
        raise HTTPException(404, "Page not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(page, field, value)
    await db.commit()
    await db.refresh(page)
    return page


@router.delete("/{site_id}/pages/{page_id}", status_code=204)
async def delete_page(site_id: int, page_id: int, db: AsyncSession = Depends(get_db)):
    page = await db.get(WebsitePage, page_id)
    if not page or page.website_id != site_id:
        raise HTTPException(404, "Page not found")
    site = await db.get(Website, site_id)
    await db.delete(page)
    if site and site.pages_count > 0:
        site.pages_count -= 1
    await db.commit()


# ─── AI ───────────────────────────────────────────────────────────────────────

@router.post("/ai/generate", response_model=WebsiteOut, status_code=201)
async def ai_generate_site(req: AIGenerateSiteRequest, db: AsyncSession = Depends(get_db)):
    lead_data = None
    if req.lead_id:
        lead = await db.get(Lead, req.lead_id)
        if lead:
            lead_data = {"industry": lead.industry, "notes": lead.notes}

    try:
        result = await generate_full_site(
            client_name=req.client_name,
            business_name=req.business_name,
            industry=req.industry,
            description=req.description,
            template=req.template,
            target_audience=req.target_audience,
            key_services=req.key_services,
            brand_colors=req.brand_colors,
            pages=req.pages,
        )
    except Exception as e:
        logger.error(f"AI site generation failed: {e}")
        raise HTTPException(500, f"AI generation failed: {str(e)}")

    color_scheme = result.get("color_scheme", {})
    site = Website(
        lead_id=req.lead_id,
        name=result.get("site_title", f"{req.business_name} Website"),
        client_name=req.client_name,
        client_email=req.client_email,
        template=req.template,
        industry=req.industry,
        description=req.description,
        target_audience=req.target_audience,
        key_services=json.dumps(req.key_services),
        brand_colors=json.dumps(req.brand_colors or [color_scheme.get("primary", "#6366f1")]),
        ai_generated=True,
        status=WebsiteStatus.PLANNING,
    )
    db.add(site)
    await db.flush()

    pages_data = result.get("pages", [])
    for i, page_data in enumerate(pages_data):
        page = WebsitePage(
            website_id=site.id,
            name=page_data.get("name", f"Page {i+1}"),
            slug=page_data.get("slug", f"/page-{i+1}"),
            title=page_data.get("title"),
            meta_description=page_data.get("meta_description"),
            sections=json.dumps(page_data.get("sections", [])),
            order=i,
        )
        db.add(page)

    site.pages_count = len(pages_data)
    await db.commit()
    await db.refresh(site)
    return site


@router.post("/{site_id}/pages/{page_id}/ai/section")
async def ai_generate_section(
    site_id: int, page_id: int,
    req: AIGenerateSectionRequest,
    db: AsyncSession = Depends(get_db),
):
    site = await db.get(Website, site_id)
    page = await db.get(WebsitePage, page_id)
    if not site or not page:
        raise HTTPException(404, "Not found")

    try:
        section = await generate_section(
            section_type=req.section_type,
            business_name=site.name,
            industry=site.industry or "Business",
            description=site.description or "",
            page_name=page.name,
            additional_context=req.additional_context,
        )
    except Exception as e:
        raise HTTPException(500, str(e))

    # Append to existing sections
    existing = json.loads(page.sections) if page.sections else []
    existing.append(section)
    page.sections = json.dumps(existing)
    await db.commit()
    await db.refresh(page)
    return {"section": section, "page": WebsitePageOut.model_validate(page)}


@router.post("/{site_id}/ai/seo-audit")
async def seo_audit(site_id: int, db: AsyncSession = Depends(get_db)):
    site = await db.get(Website, site_id)
    if not site:
        raise HTTPException(404, "Website not found")
    result = await db.execute(
        select(WebsitePage).where(WebsitePage.website_id == site_id)
    )
    pages = result.scalars().all()
    site_data = {
        "name": site.name,
        "industry": site.industry,
        "description": site.description,
        "pages": [{"name": p.name, "title": p.title, "meta_description": p.meta_description} for p in pages],
    }
    try:
        audit = await generate_seo_audit(site_data)
        site.seo_score = audit.get("score", 0)
        await db.commit()
        return audit
    except Exception as e:
        raise HTTPException(500, str(e))
