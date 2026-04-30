"""Module 8 — Settings & Configuration API"""

import json
import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.core.database import get_db
from app.models.settings import AgencySettings, TeamMember, TeamRole

router = APIRouter(prefix="/settings", tags=["settings"])
logger = logging.getLogger(__name__)

# ─── Masking helpers ──────────────────────────────────────────────────────────

_SENTINEL = "***"   # frontend sends this back to mean "don't change"

def _mask(value: str | None) -> str:
    """Return last 4 chars with *** prefix, or empty string if not set."""
    if not value:
        return ""
    if len(value) <= 4:
        return _SENTINEL + "***"
    return f"{_SENTINEL}...{value[-4:]}"

def _should_update(new_val: str | None) -> bool:
    """Return False when the frontend echoes a masked value back."""
    if new_val is None:
        return False
    return not new_val.startswith(_SENTINEL)


# ─── DB helper ────────────────────────────────────────────────────────────────

async def _get_or_create(db: AsyncSession) -> AgencySettings:
    result = await db.execute(select(AgencySettings).where(AgencySettings.id == 1))
    s = result.scalar_one_or_none()
    if s is None:
        s = AgencySettings(id=1)
        db.add(s)
        await db.commit()
        await db.refresh(s)
    return s


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class SettingsOut(BaseModel):
    # Business profile
    agency_name: str
    agency_email: str
    agency_phone: str | None
    agency_website: str | None
    agency_logo_url: str | None
    tagline: str | None
    timezone: str
    currency: str
    services_offered: list[str]
    pricing_model: str
    starting_price: float
    # Social
    twitter_handle: str | None
    linkedin_url: str | None
    facebook_page: str | None
    instagram_handle: str | None
    tiktok_handle: str | None
    # Notifications
    notif_new_lead: bool
    notif_proposal_viewed: bool
    notif_proposal_signed: bool
    notif_campaign_report: bool
    notif_weekly_summary: bool
    notif_email: str | None
    notif_whatsapp: str | None
    # Working hours
    work_start_time: str
    work_end_time: str
    work_days: list[str]
    respect_working_hours: bool
    # Agent behavior
    agent_enabled: bool
    agent_tone: str
    agent_aggressiveness: str
    agent_auto_reply_whatsapp: bool
    agent_auto_draft_proposals: bool
    agent_proposal_min_score: float
    agent_daily_summary: bool
    agent_summary_hour: int
    agent_loop_interval_hours: int
    admin_email: str | None
    admin_whatsapp: str | None
    followup_intervals: dict
    # Schedules
    schedule_content: str
    schedule_lead_scoring: str
    schedule_seo_monitoring: str
    schedule_campaign_reports: str
    # API keys — masked
    anthropic_api_key: str
    sendgrid_api_key: str
    semrush_api_key: str
    google_analytics_id: str
    stripe_secret_key: str
    stripe_publishable_key: str
    whatsapp_phone_number_id: str
    whatsapp_access_token: str
    whatsapp_app_secret: str
    facebook_page_access_token: str
    instagram_business_id: str
    linkedin_access_token: str
    tiktok_access_token: str
    twitter_api_key: str
    twitter_api_secret: str
    twitter_access_token: str
    twitter_access_secret: str
    netlify_access_token: str
    vercel_access_token: str
    imap_host: str | None
    imap_port: int
    imap_user: str | None
    imap_password: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class SettingsIn(BaseModel):
    # Business profile
    agency_name: str | None = None
    agency_email: str | None = None
    agency_phone: str | None = None
    agency_website: str | None = None
    agency_logo_url: str | None = None
    tagline: str | None = None
    timezone: str | None = None
    currency: str | None = None
    services_offered: list[str] | None = None
    pricing_model: str | None = None
    starting_price: float | None = None
    # Social
    twitter_handle: str | None = None
    linkedin_url: str | None = None
    facebook_page: str | None = None
    instagram_handle: str | None = None
    tiktok_handle: str | None = None
    # Notifications
    notif_new_lead: bool | None = None
    notif_proposal_viewed: bool | None = None
    notif_proposal_signed: bool | None = None
    notif_campaign_report: bool | None = None
    notif_weekly_summary: bool | None = None
    notif_email: str | None = None
    notif_whatsapp: str | None = None
    # Working hours
    work_start_time: str | None = None
    work_end_time: str | None = None
    work_days: list[str] | None = None
    respect_working_hours: bool | None = None
    # Agent behavior
    agent_enabled: bool | None = None
    agent_tone: str | None = None
    agent_aggressiveness: str | None = None
    agent_auto_reply_whatsapp: bool | None = None
    agent_auto_draft_proposals: bool | None = None
    agent_proposal_min_score: float | None = None
    agent_daily_summary: bool | None = None
    agent_summary_hour: int | None = None
    agent_loop_interval_hours: int | None = None
    admin_email: str | None = None
    admin_whatsapp: str | None = None
    followup_intervals: dict | None = None
    # Schedules
    schedule_content: str | None = None
    schedule_lead_scoring: str | None = None
    schedule_seo_monitoring: str | None = None
    schedule_campaign_reports: str | None = None
    # API keys (send *** prefix to leave unchanged)
    anthropic_api_key: str | None = None
    sendgrid_api_key: str | None = None
    semrush_api_key: str | None = None
    google_analytics_id: str | None = None
    stripe_secret_key: str | None = None
    stripe_publishable_key: str | None = None
    whatsapp_phone_number_id: str | None = None
    whatsapp_access_token: str | None = None
    whatsapp_app_secret: str | None = None
    facebook_page_access_token: str | None = None
    instagram_business_id: str | None = None
    linkedin_access_token: str | None = None
    tiktok_access_token: str | None = None
    twitter_api_key: str | None = None
    twitter_api_secret: str | None = None
    twitter_access_token: str | None = None
    twitter_access_secret: str | None = None
    netlify_access_token: str | None = None
    vercel_access_token: str | None = None
    imap_host: str | None = None
    imap_port: int | None = None
    imap_user: str | None = None
    imap_password: str | None = None


class TeamMemberOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    avatar_url: str | None
    initials: str
    is_active: bool
    invited_at: datetime
    last_active_at: datetime | None

    model_config = {"from_attributes": True}


class TeamMemberCreate(BaseModel):
    name: str
    email: str
    role: TeamRole = TeamRole.VIEWER


class TeamMemberUpdate(BaseModel):
    role: TeamRole | None = None
    is_active: bool | None = None
    name: str | None = None


# ─── Serialiser ───────────────────────────────────────────────────────────────

def _to_out(s: AgencySettings) -> SettingsOut:
    def _parse_json_list(v: str | None, default: list) -> list:
        try:
            return json.loads(v) if v else default
        except Exception:
            return default

    def _parse_json_dict(v: str | None, default: dict) -> dict:
        try:
            return json.loads(v) if v else default
        except Exception:
            return default

    return SettingsOut(
        agency_name=s.agency_name,
        agency_email=s.agency_email,
        agency_phone=s.agency_phone,
        agency_website=s.agency_website,
        agency_logo_url=s.agency_logo_url,
        tagline=s.tagline,
        timezone=s.timezone,
        currency=s.currency,
        services_offered=_parse_json_list(s.services_offered, []),
        pricing_model=s.pricing_model,
        starting_price=s.starting_price,
        twitter_handle=s.twitter_handle,
        linkedin_url=s.linkedin_url,
        facebook_page=s.facebook_page,
        instagram_handle=s.instagram_handle,
        tiktok_handle=s.tiktok_handle,
        notif_new_lead=s.notif_new_lead,
        notif_proposal_viewed=s.notif_proposal_viewed,
        notif_proposal_signed=s.notif_proposal_signed,
        notif_campaign_report=s.notif_campaign_report,
        notif_weekly_summary=s.notif_weekly_summary,
        notif_email=s.notif_email,
        notif_whatsapp=s.notif_whatsapp,
        work_start_time=s.work_start_time,
        work_end_time=s.work_end_time,
        work_days=_parse_json_list(s.work_days, ["mon","tue","wed","thu","fri"]),
        respect_working_hours=s.respect_working_hours,
        agent_enabled=s.agent_enabled,
        agent_tone=s.agent_tone,
        agent_aggressiveness=s.agent_aggressiveness,
        agent_auto_reply_whatsapp=s.agent_auto_reply_whatsapp,
        agent_auto_draft_proposals=s.agent_auto_draft_proposals,
        agent_proposal_min_score=s.agent_proposal_min_score,
        agent_daily_summary=s.agent_daily_summary,
        agent_summary_hour=s.agent_summary_hour,
        agent_loop_interval_hours=s.agent_loop_interval_hours,
        admin_email=s.admin_email,
        admin_whatsapp=s.admin_whatsapp,
        followup_intervals=_parse_json_dict(s.followup_intervals, {}),
        schedule_content=s.schedule_content,
        schedule_lead_scoring=s.schedule_lead_scoring,
        schedule_seo_monitoring=s.schedule_seo_monitoring,
        schedule_campaign_reports=s.schedule_campaign_reports,
        # Keys — masked
        anthropic_api_key=_mask(s.anthropic_api_key),
        sendgrid_api_key=_mask(s.sendgrid_api_key),
        semrush_api_key=_mask(s.semrush_api_key),
        google_analytics_id=_mask(s.google_analytics_id),
        stripe_secret_key=_mask(s.stripe_secret_key),
        stripe_publishable_key=_mask(s.stripe_publishable_key),
        whatsapp_phone_number_id=s.whatsapp_phone_number_id or "",
        whatsapp_access_token=_mask(s.whatsapp_access_token),
        whatsapp_app_secret=_mask(s.whatsapp_app_secret),
        facebook_page_access_token=_mask(s.facebook_page_access_token),
        instagram_business_id=s.instagram_business_id or "",
        linkedin_access_token=_mask(s.linkedin_access_token),
        tiktok_access_token=_mask(s.tiktok_access_token),
        twitter_api_key=_mask(s.twitter_api_key),
        twitter_api_secret=_mask(s.twitter_api_secret),
        twitter_access_token=_mask(s.twitter_access_token),
        twitter_access_secret=_mask(s.twitter_access_secret),
        netlify_access_token=_mask(s.netlify_access_token),
        vercel_access_token=_mask(s.vercel_access_token),
        imap_host=s.imap_host,
        imap_port=s.imap_port,
        imap_user=s.imap_user,
        imap_password=_mask(s.imap_password),
        updated_at=s.updated_at,
    )


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/", response_model=SettingsOut)
async def get_settings(db: AsyncSession = Depends(get_db)):
    s = await _get_or_create(db)
    return _to_out(s)


