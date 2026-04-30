from datetime import datetime
from pydantic import BaseModel
from app.models.website import WebsiteStatus, WebsiteTemplate, SectionType, RevisionStatus, RevisionPriority


class WebsitePageOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    website_id: int
    name: str
    slug: str
    title: str | None
    meta_description: str | None
    sections: str | None
    is_published: bool
    order: int
    created_at: datetime
    updated_at: datetime


class WebsitePageCreate(BaseModel):
    name: str
    slug: str
    title: str | None = None
    meta_description: str | None = None
    sections: str | None = None
    order: int = 0


class WebsitePageUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    title: str | None = None
    meta_description: str | None = None
    sections: str | None = None
    is_published: bool | None = None
    order: int | None = None


class WebsiteOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    lead_id: int | None
    name: str
    client_name: str
    client_email: str | None
    domain: str | None
    live_url: str | None
    share_token: str
    template: WebsiteTemplate
    status: WebsiteStatus
    industry: str | None
    description: str | None
    brand_colors: str | None
    target_audience: str | None
    key_services: str | None
    notes: str | None
    progress: int
    pages_count: int
    project_value: float
    monthly_maintenance: float
    ai_generated: bool
    seo_score: int | None
    requirements_sent: bool
    requirements_submitted: bool
    deploy_platform: str | None
    netlify_site_id: str | None
    netlify_deploy_url: str | None
    vercel_project_id: str | None
    vercel_deploy_url: str | None
    wp_site_url: str | None
    last_deployed_at: datetime | None
    deadline: datetime | None
    launched_at: datetime | None
    created_at: datetime
    updated_at: datetime
    pages: list[WebsitePageOut] = []


class WebsiteSummary(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    name: str
    client_name: str
    domain: str | None
    live_url: str | None
    share_token: str
    template: WebsiteTemplate
    status: WebsiteStatus
    progress: int
    pages_count: int
    project_value: float
    ai_generated: bool
    created_at: datetime
    deadline: datetime | None
    netlify_deploy_url: str | None
    vercel_deploy_url: str | None
    deploy_platform: str | None
    last_deployed_at: datetime | None


class WebsiteCreate(BaseModel):
    lead_id: int | None = None
    name: str
    client_name: str
    client_email: str | None = None
    domain: str | None = None
    template: WebsiteTemplate = WebsiteTemplate.BUSINESS
    industry: str | None = None
    description: str | None = None
    brand_colors: str | None = None
    target_audience: str | None = None
    key_services: str | None = None
    notes: str | None = None
    project_value: float = 0.0
    monthly_maintenance: float = 0.0
    deadline: datetime | None = None


class WebsiteUpdate(BaseModel):
    name: str | None = None
    client_name: str | None = None
    client_email: str | None = None
    domain: str | None = None
    live_url: str | None = None
    template: WebsiteTemplate | None = None
    status: WebsiteStatus | None = None
    industry: str | None = None
    description: str | None = None
    brand_colors: str | None = None
    target_audience: str | None = None
    key_services: str | None = None
    notes: str | None = None
    progress: int | None = None
    project_value: float | None = None
    monthly_maintenance: float | None = None
    deadline: datetime | None = None
    seo_score: int | None = None
    wp_site_url: str | None = None
    wp_username: str | None = None
    wp_app_password: str | None = None


class AIGenerateSiteRequest(BaseModel):
    lead_id: int | None = None
    client_name: str
    client_email: str | None = None
    business_name: str
    industry: str
    description: str
    template: WebsiteTemplate
    target_audience: str | None = None
    key_services: list[str] = []
    brand_colors: list[str] = []
    pages: list[str] = ["Home", "About", "Services", "Contact"]


class AIGenerateSectionRequest(BaseModel):
    website_id: int
    page_id: int
    section_type: SectionType
    additional_context: str | None = None


class WebsiteStats(BaseModel):
    total: int
    live: int
    in_progress: int
    total_value: float
    sites_by_template: dict
    sites_by_status: dict


# ─── Requirements ─────────────────────────────────────────────────────────────

class RequirementsOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    website_id: int
    intake_token: str
    client_name: str | None
    client_email: str | None
    business_name: str | None
    target_audience: str | None
    design_style: str | None
    color_preferences: str | None
    competitor_urls: str | None
    reference_sites: str | None
    must_have_features: str | None
    pages_needed: str | None
    content_ready: bool
    logo_ready: bool
    images_ready: bool
    deadline_notes: str | None
    special_requests: str | None
    submitted_at: datetime | None
    created_at: datetime


class RequirementsSubmit(BaseModel):
    client_name: str | None = None
    client_email: str | None = None
    business_name: str | None = None
    target_audience: str | None = None
    design_style: str | None = None
    color_preferences: str | None = None
    competitor_urls: str | None = None
    reference_sites: str | None = None
    must_have_features: str | None = None
    pages_needed: str | None = None
    content_ready: bool = False
    logo_ready: bool = False
    images_ready: bool = False
    deadline_notes: str | None = None
    special_requests: str | None = None


# ─── Revisions ────────────────────────────────────────────────────────────────

class RevisionOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    website_id: int
    requested_by: str | None
    page_name: str | None
    section_type: str | None
    description: str
    status: RevisionStatus
    priority: RevisionPriority
    agency_notes: str | None
    created_at: datetime
    updated_at: datetime


class RevisionCreate(BaseModel):
    requested_by: str | None = None
    page_name: str | None = None
    section_type: str | None = None
    description: str
    priority: RevisionPriority = RevisionPriority.MEDIUM


class RevisionUpdate(BaseModel):
    status: RevisionStatus | None = None
    agency_notes: str | None = None
    priority: RevisionPriority | None = None


# ─── Deploy ───────────────────────────────────────────────────────────────────

class DeployRequest(BaseModel):
    platform: str  # netlify | vercel | wordpress
    wp_url: str | None = None
    wp_username: str | None = None
    wp_app_password: str | None = None
