import secrets
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Boolean, Integer, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum


class WebsiteStatus(str, enum.Enum):
    PLANNING    = "planning"
    IN_PROGRESS = "in_progress"
    REVIEW      = "review"
    LIVE        = "live"
    MAINTENANCE = "maintenance"
    PAUSED      = "paused"


class WebsiteTemplate(str, enum.Enum):
    BUSINESS     = "business"
    PORTFOLIO    = "portfolio"
    LANDING_PAGE = "landing_page"
    ECOMMERCE    = "ecommerce"
    BLOG         = "blog"
    RESTAURANT   = "restaurant"
    AGENCY       = "agency"
    SAAS         = "saas"


class SectionType(str, enum.Enum):
    HERO         = "hero"
    ABOUT        = "about"
    SERVICES     = "services"
    PORTFOLIO    = "portfolio"
    TESTIMONIALS = "testimonials"
    PRICING      = "pricing"
    FAQ          = "faq"
    CONTACT      = "contact"
    BLOG         = "blog"
    TEAM         = "team"
    CTA          = "cta"
    STATS        = "stats"
    CUSTOM       = "custom"


class RevisionStatus(str, enum.Enum):
    PENDING     = "pending"
    IN_PROGRESS = "in_progress"
    DONE        = "done"
    REJECTED    = "rejected"


class RevisionPriority(str, enum.Enum):
    LOW    = "low"
    MEDIUM = "medium"
    HIGH   = "high"


class DeployPlatform(str, enum.Enum):
    NETLIFY   = "netlify"
    VERCEL    = "vercel"
    WORDPRESS = "wordpress"
    MANUAL    = "manual"


class Website(Base):
    __tablename__ = "websites"

    id: Mapped[int]           = mapped_column(primary_key=True, index=True)
    lead_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)

    # Identity
    name: Mapped[str]              = mapped_column(String(255), nullable=False)
    client_name: Mapped[str]       = mapped_column(String(255), nullable=False)
    client_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    domain: Mapped[str | None]     = mapped_column(String(255), nullable=True)
    live_url: Mapped[str | None]   = mapped_column(String(500), nullable=True)
    share_token: Mapped[str]       = mapped_column(String(64), unique=True, nullable=False,
                                                     default=lambda: secrets.token_urlsafe(24))

    # Project details
    template: Mapped[str]               = mapped_column(SAEnum(WebsiteTemplate), default=WebsiteTemplate.BUSINESS, nullable=False)
    status: Mapped[str]                 = mapped_column(SAEnum(WebsiteStatus), default=WebsiteStatus.PLANNING, nullable=False)
    industry: Mapped[str | None]        = mapped_column(String(100), nullable=True)
    description: Mapped[str | None]     = mapped_column(Text, nullable=True)
    brand_colors: Mapped[str | None]    = mapped_column(String(255), nullable=True)
    target_audience: Mapped[str | None] = mapped_column(Text, nullable=True)
    key_services: Mapped[str | None]    = mapped_column(Text, nullable=True)
    notes: Mapped[str | None]           = mapped_column(Text, nullable=True)

    # Progress
    progress: Mapped[int]    = mapped_column(Integer, default=0, nullable=False)
    pages_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Financials
    project_value: Mapped[float]       = mapped_column(default=0.0, nullable=False)
    monthly_maintenance: Mapped[float] = mapped_column(default=0.0, nullable=False)

    # AI
    ai_generated: Mapped[bool]     = mapped_column(Boolean, default=False, nullable=False)
    seo_score: Mapped[int | None]  = mapped_column(Integer, nullable=True)

    # Requirements intake
    requirements_sent: Mapped[bool]       = mapped_column(Boolean, default=False, nullable=False)
    requirements_submitted: Mapped[bool]  = mapped_column(Boolean, default=False, nullable=False)

    # Deployment
    deploy_platform: Mapped[str | None]  = mapped_column(String(50), nullable=True)
    netlify_site_id: Mapped[str | None]  = mapped_column(String(100), nullable=True)
    netlify_deploy_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    vercel_project_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    vercel_deploy_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    wp_site_url: Mapped[str | None]      = mapped_column(String(500), nullable=True)
    wp_username: Mapped[str | None]      = mapped_column(String(255), nullable=True)
    wp_app_password: Mapped[str | None]  = mapped_column(String(255), nullable=True)
    last_deployed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Timestamps
    deadline: Mapped[datetime | None]    = mapped_column(DateTime(timezone=True), nullable=True)
    launched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime]         = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime]         = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    pages: Mapped[list["WebsitePage"]] = relationship("WebsitePage", back_populates="website", cascade="all, delete-orphan")
    requirements: Mapped[list["WebsiteRequirements"]] = relationship("WebsiteRequirements", back_populates="website", cascade="all, delete-orphan")
    revisions: Mapped[list["WebsiteRevision"]] = relationship("WebsiteRevision", back_populates="website", cascade="all, delete-orphan")


