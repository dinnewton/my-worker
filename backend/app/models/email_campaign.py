from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Boolean, Integer, Float, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum


class CampaignStatus(str, enum.Enum):
    DRAFT     = "draft"
    SCHEDULED = "scheduled"
    SENDING   = "sending"
    SENT      = "sent"
    PAUSED    = "paused"
    ARCHIVED  = "archived"


class CampaignType(str, enum.Enum):
    NEWSLETTER    = "newsletter"
    PROMOTIONAL   = "promotional"
    WELCOME       = "welcome"
    FOLLOW_UP     = "follow_up"
    RE_ENGAGEMENT = "re_engagement"
    ANNOUNCEMENT  = "announcement"
    DRIP          = "drip"


class EmailCampaign(Base):
    __tablename__ = "email_campaigns"

    id: Mapped[int]   = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    preview_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    campaign_type: Mapped[str] = mapped_column(SAEnum(CampaignType), default=CampaignType.NEWSLETTER, nullable=False)
    status: Mapped[str]        = mapped_column(SAEnum(CampaignStatus), default=CampaignStatus.DRAFT, nullable=False)

    # Content
    html_content: Mapped[str | None]  = mapped_column(Text, nullable=True)
    plain_text: Mapped[str | None]    = mapped_column(Text, nullable=True)
    ai_generated: Mapped[bool]        = mapped_column(Boolean, default=False, nullable=False)

    # Audience
    recipient_list: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list of emails
    segment: Mapped[str | None]        = mapped_column(String(100), nullable=True)  # e.g. "leads", "clients"
    recipient_count: Mapped[int]       = mapped_column(Integer, default=0, nullable=False)

    # Analytics
    sent_count: Mapped[int]    = mapped_column(Integer, default=0, nullable=False)
    open_count: Mapped[int]    = mapped_column(Integer, default=0, nullable=False)
    click_count: Mapped[int]   = mapped_column(Integer, default=0, nullable=False)
    bounce_count: Mapped[int]  = mapped_column(Integer, default=0, nullable=False)
    unsubscribe_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    open_rate: Mapped[float]   = mapped_column(Float, default=0.0, nullable=False)
    click_rate: Mapped[float]  = mapped_column(Float, default=0.0, nullable=False)

    # Scheduling
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime | None]      = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime]          = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime]          = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc), nullable=False,
    )
