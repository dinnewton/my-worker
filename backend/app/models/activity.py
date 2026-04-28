from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
import enum


class ActivityType(str, enum.Enum):
    LEAD_FOUND = "lead_found"
    POST_PUBLISHED = "post_published"
    PROPOSAL_SENT = "proposal_sent"
    SITE_BUILT = "site_built"
    EMAIL_SENT = "email_sent"
    SEO_AUDIT = "seo_audit"
    CONTENT_CREATED = "content_created"
    CAMPAIGN_LAUNCHED = "campaign_launched"
    AGENT_THINKING = "agent_thinking"
    SYSTEM = "system"


class ActivityStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    type: Mapped[str] = mapped_column(SAEnum(ActivityType), nullable=False)
    status: Mapped[str] = mapped_column(
        SAEnum(ActivityStatus), default=ActivityStatus.SUCCESS, nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    module: Mapped[str | None] = mapped_column(String(100), nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