@router.put("/", response_model=SettingsOut)
async def update_settings(body: SettingsIn, db: AsyncSession = Depends(get_db)):
    s = await _get_or_create(db)

    # Plain fields — update if not None
    plain_fields = [
        "agency_name", "agency_email", "agency_phone", "agency_website", "agency_logo_url",
        "tagline", "timezone", "currency", "pricing_model", "starting_price",
        "twitter_handle", "linkedin_url", "facebook_page", "instagram_handle", "tiktok_handle",
        "notif_new_lead", "notif_proposal_viewed", "notif_proposal_signed",
        "notif_campaign_report", "notif_weekly_summary", "notif_email", "notif_whatsapp",
        "work_start_time", "work_end_time", "respect_working_hours",
        "agent_enabled", "agent_tone", "agent_aggressiveness", "agent_auto_reply_whatsapp",
        "agent_auto_draft_proposals", "agent_proposal_min_score", "agent_daily_summary",
        "agent_summary_hour", "agent_loop_interval_hours", "admin_email", "admin_whatsapp",
        "schedule_content", "schedule_lead_scoring", "schedule_seo_monitoring",
        "schedule_campaign_reports",
        "imap_host", "imap_port", "imap_user",
        "whatsapp_phone_number_id", "instagram_business_id",
    ]
    for field in plain_fields:
        val = getattr(body, field, None)
        if val is not None:
            setattr(s, field, val)

    # JSON array fields
    if body.services_offered is not None:
        s.services_offered = json.dumps(body.services_offered)
    if body.work_days is not None:
        s.work_days = json.dumps(body.work_days)
    if body.followup_intervals is not None:
        s.followup_intervals = json.dumps(body.followup_intervals)

    # API key fields — only update when not masked
    key_fields = [
        "anthropic_api_key", "sendgrid_api_key", "semrush_api_key", "google_analytics_id",
        "stripe_secret_key", "stripe_publishable_key",
        "whatsapp_access_token", "whatsapp_app_secret",
        "facebook_page_access_token", "linkedin_access_token", "tiktok_access_token",
        "twitter_api_key", "twitter_api_secret", "twitter_access_token", "twitter_access_secret",
        "netlify_access_token", "vercel_access_token", "imap_password",
    ]
    for field in key_fields:
        val = getattr(body, field, None)
        if val is not None and _should_update(val):
            setattr(s, field, val or None)

    s.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(s)

    # Patch live config so app uses new keys without restart
    _apply_to_live_config(s)

    return _to_out(s)


