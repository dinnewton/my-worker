"""
Social media platform integrations.

Each client gracefully degrades when credentials are not configured — it logs a
warning and returns a mock success response so the rest of the pipeline keeps
running during development / demo mode.
"""
import json
import logging
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class PublishResult:
    success: bool
    platform: str
    post_id: str | None = None
    url: str | None = None
    error: str | None = None


def _mock(platform: str, reason: str) -> PublishResult:
    logger.warning(f"[{platform}] Running in mock mode: {reason}")
    return PublishResult(success=True, platform=platform, post_id=f"mock_{platform}_001")


# ──────────────────────────────────────────────────────────────────────────────
# Meta (Facebook + Instagram)
# ──────────────────────────────────────────────────────────────────────────────

class MetaClient:
    BASE = "https://graph.facebook.com/v21.0"

    def __init__(self) -> None:
        self.page_access_token: str = getattr(settings, "META_PAGE_ACCESS_TOKEN", "")
        self.page_id: str = getattr(settings, "META_PAGE_ID", "")
        self.ig_user_id: str = getattr(settings, "META_IG_USER_ID", "")

    def _ready(self) -> bool:
        return bool(self.page_access_token and self.page_id)

    def _ig_ready(self) -> bool:
        return bool(self.page_access_token and self.ig_user_id)

    async def post_facebook(self, message: str, link: str | None = None) -> PublishResult:
        if not self._ready():
            return _mock("facebook", "META_PAGE_ACCESS_TOKEN or META_PAGE_ID not set")
        payload: dict[str, Any] = {"message": message, "access_token": self.page_access_token}
        if link:
            payload["link"] = link
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{self.BASE}/{self.page_id}/feed", json=payload)
            data = resp.json()
            if resp.is_error or "error" in data:
                return PublishResult(success=False, platform="facebook", error=str(data))
            post_id = data.get("id")
            return PublishResult(
                success=True, platform="facebook", post_id=post_id,
                url=f"https://facebook.com/{post_id}"
            )

    async def post_instagram(self, caption: str, image_url: str | None = None) -> PublishResult:
        if not self._ig_ready():
            return _mock("instagram", "META_IG_USER_ID not set")
        async with httpx.AsyncClient(timeout=30) as client:
            # Step 1: create container
            container_payload: dict[str, Any] = {
                "caption": caption,
                "access_token": self.page_access_token,
            }
            if image_url:
                container_payload["image_url"] = image_url
            else:
                container_payload["media_type"] = "TEXT"

            r1 = await client.post(f"{self.BASE}/{self.ig_user_id}/media", json=container_payload)
            d1 = r1.json()
            if r1.is_error or "error" in d1:
                return PublishResult(success=False, platform="instagram", error=str(d1))
            container_id = d1["id"]

            # Step 2: publish
            r2 = await client.post(
                f"{self.BASE}/{self.ig_user_id}/media_publish",
                json={"creation_id": container_id, "access_token": self.page_access_token},
            )
            d2 = r2.json()
            if r2.is_error or "error" in d2:
                return PublishResult(success=False, platform="instagram", error=str(d2))
            return PublishResult(success=True, platform="instagram", post_id=d2.get("id"))

    async def get_post_insights(self, post_id: str) -> dict:
        if not self._ready():
            return {}
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.BASE}/{post_id}/insights",
                params={
                    "metric": "post_impressions,post_reach,post_engaged_users",
                    "access_token": self.page_access_token,
                },
            )
            return resp.json() if resp.is_success else {}


# ──────────────────────────────────────────────────────────────────────────────
# LinkedIn
# ──────────────────────────────────────────────────────────────────────────────

class LinkedInClient:
    BASE = "https://api.linkedin.com/v2"

    def __init__(self) -> None:
        self.access_token: str = getattr(settings, "LINKEDIN_ACCESS_TOKEN", "")
        self.person_urn: str = getattr(settings, "LINKEDIN_PERSON_URN", "")

    def _ready(self) -> bool:
        return bool(self.access_token and self.person_urn)

    async def post_update(self, text: str, visibility: str = "PUBLIC") -> PublishResult:
        if not self._ready():
            return _mock("linkedin", "LINKEDIN_ACCESS_TOKEN or LINKEDIN_PERSON_URN not set")
        payload = {
            "author": f"urn:li:person:{self.person_urn}",
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": text},
                    "shareMediaCategory": "NONE",
                }
            },
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": visibility},
        }
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{self.BASE}/ugcPosts", json=payload, headers=headers)
            if resp.is_error:
                return PublishResult(success=False, platform="linkedin", error=resp.text)
            post_id = resp.headers.get("x-restli-id", "")
            return PublishResult(success=True, platform="linkedin", post_id=post_id)


# ──────────────────────────────────────────────────────────────────────────────
# TikTok
# ──────────────────────────────────────────────────────────────────────────────

