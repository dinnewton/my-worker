import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.website import Website, WebsitePage, WebsiteStatus, WebsiteRequirements, WebsiteRevision
from app.models.lead import Lead
from app.schemas.websites import (
    WebsiteOut, WebsiteSummary, WebsiteCreate, WebsiteUpdate,
    WebsitePageOut, WebsitePageCreate, WebsitePageUpdate,
    AIGenerateSiteRequest, AIGenerateSectionRequest, WebsiteStats,
    RequirementsOut, RequirementsSubmit,
    RevisionOut, RevisionCreate, RevisionUpdate,
    DeployRequest,
)
from app.services.website_service import (
    generate_full_site, generate_section, generate_seo_audit,
    generate_static_zip, deploy_to_netlify, deploy_to_vercel, deploy_to_wordpress,
    send_requirements_intake_email, generate_page_html,
)

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


# ─── Preview (public, no auth) ────────────────────────────────────────────────

@router.get("/preview/{token}")
async def site_preview(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Website).where(Website.share_token == token))
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(404, "Preview not found")

    pages_result = await db.execute(
        select(WebsitePage).where(WebsitePage.website_id == site.id).order_by(WebsitePage.order)
    )
    pages = pages_result.scalars().all()
    if not pages:
        return StreamingResponse(
            iter([f"<html><body><h1>{site.name}</h1><p>No pages generated yet.</p></body></html>"]),
            media_type="text/html",
        )

    primary = "#6366f1"
    try:
        brand = json.loads(site.brand_colors or "[]")
        if brand:
            primary = brand[0]
    except Exception:
        pass

    pages_meta = [{"name": p.name, "slug": p.slug} for p in pages]
    home = pages[0]
    try:
        sections = json.loads(home.sections or "[]")
    except Exception:
        sections = []

    html = generate_page_html(
        site_name=site.name,
        page_name=home.name,
        page_title=home.title or home.name,
        meta_description=home.meta_description or "",
        sections=sections,
        all_pages=pages_meta,
        primary_color=primary,
    )
    return StreamingResponse(iter([html]), media_type="text/html")


# ─── Requirements intake (public) ────────────────────────────────────────────

@router.get("/requirements/intake/{token}", response_model=RequirementsOut)
async def get_intake_form(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WebsiteRequirements).where(WebsiteRequirements.intake_token == token))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Intake form not found")
    return req


@router.post("/requirements/intake/{token}", response_model=RequirementsOut)
async def submit_intake_form(token: str, payload: RequirementsSubmit, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WebsiteRequirements).where(WebsiteRequirements.intake_token == token))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Intake form not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(req, field, value)
    req.submitted_at = datetime.now(timezone.utc)

    site = await db.get(Website, req.website_id)
    if site:
        site.requirements_submitted = True

    await db.commit()
    await db.refresh(req)
    return req


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
async def delete_page_route(site_id: int, page_id: int, db: AsyncSession = Depends(get_db)):
    page = await db.get(WebsitePage, page_id)
    if not page or page.website_id != site_id:
        raise HTTPException(404, "Page not found")
    site = await db.get(Website, site_id)
    await db.delete(page)
    if site and site.pages_count > 0:
        site.pages_count -= 1
    await db.commit()


# ─── Requirements (per-site) ──────────────────────────────────────────────────

@router.get("/{site_id}/requirements", response_model=list[RequirementsOut])
async def list_requirements(site_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WebsiteRequirements).where(WebsiteRequirements.website_id == site_id)
        .order_by(desc(WebsiteRequirements.created_at))
    )
    return result.scalars().all()


@router.post("/{site_id}/requirements/send", response_model=RequirementsOut, status_code=201)
async def send_requirements(
    site_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    site = await db.get(Website, site_id)
    if not site:
        raise HTTPException(404, "Website not found")

    req = WebsiteRequirements(
        website_id=site_id,
        client_name=site.client_name,
        client_email=site.client_email,
        business_name=site.name,
    )
    db.add(req)
    site.requirements_sent = True
    await db.commit()
    await db.refresh(req)

    if site.client_email:
        intake_url = f"{settings.ALLOWED_ORIGINS.split(',')[0]}/requirements/{req.intake_token}"
        background_tasks.add_task(
            send_requirements_intake_email,
            client_email=site.client_email,
            client_name=site.client_name,
            site_name=site.name,
            intake_url=intake_url,
        )

    return req


# ─── Revisions ────────────────────────────────────────────────────────────────

@router.get("/{site_id}/revisions", response_model=list[RevisionOut])
async def list_revisions(site_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WebsiteRevision).where(WebsiteRevision.website_id == site_id)
        .order_by(desc(WebsiteRevision.created_at))
    )
    return result.scalars().all()


