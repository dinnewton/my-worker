from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Boolean, Integer, Float, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
import enum


class CampaignChannel(str, enum.Enum):
    EMAIL        = "email"
    SOCIAL_MEDIA = "social_media"
    PPC          = "ppc"
    SEO          = "seo"
    CONTENT      = "content"
    INFLUENCER   = "influencer"
    SMS          = "sms"
    WHATSAPP     = "whatsapp"


class MarketingCampaignStatus(str, enum.Enum):
    DRAFT     = "draft"
    ACTIVE    = "active"
    PAUSED    = "paused"
    COMPLETE  = "complete"
    CANCELLED = "cancelled"


class MarketingCampaign(Base):
    __tablename__ = "marketing_campaigns"

    id: Mapped[int]   = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(SAEnum(MarketingCampaignStatus), default=MarketingCampaignStatus.DRAFT, nullable=False)

    # Channels & targeting
    channels: Mapped[str | None]      = mapped_column(Text, nullable=True)  # JSON list of CampaignChannel
    target_audience: Mapped[str | None] = mapped_column(Text, nullable=True)
    goals: Mapped[str | None]         = mapped_column(Text, nullable=True)  # JSON list

    # Budget & ROI
    budget: Mapped[float]    = mapped_column(Float, default=0.0, nullable=False)
    spent: Mapped[float]     = mapped_column(Float, default=0.0, nullable=False)
    revenue: Mapped[float]   = mapped_column(Float, default=0.0, nullable=False)
    roi: Mapped[float]       = mapped_column(Float, default=0.0, nullable=False)

    # KPIs (JSON)
    metrics: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON {impressions, clicks, conversions, leads}
    ai_strategy: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON strategy doc

    # Dates
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[datetime | None]   = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc), nullable=False,
    )
