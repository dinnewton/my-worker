from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Integer, Enum as SAEnum, Boolean, Float
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
import enum


class ContentType(str, enum.Enum):
    CAPTION = "caption"
    BLOG_POST = "blog_post"
    AD_COPY = "ad_copy"
    THREAD = "thread"
    LINKEDIN_ARTICLE = "linkedin_article"
    TIKTOK_SCRIPT = "tiktok_script"
    HASHTAGS = "hashtags"
    IMAGE_PROMPT = "image_prompt"


class Platform(str, enum.Enum):
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    LINKEDIN = "linkedin"
    TIKTOK = "tiktok"
    TWITTER = "twitter"
    ALL = "all"


class PostStatus(str, enum.Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHING = "publishing"
    PUBLISHED = "published"
    FAILED = "failed"


class ContentTone(str, enum.Enum):
    PROFESSIONAL = "professional"
    CASUAL = "casual"
    HUMOROUS = "humorous"
    INSPIRATIONAL = "inspirational"
    EDUCATIONAL = "educational"
    PERSUASIVE = "persuasive"


class ContentPost(Base):
    __tablename__ = "content_posts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(SAEnum(ContentType), nullable=False)
    platforms: Mapped[str] = mapped_column(Text, default='["instagram"]', nullable=False)  # JSON array
    status: Mapped[str] = mapped_column(SAEnum(PostStatus), default=PostStatus.DRAFT, nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    hashtags: Mapped[str | None] = mapped_column(Text, nullable=True)      # JSON array
    image_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    tone: Mapped[str | None] = mapped_column(SAEnum(ContentTone), nullable=True)
    topic: Mapped[str | None] = mapped_column(String(500), nullable=True)
    target_audience: Mapped[str | None] = mapped_column(String(255), nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    platform_post_ids: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON map
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Analytics
    likes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comments: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    shares: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reach: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    impressions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    clicks: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    engagement_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

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
