import json
import re
from datetime import datetime, timezone, timedelta
from app.services.ai_agent import get_client
from app.core.config import settings
from app.models.content import Platform, ContentTone

# Platform-specific constraints and best practices
PLATFORM_GUIDELINES = {
    "instagram": {
        "max_chars": 2200,
        "optimal_chars": 150,
        "max_hashtags": 30,
        "best_hashtags": "5 in caption, 25 in first comment",
        "tips": "Use emojis, strong visual hook, CTA at end, line breaks for readability",
        "aspect_ratio": "1:1 or 4:5 for feed, 9:16 for stories/reels",
    },
    "facebook": {
        "max_chars": 63206,
        "optimal_chars": 80,
        "max_hashtags": 10,
        "best_hashtags": "2-3 relevant hashtags",
        "tips": "Ask questions to drive comments, use native video, tag people/pages, share links with preview",
        "aspect_ratio": "1.91:1 for feed, 1:1 for square",
    },
    "linkedin": {
        "max_chars": 3000,
        "optimal_chars": 1300,
        "max_hashtags": 5,
        "best_hashtags": "3-5 industry hashtags",
        "tips": "Professional insights, data & stats, personal story with lesson, end with question, no external links in post body",
        "aspect_ratio": "1.91:1 or 1:1",
    },
    "tiktok": {
        "max_chars": 2200,
        "optimal_chars": 150,
        "max_hashtags": 8,
        "best_hashtags": "3-5 trending + niche hashtags",
        "tips": "Hook in first 3 seconds, trending sounds, text overlay, duet/stitch friendly",
        "aspect_ratio": "9:16 vertical",
    },
    "twitter": {
        "max_chars": 280,
        "optimal_chars": 240,
        "max_hashtags": 2,
        "best_hashtags": "1-2 max",
        "tips": "Bold opening statement, thread for long content, polls drive engagement, no more than 2 hashtags",
        "aspect_ratio": "16:9 or 1:1",
    },
}

OPTIMAL_POST_TIMES = {
    "instagram": [(8, 0), (12, 0), (19, 0)],
    "facebook":  [(9, 0), (13, 0), (15, 0)],
    "linkedin":  [(8, 0), (12, 0), (17, 0)],
    "tiktok":    [(6, 0), (14, 0), (21, 0)],
    "twitter":   [(8, 0), (12, 0), (17, 0)],
}

SYSTEM_PROMPT = """You are MyWorker Content AI — a world-class social media strategist and copywriter.
You create high-converting, platform-native content that drives real engagement.
Always produce content that is immediately ready to publish — no placeholders, no [brackets], no generic filler.
Every piece of content should hook attention, deliver value, and drive action."""


async def _run(prompt: str, max_tokens: int = 2048) -> str:
    client = get_client()
    resp = await client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=max_tokens,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.content[0].text


def _extract_json(text: str) -> dict | list:
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    raw = match.group(1).strip() if match else text
    start = raw.find("{") if "{" in raw else raw.find("[")
    end = (raw.rfind("}") + 1) if "{" in raw else (raw.rfind("]") + 1)
    return json.loads(raw[start:end])


async def generate_caption(
    topic: str,
    platform: str,
    tone: str = "professional",
    target_audience: str | None = None,
    keywords: list[str] | None = None,
    additional_context: str | None = None,
) -> str:
    guide = PLATFORM_GUIDELINES.get(platform, PLATFORM_GUIDELINES["instagram"])
    audience_str = f"Target audience: {target_audience}" if target_audience else ""
    kw_str = f"Keywords to naturally include: {', '.join(keywords)}" if keywords else ""
    ctx_str = f"Additional context: {additional_context}" if additional_context else ""

    prompt = f"""Write a {tone} {platform} caption about: {topic}

Platform guidelines:
- Optimal length: ~{guide['optimal_chars']} characters
- Style tips: {guide['tips']}
{audience_str}
{kw_str}
{ctx_str}

Write ONLY the caption text. No explanations. Make it compelling and ready to copy-paste."""
    return await _run(prompt)


