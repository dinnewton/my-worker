from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Float, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
import enum


class LeadStatus(str, enum.Enum):
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    PROPOSAL_SENT = "proposal_sent"
    WON = "won"
    LOST = "lost"


class LeadSource(str, enum.Enum):
    WEB_SCRAPE = "web_scrape"
    REFERRAL = "referral"
    SOCIAL_MEDIA = "social_media"
    EMAIL_CAMPAIGN = "email_campaign"
    MANUAL = "manual"
    WHATSAPP = "whatsapp"
    WEBSITE_FORM = "website_form"
    LINKEDIN = "linkedin"
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    COLD_OUTREACH = "cold_outreach"


class LeadPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(
        SAEnum(LeadStatus), default=LeadStatus.NEW, nullable=False, index=True
    )
    source: Mapped[str] = mapped_column(
        SAEnum(LeadSource), default=LeadSource.MANUAL, nullable=False
    )
    priority: Mapped[str] = mapped_column(
        SAEnum(LeadPriority), default=LeadPriority.MEDIUM, nullable=False
    )
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    deal_value: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)          # JSON array
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_next_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_key_factors: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    assigned_to: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_contact_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_followup_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
