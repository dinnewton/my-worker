import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

from app.core.config import settings

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler(timezone="UTC")


async def _scan_for_leads() -> None:
    """Periodic lead scanning job."""
    from app.core.database import AsyncSessionLocal
    from app.models.activity import Activity, ActivityType, ActivityStatus

    logger.info("Running scheduled lead scan...")
    async with AsyncSessionLocal() as db:
        activity = Activity(
            type=ActivityType.AGENT_THINKING,
            status=ActivityStatus.RUNNING,
            title="Lead scan started",
            description="Agent is scanning for new potential leads",
            module="leads",
        )
        db.add(activity)
        await db.commit()

        from app.api.websocket import broadcast
        await broadcast(
            {
                "event": "activity",
                "data": {
                    "type": ActivityType.AGENT_THINKING,
                    "status": ActivityStatus.RUNNING,
                    "title": "Lead scan started",
                    "module": "leads",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
            }
        )


async def _publish_scheduled_post() -> None:
    """Publish a scheduled social media post."""
    from app.core.database import AsyncSessionLocal
    from app.models.activity import Activity, ActivityType, ActivityStatus
    from app.services.ai_agent import generate_social_post

    topics = [
        "How AI is transforming digital marketing in 2025",
        "5 web design trends every business needs",
        "Why your business needs a content strategy today",
        "The ROI of professional SEO services",
        "How automation saves marketing teams 10+ hours/week",
    ]
    import random
    topic = random.choice(topics)

    logger.info(f"Generating scheduled post: {topic}")
    async with AsyncSessionLocal() as db:
        try:
            content = await generate_social_post(topic)
            activity = Activity(
                type=ActivityType.POST_PUBLISHED,
                status=ActivityStatus.SUCCESS,
                title=f"Post published: {topic[:60]}",
                description=content[:300],
                module="content",
            )
            db.add(activity)
            await db.commit()

            from app.api.websocket import broadcast
            await broadcast(
                {
                    "event": "activity",
                    "data": {
                        "type": ActivityType.POST_PUBLISHED,
                        "status": ActivityStatus.SUCCESS,
                        "title": f"Post published: {topic[:60]}",
                        "module": "content",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    },
                }
            )
        except Exception as e:
            logger.error(f"Scheduled post failed: {e}")


async def _take_kpi_snapshot() -> None:
    """Capture hourly KPI snapshot."""
    from app.core.database import AsyncSessionLocal
    from app.models.kpi import KPISnapshot
    from app.models.lead import Lead, LeadStatus
    from app.models.proposal import Proposal, ProposalStatus
    from app.models.activity import Activity, ActivityType
    from sqlalchemy import func, select

    async with AsyncSessionLocal() as db:
        active_leads = await db.scalar(
            select(func.count(Lead.id)).where(
                Lead.status.in_([LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED])
            )
        )
        posts = await db.scalar(
            select(func.count(Activity.id)).where(
                Activity.type == ActivityType.POST_PUBLISHED
            )
        )
        proposals_sent = await db.scalar(
            select(func.count(Proposal.id)).where(
                Proposal.status.in_([ProposalStatus.SENT, ProposalStatus.VIEWED, ProposalStatus.ACCEPTED])
            )
        )
        revenue = await db.scalar(
            select(func.coalesce(func.sum(Proposal.value), 0.0)).where(
                Proposal.status == ProposalStatus.ACCEPTED
            )
        )

        snapshot = KPISnapshot(
            active_leads=active_leads or 0,
            posts_published=posts or 0,
            proposals_sent=proposals_sent or 0,
            sites_built=0,
            revenue=float(revenue or 0.0),
        )
        db.add(snapshot)
        await db.commit()


async def _auto_publish_scheduled_posts() -> None:
    """Publish content posts whose scheduled_at time has passed."""
    import json
    from app.core.database import AsyncSessionLocal
    from app.models.content import ContentPost, PostStatus
    from app.services.social_media import publish_to_platform
    from app.models.activity import Activity, ActivityType, ActivityStatus
    from sqlalchemy import select, and_

    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ContentPost).where(
                and_(
                    ContentPost.status == PostStatus.SCHEDULED,
                    ContentPost.scheduled_at <= now,
                )
            )
        )
        posts = result.scalars().all()

        for post in posts:
            post.status = PostStatus.PUBLISHING
            await db.commit()
            try:
                platforms = json.loads(post.platforms or '["instagram"]')
                platform_ids: dict[str, str] = {}
                all_ok = True
                for platform in platforms:
                    res = await publish_to_platform(platform, post.content, post.image_url)
                    platform_ids[platform] = res.post_id or ""
                    if not res.success:
                        all_ok = False

                post.status = PostStatus.PUBLISHED if all_ok else PostStatus.FAILED
                post.published_at = datetime.now(timezone.utc)
                post.platform_post_ids = json.dumps(platform_ids)

                activity = Activity(
                    type=ActivityType.POST_PUBLISHED,
                    status=ActivityStatus.SUCCESS if all_ok else ActivityStatus.FAILED,
                    title=f"Scheduled post published: {post.title[:55]}",
                    description=f"Auto-published to {', '.join(platforms)}",
                    module="content",
                )
                db.add(activity)
                await db.commit()

                from app.api.websocket import broadcast
                await broadcast({
                    "event": "activity",
                    "data": {
                        "type": ActivityType.POST_PUBLISHED,
                        "status": "success" if all_ok else "failed",
                        "title": f"Scheduled post published: {post.title[:55]}",
                        "module": "content",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    },
                })
            except Exception as e:
                post.status = PostStatus.FAILED
                post.error_message = str(e)
                await db.commit()
                logger.error(f"Auto-publish failed for post {post.id}: {e}")


def start_scheduler() -> None:
    scheduler.add_job(
        _scan_for_leads,
        trigger=IntervalTrigger(minutes=settings.LEAD_SCAN_INTERVAL_MINUTES),
        id="lead_scan",
        replace_existing=True,
        misfire_grace_time=300,
    )
    scheduler.add_job(
        _publish_scheduled_post,
        trigger=CronTrigger(
            hour=settings.POST_SCHEDULE_HOUR,
            minute=settings.POST_SCHEDULE_MINUTE,
        ),
        id="scheduled_post",
        replace_existing=True,
        misfire_grace_time=600,
    )
    scheduler.add_job(
        _take_kpi_snapshot,
        trigger=IntervalTrigger(hours=1),
        id="kpi_snapshot",
        replace_existing=True,
        misfire_grace_time=120,
    )
    scheduler.add_job(
        _auto_publish_scheduled_posts,
        trigger=IntervalTrigger(minutes=5),
        id="auto_publish",
        replace_existing=True,
        misfire_grace_time=300,
    )
    scheduler.start()
    logger.info("Scheduler started with all jobs.")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped.")
