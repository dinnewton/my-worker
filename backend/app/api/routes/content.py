import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.core.database import get_db
from app.models.content import ContentPost, PostStatus, ContentType, Platform
from app.models.activity import Activity, ActivityType, ActivityStatus
from app.schemas.content import (
    ContentPostOut, ContentPostCreate, ContentPostUpdate,
    ContentGenerateRequest, ContentGenerateResponse,
    SchedulePostRequest, ContentAnalyticsSummary, ImagePromptRequest,
)
from app.services import content_service
from app.services.social_media import publish_to_platform
from app.api.websocket import broadcast

router = APIRouter(prefix="/content", tags=["content"])


# ──────────────────────────────────────────────────────────────────────────────
# AI Generation endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=ContentGenerateResponse)
async def generate_content(payload: ContentGenerateRequest):
    platform = payload.platforms[0].value if payload.platforms else "instagram"
    tone = payload.tone.value

    if payload.content_type == ContentType.BLOG_POST:
        result = await content_service.generate_blog_post(
            payload.topic, payload.keywords, tone, payload.target_audience
        )
        content_text = result["content"]
    elif payload.content_type == ContentType.AD_COPY:
        result = await content_service.generate_ad_copy(
            payload.topic, payload.target_audience or "general audience",
            platform=platform, tone=tone,
        )
        content_text = json.dumps(result, indent=2)
    elif payload.content_type == ContentType.THREAD:
        tweets = await content_service.generate_thread(payload.topic)
        content_text = "\n\n".join(tweets)
    elif payload.content_type == ContentType.LINKEDIN_ARTICLE:
        result = await content_service.generate_linkedin_article(payload.topic)
        content_text = result.get("content", "")
    elif payload.content_type == ContentType.TIKTOK_SCRIPT:
        result = await content_service.generate_tiktok_script(payload.topic)
        content_text = result.get("script", "")
    elif payload.content_type == ContentType.HASHTAGS:
        tags = await content_service.generate_hashtags(payload.topic, platform, payload.num_hashtags)
        content_text = " ".join(tags)
    else:
        content_text = await content_service.generate_caption(
            payload.topic, platform, tone,
            payload.target_audience, payload.keywords, payload.additional_context,
        )

    hashtags = await content_service.generate_hashtags(payload.topic, platform, payload.num_hashtags)

    image_prompt_data: dict | None = None
    if payload.generate_image_prompt:
        image_prompt_data = await content_service.generate_image_prompt(payload.topic, platform)

    adaptations: dict[str, str] = {}
    if len(payload.platforms) > 1:
        platform_names = [p.value for p in payload.platforms[1:]]
        adaptations = await content_service.generate_platform_adaptations(content_text, platform_names)

    return ContentGenerateResponse(
        content=content_text,
        hashtags=hashtags,
        image_prompt=image_prompt_data.get("dalle3") if image_prompt_data else None,
        platform_adaptations=adaptations,
    )


@router.post("/generate/image-prompt")
async def generate_image_prompt(payload: ImagePromptRequest):
    return await content_service.generate_image_prompt(
        payload.topic, payload.platform.value, payload.style, payload.mood, payload.color_palette
    )


@router.get("/optimal-time/{platform}")
async def get_optimal_time(platform: str):
    t = content_service.get_next_optimal_time(platform)
    return {"platform": platform, "optimal_time": t.isoformat()}