@router.post("/{site_id}/revisions", response_model=RevisionOut, status_code=201)
async def create_revision(site_id: int, payload: RevisionCreate, db: AsyncSession = Depends(get_db)):
    site = await db.get(Website, site_id)
    if not site:
        raise HTTPException(404, "Website not found")
    revision = WebsiteRevision(website_id=site_id, **payload.model_dump())
    db.add(revision)
    await db.commit()
    await db.refresh(revision)
    return revision


@router.patch("/{site_id}/revisions/{rid}", response_model=RevisionOut)
async def update_revision(site_id: int, rid: int, payload: RevisionUpdate, db: AsyncSession = Depends(get_db)):
    revision = await db.get(WebsiteRevision, rid)
    if not revision or revision.website_id != site_id:
        raise HTTPException(404, "Revision not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(revision, field, value)
    await db.commit()
    await db.refresh(revision)
    return revision


@router.delete("/{site_id}/revisions/{rid}", status_code=204)
async def delete_revision(site_id: int, rid: int, db: AsyncSession = Depends(get_db)):
    revision = await db.get(WebsiteRevision, rid)
    if not revision or revision.website_id != site_id:
        raise HTTPException(404, "Revision not found")
    await db.delete(revision)
    await db.commit()


# ─── Export & Deploy ──────────────────────────────────────────────────────────

@router.get("/{site_id}/export-html")
async def export_html(site_id: int, db: AsyncSession = Depends(get_db)):
    site = await db.get(Website, site_id)
    if not site:
        raise HTTPException(404, "Website not found")

    pages_result = await db.execute(
        select(WebsitePage).where(WebsitePage.website_id == site_id).order_by(WebsitePage.order)
    )
    pages = pages_result.scalars().all()
    if not pages:
        raise HTTPException(400, "No pages to export")

    zip_bytes = generate_static_zip(site, pages)
    filename = site.name.lower().replace(" ", "-") + ".zip"
    return StreamingResponse(
        iter([zip_bytes]),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{site_id}/deploy")
async def deploy_site(site_id: int, req: DeployRequest, db: AsyncSession = Depends(get_db)):
    site = await db.get(Website, site_id)
    if not site:
        raise HTTPException(404, "Website not found")

    pages_result = await db.execute(
        select(WebsitePage).where(WebsitePage.website_id == site_id).order_by(WebsitePage.order)
    )
    pages = pages_result.scalars().all()
    if not pages:
        raise HTTPException(400, "No pages to deploy")

    try:
        if req.platform == "netlify":
            token = settings.NETLIFY_ACCESS_TOKEN
            if not token:
                raise HTTPException(400, "NETLIFY_ACCESS_TOKEN not configured")
            result = await deploy_to_netlify(site, pages, token)
            site.netlify_site_id = result["site_id"]
            site.netlify_deploy_url = result["deploy_url"]
            site.live_url = result["deploy_url"]

        elif req.platform == "vercel":
            token = settings.VERCEL_ACCESS_TOKEN
            if not token:
                raise HTTPException(400, "VERCEL_ACCESS_TOKEN not configured")
            result = await deploy_to_vercel(site, pages, token)
            site.vercel_project_id = result.get("project_id", "")
            site.vercel_deploy_url = result["deploy_url"]
            site.live_url = result["deploy_url"]

        elif req.platform == "wordpress":
            wp_url = req.wp_url or site.wp_site_url or settings.WP_DEFAULT_URL
            wp_user = req.wp_username or site.wp_username or settings.WP_DEFAULT_USER
            wp_pass = req.wp_app_password or site.wp_app_password or settings.WP_DEFAULT_APP_PASSWORD
            if not wp_url:
                raise HTTPException(400, "WordPress URL not configured")
            result = await deploy_to_wordpress(site, pages, wp_url, wp_user, wp_pass)
            site.wp_site_url = wp_url
            site.live_url = wp_url

        else:
            raise HTTPException(400, f"Unknown platform: {req.platform}")

        site.deploy_platform = req.platform
        site.last_deployed_at = datetime.now(timezone.utc)
        if site.status == WebsiteStatus.REVIEW:
            site.status = WebsiteStatus.LIVE
            site.launched_at = datetime.now(timezone.utc)

        await db.commit()
        await db.refresh(site)
        return {"success": True, "platform": req.platform, "result": result}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Deploy failed for site {site_id}: {e}")
        raise HTTPException(500, f"Deployment failed: {str(e)}")


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
    result = await db.execute(select(WebsitePage).where(WebsitePage.website_id == site_id))
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