async def generate_hashtags(topic: str, platform: str, count: int = 20) -> list[str]:
    guide = PLATFORM_GUIDELINES.get(platform, PLATFORM_GUIDELINES["instagram"])
    prompt = f"""Generate {min(count, guide['max_hashtags'])} highly relevant hashtags for this {platform} post topic: "{topic}"

Mix of:
- 3-5 broad/popular hashtags (1M+ posts)
- 5-8 medium hashtags (100K-1M posts)
- Remaining: niche/specific hashtags (under 100K posts)
- 1-2 branded/unique hashtags

Rules: {guide['best_hashtags']}

Return ONLY a JSON array of hashtag strings (with # symbol). Example: ["#marketing", "#digitalmarketing"]"""
    result = await _run(prompt, max_tokens=500)
    try:
        data = _extract_json(result)
        return data if isinstance(data, list) else []
    except Exception:
        tags = re.findall(r"#\w+", result)
        return tags[:count]


async def generate_blog_post(
    topic: str,
    keywords: list[str] | None = None,
    tone: str = "professional",
    target_audience: str | None = None,
) -> dict:
    kw_str = ", ".join(keywords) if keywords else "naturally relevant terms"
    audience_str = f"Written for: {target_audience}" if target_audience else ""

    prompt = f"""Write a complete, SEO-optimized blog post.

Topic: {topic}
Tone: {tone}
Target keywords: {kw_str}
{audience_str}

Structure:
1. Compelling H1 title
2. Meta description (max 155 chars) — write this on its own line starting with "META:"
3. Introduction (hook + what reader will learn)
4. 4-6 H2 sections with rich content, examples, and actionable advice
5. Conclusion with key takeaways
6. CTA (what should the reader do next?)

Use proper markdown formatting. Make every section substantive — minimum 150 words per section."""
    content = await _run(prompt, max_tokens=4096)

    title_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    meta_match = re.search(r"META:\s*(.+)", content)
    title = title_match.group(1).strip() if title_match else topic
    meta = meta_match.group(1).strip() if meta_match else content[:155]

    return {"title": title, "meta_description": meta, "content": content}


async def generate_ad_copy(
    product: str,
    target_audience: str,
    goal: str = "conversions",
    platform: str = "facebook",
    tone: str = "persuasive",
) -> dict:
    prompt = f"""Write high-converting {platform} ad copy for:

Product/Service: {product}
Target audience: {target_audience}
Campaign goal: {goal}
Tone: {tone}

Generate a complete ad set in JSON format:
{{
  "headline_1": "...",
  "headline_2": "...",
  "headline_3": "...",
  "primary_text": "...",
  "description": "...",
  "cta": "...",
  "hook_variations": ["...", "...", "..."],
  "pain_points_addressed": ["...", "..."],
  "value_propositions": ["...", "..."]
}}

Headlines: max 30 chars each. Primary text: 125 chars optimal. Description: 25 chars. All copy must be specific, benefit-focused, and create urgency."""
    result = await _run(prompt, max_tokens=1500)
    try:
        return _extract_json(result)
    except Exception:
        return {"primary_text": result, "headline_1": product[:30], "cta": "Learn More"}


async def generate_thread(topic: str, tweet_count: int = 7) -> list[str]:
    prompt = f"""Write a viral Twitter/X thread about: {topic}

Requirements:
- Exactly {tweet_count} tweets
- Tweet 1: Hook that makes people STOP scrolling (bold claim, surprising stat, or provocative question)
- Tweets 2-{tweet_count-1}: One key insight per tweet, building on each other
- Tweet {tweet_count}: Powerful conclusion + CTA + "Follow for more"
- Each tweet: MAX 270 characters
- Use numbering: "1/{tweet_count}", "2/{tweet_count}" etc.
- Line breaks for readability
- No fluff — every tweet must deliver value

Return ONLY a JSON array of tweet strings."""
    result = await _run(prompt, max_tokens=2000)
    try:
        data = _extract_json(result)
        return data if isinstance(data, list) else [result]
    except Exception:
        tweets = [t.strip() for t in result.split("\n\n") if t.strip()]
        return tweets[:tweet_count]