def _apply_to_live_config(s: AgencySettings) -> None:
    """Apply DB settings to the in-memory config object."""
    from app.core.config import settings as cfg
    if s.anthropic_api_key:
        cfg.ANTHROPIC_API_KEY = s.anthropic_api_key
    if s.sendgrid_api_key:
        cfg.SENDGRID_API_KEY = s.sendgrid_api_key
    if s.whatsapp_phone_number_id:
        cfg.WHATSAPP_PHONE_NUMBER_ID = s.whatsapp_phone_number_id
    if s.whatsapp_access_token:
        cfg.WHATSAPP_ACCESS_TOKEN = s.whatsapp_access_token
    if s.netlify_access_token:
        cfg.NETLIFY_ACCESS_TOKEN = s.netlify_access_token
    if s.vercel_access_token:
        cfg.VERCEL_ACCESS_TOKEN = s.vercel_access_token
    if s.admin_email:
        cfg.ADMIN_EMAIL = s.admin_email
    if s.admin_whatsapp:
        cfg.ADMIN_WHATSAPP = s.admin_whatsapp
    if s.imap_host:
        cfg.IMAP_HOST = s.imap_host
    if s.imap_user:
        cfg.IMAP_USER = s.imap_user
    if s.imap_password:
        cfg.IMAP_PASSWORD = s.imap_password
    cfg.AGENT_ENABLED = s.agent_enabled
    cfg.AUTO_PROPOSAL_MIN_SCORE = s.agent_proposal_min_score
    cfg.AGENCY_NAME = s.agency_name


# ─── Team endpoints ───────────────────────────────────────────────────────────

@router.get("/team", response_model=list[TeamMemberOut])
async def list_team(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TeamMember).order_by(TeamMember.invited_at))
    members = result.scalars().all()
    return [TeamMemberOut(
        id=m.id, name=m.name, email=m.email, role=m.role,
        avatar_url=m.avatar_url, initials=m.initials, is_active=m.is_active,
        invited_at=m.invited_at, last_active_at=m.last_active_at,
    ) for m in members]


@router.post("/team", response_model=TeamMemberOut, status_code=201)
async def add_team_member(body: TeamMemberCreate, db: AsyncSession = Depends(get_db)):
    exists = await db.execute(select(TeamMember).where(TeamMember.email == body.email))
    if exists.scalar_one_or_none():
        raise HTTPException(409, "A team member with this email already exists")
    member = TeamMember(name=body.name, email=body.email, role=body.role,
                        invited_by=app_settings.AGENCY_EMAIL)
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return TeamMemberOut(
        id=member.id, name=member.name, email=member.email, role=member.role,
        avatar_url=member.avatar_url, initials=member.initials, is_active=member.is_active,
        invited_at=member.invited_at, last_active_at=member.last_active_at,
    )


