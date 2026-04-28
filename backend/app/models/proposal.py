from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Float, Integer, Boolean, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum
import secrets


class ProposalStatus(str, enum.Enum):
    DRAFT    = "draft"
    SENT     = "sent"
    VIEWED   = "viewed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED  = "expired"


class ProposalTemplate(str, enum.Enum):
    DIGITAL_MARKETING = "digital_marketing"
    WEB_DEVELOPMENT   = "web_development"
    SEO               = "seo"
    SOCIAL_MEDIA      = "social_media"
    EMAIL_MARKETING   = "email_marketing"
    CONTENT_CREATION  = "content_creation"
    FULL_SERVICE      = "full_service"
    CUSTOM            = "custom"


class Proposal(Base):
    __tablename__ = "proposals"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    lead_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Core fields
    title: Mapped[str]          = mapped_column(String(255), nullable=False)
    client_name: Mapped[str]    = mapped_column(String(255), nullable=False)
    client_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_company: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Template & status
    template_type: Mapped[str] = mapped_column(
        SAEnum(ProposalTemplate), default=ProposalTemplate.CUSTOM, nullable=False
    )
    status: Mapped[str] = mapped_column(
        SAEnum(ProposalStatus), default=ProposalStatus.DRAFT, nullable=False
    )

    # Content (all stored as text/JSON)
    cover_letter: Mapped[str | None]  = mapped_column(Text, nullable=True)
    services: Mapped[str | None]      = mapped_column(Text, nullable=True)   # JSON list
    sections: Mapped[str | None]      = mapped_column(Text, nullable=True)   # JSON sections
    timeline: Mapped[str | None]      = mapped_column(Text, nullable=True)   # JSON milestones
    deliverables: Mapped[str | None]  = mapped_column(Text, nullable=True)   # JSON list
    pricing_breakdown: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON

    # Financials
    value: Mapped[float]          = mapped_column(Float, default=0.0, nullable=False)
    monthly_retainer: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    setup_fee: Mapped[float]      = mapped_column(Float, default=0.0, nullable=False)
    timeline_weeks: Mapped[int]   = mapped_column(Integer, default=4, nullable=False)

    # Notes & version
    notes: Mapped[str | None]     = mapped_column(Text, nullable=True)
    version: Mapped[int]          = mapped_column(Integer, default=1, nullable=False)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # AI metadata
    ai_generated: Mapped[bool]    = mapped_column(Boolean, default=True, nullable=False)
    ai_win_tips: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON tips

    # Sharing
    share_token: Mapped[str] = mapped_column(
        String(64), default=lambda: secrets.token_urlsafe(32), unique=True, index=True
    )
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # E-signature
    signature_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    signature_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    sent_at: Mapped[datetime | None]     = mapped_column(DateTime(timezone=True), nullable=True)
    viewed_at: Mapped[datetime | None]   = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
