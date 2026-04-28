from datetime import datetime
from pydantic import BaseModel, field_validator
from app.models.content import ContentType, Platform, PostStatus, ContentTone
import json


class ContentPostOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    title: str
    content_type: ContentType
    platforms: str
    status: PostStatus
    content: str
    hashtags: str | None
    image_prompt: str | None
    image_url: str | None
    ai_generated: bool
    tone: ContentTone | None
    topic: str | None
    target_audience: str | None
    scheduled_at: datetime | None
    published_at: datetime | None
    likes: int
    comments: int
    shares: int
    reach: int
    impressions: int
    clicks: int
    engagement_rate: float
    created_at: datetime
    updated_at: datetime


class ContentGenerateRequest(BaseModel):
    content_type: ContentType
    topic: str
    platforms: list[Platform] = [Platform.INSTAGRAM]
    tone: ContentTone = ContentTone.PROFESSIONAL
    target_audience: str | None = None
    keywords: list[str] = []
    additional_context: str | None = None
    generate_image_prompt: bool = True
    num_hashtags: int = 20


class ContentGenerateResponse(BaseModel):
    content: str
    hashtags: list[str] = []
    image_prompt: str | None = None
    alternative_versions: list[str] = []
    platform_adaptations: dict[str, str] = {}


class ContentPostCreate(BaseModel):
    title: str
    content_type: ContentType
    platforms: list[Platform] = [Platform.INSTAGRAM]
    content: str
    hashtags: list[str] = []
    image_prompt: str | None = None
    tone: ContentTone | None = None
    topic: str | None = None
    target_audience: str | None = None
    scheduled_at: datetime | None = None


class ContentPostUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    hashtags: list[str] | None = None
    image_prompt: str | None = None
    scheduled_at: datetime | None = None
    status: PostStatus | None = None


class SchedulePostRequest(BaseModel):
    post_id: int
    scheduled_at: datetime
    platforms: list[Platform] | None = None


class ContentAnalyticsSummary(BaseModel):
    total_posts: int = 0
    published_posts: int = 0
    scheduled_posts: int = 0
    draft_posts: int = 0
    total_reach: int = 0
    total_impressions: int = 0
    total_engagement: int = 0
    avg_engagement_rate: float = 0.0
    platform_breakdown: dict[str, int] = {}
    top_posts: list[ContentPostOut] = []


class ImagePromptRequest(BaseModel):
    topic: str
    style: str = "photorealistic"
    platform: Platform = Platform.INSTAGRAM
    mood: str | None = None
    color_palette: str | None = None