@router.patch("/team/{member_id}", response_model=TeamMemberOut)
async def update_team_member(member_id: int, body: TeamMemberUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TeamMember).where(TeamMember.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(404, "Member not found")
    if body.role is not None:
        member.role = body.role
    if body.is_active is not None:
        member.is_active = body.is_active
    if body.name is not None:
        member.name = body.name
    await db.commit()
    await db.refresh(member)
    return TeamMemberOut(
        id=member.id, name=member.name, email=member.email, role=member.role,
        avatar_url=member.avatar_url, initials=member.initials, is_active=member.is_active,
        invited_at=member.invited_at, last_active_at=member.last_active_at,
    )


@router.delete("/team/{member_id}", status_code=204)
async def remove_team_member(member_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TeamMember).where(TeamMember.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(404, "Member not found")
    await db.delete(member)
    await db.commit()


# ─── Connection test ──────────────────────────────────────────────────────────

@router.post("/test/{service}")
async def test_connection(service: str, db: AsyncSession = Depends(get_db)):
    s = await _get_or_create(db)

    try:
        if service == "anthropic":
            key = s.anthropic_api_key or app_settings.ANTHROPIC_API_KEY
            if not key:
                return {"ok": False, "message": "API key not configured"}
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=key)
            await client.messages.create(
                model="claude-haiku-4-5-20251001", max_tokens=10,
                messages=[{"role": "user", "content": "Hi"}]
            )
            return {"ok": True, "message": "Anthropic connected ✓"}

        elif service == "sendgrid":
            key = s.sendgrid_api_key or app_settings.SENDGRID_API_KEY
            if not key:
                return {"ok": False, "message": "API key not configured"}
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://api.sendgrid.com/v3/user/profile",
                    headers={"Authorization": f"Bearer {key}"},
                )
            if resp.status_code == 200:
                username = resp.json().get("username", "")
                return {"ok": True, "message": f"SendGrid connected — {username} ✓"}
            return {"ok": False, "message": f"SendGrid error {resp.status_code}"}

        elif service == "whatsapp":
            token = s.whatsapp_access_token or app_settings.WHATSAPP_ACCESS_TOKEN
            phone_id = s.whatsapp_phone_number_id or app_settings.WHATSAPP_PHONE_NUMBER_ID
            if not token or not phone_id:
                return {"ok": False, "message": "WhatsApp not configured"}
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"https://graph.facebook.com/v19.0/{phone_id}",
                    headers={"Authorization": f"Bearer {token}"},
                )
            if resp.status_code == 200:
                name = resp.json().get("display_phone_number", "")
                return {"ok": True, "message": f"WhatsApp connected — {name} ✓"}
            return {"ok": False, "message": f"Meta API error {resp.status_code}"}

        elif service == "netlify":
            token = s.netlify_access_token or app_settings.NETLIFY_ACCESS_TOKEN
            if not token:
                return {"ok": False, "message": "Netlify token not configured"}
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://api.netlify.com/api/v1/user",
                    headers={"Authorization": f"Bearer {token}"},
                )
            if resp.status_code == 200:
                email = resp.json().get("email", "")
                return {"ok": True, "message": f"Netlify connected — {email} ✓"}
            return {"ok": False, "message": f"Netlify error {resp.status_code}"}

        elif service == "vercel":
            token = s.vercel_access_token or app_settings.VERCEL_ACCESS_TOKEN
            if not token:
                return {"ok": False, "message": "Vercel token not configured"}
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://api.vercel.com/v2/user",
                    headers={"Authorization": f"Bearer {token}"},
                )
            if resp.status_code == 200:
                username = resp.json().get("user", {}).get("username", "")
                return {"ok": True, "message": f"Vercel connected — {username} ✓"}
            return {"ok": False, "message": f"Vercel error {resp.status_code}"}

        elif service == "imap":
            import imaplib, asyncio
            host = s.imap_host
            user = s.imap_user
            password = s.imap_password
            if not all([host, user, password]):
                return {"ok": False, "message": "IMAP not fully configured"}
            def _check():
                mail = imaplib.IMAP4_SSL(host, s.imap_port)
                mail.login(user, password)
                mail.logout()
            await asyncio.to_thread(_check)
            return {"ok": True, "message": f"IMAP connected — {user} ✓"}

        else:
            return {"ok": False, "message": f"Unknown service: {service}"}

    except Exception as exc:
        return {"ok": False, "message": str(exc)[:200]}