async def generate_linkedin_article(
    topic: str,
    industry: str = "digital marketing",
    tone: str = "professional",
) -> dict:
    prompt = f"""Write a high-performing LinkedIn article about: {topic}
Industry: {industry}
Tone: {tone}

LinkedIn article best practices:
- Start with a bold insight or personal story hook (no "I'm excited to share...")
- Use short paragraphs (2-3 lines max)
- Include data points, specific numbers, examples
- 3-5 key takeaways formatted as bullets
- End with an engaging question to drive comments
- 1,200-1,800 words optimal
- 3-5 relevant hashtags at the end

Return as JSON:
{{
  "title": "...",
  "content": "...",
  "hashtags": ["...", "..."],
  "key_takeaways": ["...", "..."]
}}"""
    result = await _run(prompt, max_tokens=3000)
    try:
        return _extract_json(result)
    except Exception:
        return {"title": topic, "content": result, "hashtags": [], "key_takeaways": []}


async def generate_tiktok_script(topic: str, duration_seconds: int = 30) -> dict:
    prompt = f"""Write a viral TikTok script for a {duration_seconds}-second video about: {topic}

Return as JSON:
{{
  "hook": "First 3 seconds — the EXACT words/action to open with",
  "script": "Full word-for-word script with [ACTION] cues",
  "captions": ["On-screen text overlay 1", "On-screen text overlay 2", "..."],
  "sound_suggestion": "Trending sound type or specific suggestion",
  "hashtags": ["#tag1", "#tag2"],
  "caption": "TikTok caption (150 chars max)",
  "cta": "End card call-to-action"
}}

The hook must be attention-grabbing. Script should feel native to TikTok — energetic, fast-paced, value-packed."""
    result = await _run(prompt, max_tokens=1500)
    try:
        return _extract_json(result)
    except Exception:
        return {"hook": "", "script": result, "caption": topic[:150], "hashtags": []}


async def generate_image_prompt(
    topic: str,
    platform: str = "instagram",
    style: str = "photorealistic",
    mood: str | None = None,
    color_palette: str | None = None,
) -> dict:
    guide = PLATFORM_GUIDELINES.get(platform, PLATFORM_GUIDELINES["instagram"])
    mood_str = f"Mood/atmosphere: {mood}" if mood else ""
    palette_str = f"Color palette: {color_palette}" if color_palette else ""

    prompt = f"""Generate optimized AI image prompts for this marketing content:

Topic: {topic}
Platform: {platform} (aspect ratio: {guide['aspect_ratio']})
Style: {style}
{mood_str}
{palette_str}

Return as JSON:
{{
  "dalle3": "Detailed DALL-E 3 prompt (specific, vivid, professional)",
  "midjourney": "Midjourney prompt with parameters --ar {guide['aspect_ratio'].replace(':', ':')} --style raw",
  "stable_diffusion": "Stable Diffusion prompt with quality tags",
  "canva": "Simple description for Canva AI text-to-image",
  "style_notes": "Key visual direction notes for designer"
}}"""
    result = await _run(prompt, max_tokens=1000)
    try:
        return _extract_json(result)
    except Exception:
        return {"dalle3": result, "midjourney": result, "stable_diffusion": result, "canva": result, "style_notes": ""}


async def generate_platform_adaptations(
    base_content: str, platforms: list[str]
) -> dict[str, str]:
    platforms_str = ", ".join(platforms)
    prompt = f"""Adapt this base content for each platform, following each platform's unique style and constraints:

Base content:
{base_content}

Platforms to adapt for: {platforms_str}

Return as JSON where keys are platform names and values are adapted content strings.
Follow character limits: instagram=2200, facebook=63206, linkedin=3000, tiktok=2200, twitter=280"""
    result = await _run(prompt, max_tokens=2000)
    try:
        data = _extract_json(result)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {p: base_content for p in platforms}


def get_next_optimal_time(platform: str) -> datetime:
    """Return the next optimal posting time for the given platform."""
    now = datetime.now(timezone.utc)
    times = OPTIMAL_POST_TIMES.get(platform, [(9, 0), (12, 0), (18, 0)])

    for hour, minute in sorted(times):
        candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if candidate > now:
            return candidate

    # All today's slots passed — schedule for first slot tomorrow
    tomorrow = now + timedelta(days=1)
    h, m = times[0]
    return tomorrow.replace(hour=h, minute=m, second=0, microsecond=0)