class WebsitePage(Base):
    __tablename__ = "website_pages"

    id: Mapped[int]         = mapped_column(primary_key=True, index=True)
    website_id: Mapped[int] = mapped_column(Integer, ForeignKey("websites.id", ondelete="CASCADE"), nullable=False, index=True)

    name: Mapped[str]                     = mapped_column(String(100), nullable=False)
    slug: Mapped[str]                     = mapped_column(String(100), nullable=False)
    title: Mapped[str | None]             = mapped_column(String(255), nullable=True)
    meta_description: Mapped[str | None]  = mapped_column(Text, nullable=True)
    sections: Mapped[str | None]          = mapped_column(Text, nullable=True)
    is_published: Mapped[bool]            = mapped_column(Boolean, default=False, nullable=False)
    order: Mapped[int]                    = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    website: Mapped["Website"] = relationship("Website", back_populates="pages")


class WebsiteRequirements(Base):
    __tablename__ = "website_requirements"

    id: Mapped[int]          = mapped_column(primary_key=True, index=True)
    website_id: Mapped[int]  = mapped_column(Integer, ForeignKey("websites.id", ondelete="CASCADE"), nullable=False, index=True)
    intake_token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False,
                                               default=lambda: secrets.token_urlsafe(24))

    # Client info
    client_name: Mapped[str | None]    = mapped_column(String(255), nullable=True)
    client_email: Mapped[str | None]   = mapped_column(String(255), nullable=True)
    business_name: Mapped[str | None]  = mapped_column(String(255), nullable=True)

    # Requirements
    target_audience: Mapped[str | None]   = mapped_column(Text, nullable=True)
    design_style: Mapped[str | None]      = mapped_column(String(100), nullable=True)  # minimal/modern/classic/bold
    color_preferences: Mapped[str | None] = mapped_column(Text, nullable=True)
    competitor_urls: Mapped[str | None]   = mapped_column(Text, nullable=True)
    reference_sites: Mapped[str | None]   = mapped_column(Text, nullable=True)
    must_have_features: Mapped[str | None] = mapped_column(Text, nullable=True)
    pages_needed: Mapped[str | None]      = mapped_column(Text, nullable=True)  # JSON list
    content_ready: Mapped[bool]           = mapped_column(Boolean, default=False, nullable=False)
    logo_ready: Mapped[bool]              = mapped_column(Boolean, default=False, nullable=False)
    images_ready: Mapped[bool]            = mapped_column(Boolean, default=False, nullable=False)
    deadline_notes: Mapped[str | None]    = mapped_column(Text, nullable=True)
    special_requests: Mapped[str | None]  = mapped_column(Text, nullable=True)

    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime]          = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    website: Mapped["Website"] = relationship("Website", back_populates="requirements")


class WebsiteRevision(Base):
    __tablename__ = "website_revisions"

    id: Mapped[int]          = mapped_column(primary_key=True, index=True)
    website_id: Mapped[int]  = mapped_column(Integer, ForeignKey("websites.id", ondelete="CASCADE"), nullable=False, index=True)

    requested_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    page_name: Mapped[str | None]    = mapped_column(String(100), nullable=True)
    section_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str]         = mapped_column(Text, nullable=False)
    status: Mapped[str]              = mapped_column(SAEnum(RevisionStatus), default=RevisionStatus.PENDING, nullable=False)
    priority: Mapped[str]            = mapped_column(SAEnum(RevisionPriority), default=RevisionPriority.MEDIUM, nullable=False)
    agency_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    website: Mapped["Website"] = relationship("Website", back_populates="revisions")