# ──────────────────────────────────────────────────────────────────────────────
# CRUD
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/posts", response_model=list[ContentPostOut])
async def list_posts(
    status: str | None = None,
    platform: str | None = None,
    limit: int = 50,
    skip: int = 0,
    db: AsyncSession = Depends(get_db),
):
    q = select(ContentPost).order_by(ContentPost.created_at.desc())
    if status:
        q = q.where(ContentPost.status == status)
    if platform and platform != "all":
        q = q.where(ContentPost.platforms.contains(platform))
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/posts", response_model=ContentPostOut)
async def create_post(payload: ContentPostCreate, db: AsyncSession = Depends(get_db)):
    post = ContentPost(
        title=payload.title,
        content_type=payload.content_type,
        platforms=json.dumps([p.value for p in payload.platforms]),
        content=payload.content,
        hashtags=json.dumps(payload.hashtags) if payload.hashtags else None,
        image_prompt=payload.image_prompt,
        tone=payload.tone,
        topic=payload.topic,
        target_audience=payload.target_audience,
        scheduled_at=payload.scheduled_at,
        status=PostStatus.SCHEDULED if payload.scheduled_at else PostStatus.DRAFT,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


@router.get("/posts/{post_id}", response_model=ContentPostOut)
async def get_post(post_id: int, db: AsyncSession = Depends(get_db)):
    post = await db.get(ContentPost, post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    return post


@router.patch("/posts/{post_id}", response_model=ContentPostOut)
async def update_post(post_id: int, payload: ContentPostUpdate, db: AsyncSession = Depends(get_db)):
    post = await db.get(ContentPost, post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    data = payload.model_dump(exclude_unset=True)
    if "hashtags" in data and data["hashtags"] is not None:
        data["hashtags"] = json.dumps(data["hashtags"])
    for k, v in data.items():
        setattr(post, k, v)
    if payload.scheduled_at and post.status == PostStatus.DRAFT:
        post.status = PostStatus.SCHEDULED
    await db.commit()
    await db.refresh(post)
    return post


@router.delete("/posts/{post_id}")
async def delete_post(post_id: int, db: AsyncSession = Depends(get_db)):
    post = await db.get(ContentPost, post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    await db.delete(post)
    await db.commit()
    return {"ok": True}


# ──────────────────────────────────────────────────────────────────────────────
# Scheduling & Publishing
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/posts/{post_id}/schedule")
async def schedule_post(post_id: int, payload: SchedulePostRequest, db: AsyncSession = Depends(get_db)):
    post = await db.get(ContentPost, post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    post.scheduled_at = payload.scheduled_at
    post.status = PostStatus.SCHEDULED
    if payload.platforms:
        post.platforms = json.dumps([p.value for p in payload.platforms])
    await db.commit()
    await db.refresh(post)
    return post


@router.post("/posts/{post_id}/publish")
async def publish_post_now(post_id: int, db: AsyncSession = Depends(get_db)):
    post = await db.get(ContentPost, post_id)
    if not post:
        raise HTTPException(404, "Post not found")

    post.status = PostStatus.PUBLISHING
    await db.commit()

    platforms = json.loads(post.platforms or '["instagram"]')
    results: dict[str, str] = {}
    all_ok = True

    for platform in platforms:
        result = await publish_to_platform(
            platform=platform,
            content=post.content,
            image_url=post.image_url,
        )
        results[platform] = result.post_id or "unknown"
        if not result.success:
            all_ok = False

    post.status = PostStatus.PUBLISHED if all_ok else PostStatus.FAILED
    post.published_at = datetime.now(timezone.utc)
    post.platform_post_ids = json.dumps(results)

    activity = Activity(
        type=ActivityType.POST_PUBLISHED,
        status=ActivityStatus.SUCCESS if all_ok else ActivityStatus.FAILED,
        title=f"Post {'published' if all_ok else 'failed'}: {post.title[:60]}",
        description=f"Published to {', '.join(platforms)}",
        module="content",
    )
    db.add(activity)
    await db.commit()

    await broadcast({
        "event": "activity",
        "data": {
            "type": ActivityType.POST_PUBLISHED,
            "status": "success" if all_ok else "failed",
            "title": f"Post published: {post.title[:60]}",
            "module": "content",
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    })
    return {"success": all_ok, "platform_results": results}


# ──────────────────────────────────────────────────────────────────────────────
# Calendar
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/calendar")
async def get_calendar(
    year: int, month: int, db: AsyncSession = Depends(get_db)
):
    from calendar import monthrange
    _, days_in_month = monthrange(year, month)
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    end = datetime(year, month, days_in_month, 23, 59, 59, tzinfo=timezone.utc)

    result = await db.execute(
        select(ContentPost).where(
            and_(
                ContentPost.scheduled_at >= start,
                ContentPost.scheduled_at <= end,
            )
        ).order_by(ContentPost.scheduled_at)
    )
    posts = result.scalars().all()

    calendar_data: dict[int, list] = {d: [] for d in range(1, days_in_month + 1)}
    for post in posts:
        if post.scheduled_at:
            day = post.scheduled_at.day
            calendar_data[day].append({
                "id": post.id,
                "title": post.title,
                "status": post.status,
                "platforms": json.loads(post.platforms or "[]"),
                "content_type": post.content_type,
                "scheduled_at": post.scheduled_at.isoformat(),
            })
    return {"year": year, "month": month, "days": calendar_data}


# ──────────────────────────────────────────────────────────────────────────────
# Analytics
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/analytics", response_model=ContentAnalyticsSummary)
async def get_analytics(db: AsyncSession = Depends(get_db)):
    total = await db.scalar(select(func.count(ContentPost.id)))
    published = await db.scalar(select(func.count(ContentPost.id)).where(ContentPost.status == PostStatus.PUBLISHED))
    scheduled = await db.scalar(select(func.count(ContentPost.id)).where(ContentPost.status == PostStatus.SCHEDULED))
    draft = await db.scalar(select(func.count(ContentPost.id)).where(ContentPost.status == PostStatus.DRAFT))

    reach_row = await db.execute(
        select(
            func.coalesce(func.sum(ContentPost.reach), 0),
            func.coalesce(func.sum(ContentPost.impressions), 0),
            func.coalesce(func.sum(ContentPost.likes + ContentPost.comments + ContentPost.shares), 0),
            func.coalesce(func.avg(ContentPost.engagement_rate), 0.0),
        )
    )
    total_reach, total_impr, total_eng, avg_eng = reach_row.one()

    top_result = await db.execute(
        select(ContentPost)
        .where(ContentPost.status == PostStatus.PUBLISHED)
        .order_by((ContentPost.likes + ContentPost.comments + ContentPost.shares).desc())
        .limit(5)
    )
    top_posts = top_result.scalars().all()

    return ContentAnalyticsSummary(
        total_posts=total or 0,
        published_posts=published or 0,
        scheduled_posts=scheduled or 0,
        draft_posts=draft or 0,
        total_reach=int(total_reach or 0),
        total_impressions=int(total_impr or 0),
        total_engagement=int(total_eng or 0),
        avg_engagement_rate=float(avg_eng or 0.0),
        top_posts=top_posts,
    )
