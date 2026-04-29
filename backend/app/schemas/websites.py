from datetime import datetime
from pydantic import BaseModel
from app.models.website import WebsiteStatus, WebsiteTemplate, SectionType


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
    template: WebsiteTemplate
    status: WebsiteStatus
    progress: int
    pages_count: int
    project_value: float
    ai_generated: bool
    created_at: datetime
    deadline: datetime | None


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
    live_url: str | None = None
    seo_score: int | None = None


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