class TikTokClient:
    BASE = "https://open.tiktokapis.com/v2"

    def __init__(self) -> None:
        self.access_token: str = getattr(settings, "TIKTOK_ACCESS_TOKEN", "")

    def _ready(self) -> bool:
        return bool(self.access_token)

    async def post_photo(self, caption: str, image_url: str | None = None) -> PublishResult:
        if not self._ready():
            return _mock("tiktok", "TIKTOK_ACCESS_TOKEN not set")
        headers = {"Authorization": f"Bearer {self.access_token}", "Content-Type": "application/json"}
        payload = {
            "post_info": {"title": caption[:150], "privacy_level": "PUBLIC_TO_EVERYONE"},
            "source_info": {"source": "PULL_FROM_URL", "photo_cover_index": 0,
                            "photo_images": [image_url] if image_url else []},
            "media_type": "PHOTO",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{self.BASE}/post/publish/content/init/", json=payload, headers=headers)
            d = resp.json()
            if resp.is_error or d.get("error", {}).get("code") != "ok":
                return PublishResult(success=False, platform="tiktok", error=str(d))
            return PublishResult(success=True, platform="tiktok", post_id=d.get("data", {}).get("publish_id"))


# ──────────────────────────────────────────────────────────────────────────────
# Twitter / X
# ──────────────────────────────────────────────────────────────────────────────

class TwitterClient:
    BASE = "https://api.twitter.com/2"

    def __init__(self) -> None:
        self.bearer_token: str = getattr(settings, "TWITTER_BEARER_TOKEN", "")
        self.api_key: str = getattr(settings, "TWITTER_API_KEY", "")
        self.api_secret: str = getattr(settings, "TWITTER_API_SECRET", "")
        self.access_token: str = getattr(settings, "TWITTER_ACCESS_TOKEN", "")
        self.access_secret: str = getattr(settings, "TWITTER_ACCESS_TOKEN_SECRET", "")

    def _ready(self) -> bool:
        return bool(self.access_token and self.access_secret and self.api_key and self.api_secret)

    async def create_tweet(self, text: str) -> PublishResult:
        if not self._ready():
            return _mock("twitter", "Twitter OAuth credentials not set")
        try:
            import tweepy.asynchronous as atweepy  # optional dependency
            client = atweepy.AsyncClient(
                consumer_key=self.api_key,
                consumer_secret=self.api_secret,
                access_token=self.access_token,
                access_token_secret=self.access_secret,
            )
            resp = await client.create_tweet(text=text[:280])
            tweet_id = resp.data["id"]
            return PublishResult(success=True, platform="twitter", post_id=tweet_id,
                                 url=f"https://twitter.com/i/web/status/{tweet_id}")
        except ImportError:
            return _mock("twitter", "tweepy not installed")
        except Exception as e:
            return PublishResult(success=False, platform="twitter", error=str(e))

    async def create_thread(self, tweets: list[str]) -> PublishResult:
        if not self._ready():
            return _mock("twitter", "Twitter OAuth credentials not set")
        try:
            import tweepy.asynchronous as atweepy
            client = atweepy.AsyncClient(
                consumer_key=self.api_key, consumer_secret=self.api_secret,
                access_token=self.access_token, access_token_secret=self.access_secret,
            )
            reply_to: str | None = None
            first_id: str | None = None
            for tweet_text in tweets:
                kwargs: dict[str, Any] = {"text": tweet_text[:280]}
                if reply_to:
                    kwargs["in_reply_to_tweet_id"] = reply_to
                resp = await client.create_tweet(**kwargs)
                tweet_id = resp.data["id"]
                if first_id is None:
                    first_id = tweet_id
                reply_to = tweet_id
            return PublishResult(success=True, platform="twitter", post_id=first_id)
        except ImportError:
            return _mock("twitter", "tweepy not installed")
        except Exception as e:
            return PublishResult(success=False, platform="twitter", error=str(e))


# ──────────────────────────────────────────────────────────────────────────────
# Unified publish dispatcher
# ──────────────────────────────────────────────────────────────────────────────

_meta = MetaClient()
_linkedin = LinkedInClient()
_tiktok = TikTokClient()
_twitter = TwitterClient()


async def publish_to_platform(
    platform: str,
    content: str,
    image_url: str | None = None,
    thread_tweets: list[str] | None = None,
) -> PublishResult:
    try:
        if platform == "facebook":
            return await _meta.post_facebook(content, link=image_url)
        elif platform == "instagram":
            return await _meta.post_instagram(content, image_url=image_url)
        elif platform == "linkedin":
            return await _linkedin.post_update(content)
        elif platform == "tiktok":
            return await _tiktok.post_photo(content, image_url=image_url)
        elif platform == "twitter":
            if thread_tweets and len(thread_tweets) > 1:
                return await _twitter.create_thread(thread_tweets)
            return await _twitter.create_tweet(content)
        else:
            return PublishResult(success=False, platform=platform, error=f"Unknown platform: {platform}")
    except Exception as e:
        logger.exception(f"Publish to {platform} failed")
        return PublishResult(success=False, platform=platform, error=str(e))


async def fetch_analytics(platform: str, post_id: str) -> dict:
    """Fetch engagement analytics for a published post."""
    try:
        if platform in ("facebook", "instagram"):
            return await _meta.get_post_insights(post_id)
    except Exception as e:
        logger.warning(f"Analytics fetch failed for {platform}/{post_id}: {e}")
    return {}
