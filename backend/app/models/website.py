from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Boolean, Integer, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum


class WebsiteStatus(str, enum.Enum):
    PLANNING   = "planning"
    IN_PROGRESS = "in_progress"
    REVIEW     = "review"
    LIVE       = "live"
    MAINTENANCE = "maintenance"
    PAUSED     = "paused"


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


class Website(Base):
    __tablename__ = "websites"

    id: Mapped[int]          = mapped_column(primary_key=True, index=True)
    lead_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)

    # Identity
    name: Mapped[str]            = mapped_column(String(255), nullable=False)
    client_name: Mapped[str]     = mapped_column(String(255), nullable=False)
    client_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    domain: Mapped[str | None]   = mapped_column(String(255), nullable=True)
    live_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Project details
    template: Mapped[str]    = mapped_column(SAEnum(WebsiteTemplate), default=WebsiteTemplate.BUSINESS, nullable=False)
    status: Mapped[str]      = mapped_column(SAEnum(WebsiteStatus), default=WebsiteStatus.PLANNING, nullable=False)
    industry: Mapped[str | None]    = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    brand_colors: Mapped[str | None] = mapped_column(String(255), nullable=True)  # JSON ["#hex1","#hex2"]
    target_audience: Mapped[str | None] = mapped_column(Text, nullable=True)
    key_services: Mapped[str | None]    = mapped_column(Text, nullable=True)  # JSON list
    notes: Mapped[str | None]           = mapped_column(Text, nullable=True)

    # Progress
    progress: Mapped[int]  = mapped_column(Integer, default=0, nullable=False)  # 0-100
    pages_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Financials
    project_value: Mapped[float] = mapped_column(default=0.0, nullable=False)
    monthly_maintenance: Mapped[float] = mapped_column(default=0.0, nullable=False)

    # AI
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    seo_score: Mapped[int | None]  = mapped_column(Integer, nullable=True)

    # Timestamps
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    launched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    pages: Mapped[list["WebsitePage"]] = relationship("WebsitePage", back_populates="website", cascade="all, delete-orphan")


class WebsitePage(Base):
    __tablename__ = "website_pages"

    id: Mapped[int]         = mapped_column(primary_key=True, index=True)
    website_id: Mapped[int] = mapped_column(Integer, ForeignKey("websites.id", ondelete="CASCADE"), nullable=False, index=True)

    name: Mapped[str]       = mapped_column(String(100), nullable=False)   # e.g. "Home", "About"
    slug: Mapped[str]       = mapped_column(String(100), nullable=False)   # e.g. "/", "/about"
    title: Mapped[str | None]       = mapped_column(String(255), nullable=True)
    meta_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sections: Mapped[str | None]    = mapped_column(Text, nullable=True)   # JSON WebsiteSection[]
    is_published: Mapped[bool]      = mapped_column(Boolean, default=False, nullable=False)
    order: Mapped[int]              = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    website: Mapped["Website"] = relationship("Website", back_populates="pages")
