import json
from datetime import datetime, timezone
from typing import AsyncGenerator

import anthropic
from app.core.config import settings

SYSTEM_PROMPT = """You are MyWorker, an elite AI-powered digital marketing and web development agency assistant running 24/7.

Your capabilities:
- Lead generation and qualification
- Content creation (blog posts, social media, email copy, ad copy)
- SEO analysis and keyword research
- Proposal writing for web development and marketing projects
- Campaign strategy and planning
- Competitor analysis
- Website audit and recommendations

You are analytical, professional, and output-focused. Always produce actionable results.
When generating content, make it ready-to-use without placeholders.
When analyzing leads, score them 0-100 based on potential value and fit.
When writing proposals, be specific about deliverables, timelines, and pricing."""

_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


async def run_agent_task(task: str, context: str | None = None) -> str:
    """Run a single agent task and return the full response."""
    client = get_client()
    user_content = task
    if context:
        user_content = f"Context:\n{context}\n\nTask:\n{task}"

    response = await client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=4096,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_content}],
    )
    return response.content[0].text


async def stream_agent_task(
    task: str, context: str | None = None
) -> AsyncGenerator[str, None]:
    """Stream an agent task response token by token."""
    client = get_client()
    user_content = task
    if context:
        user_content = f"Context:\n{context}\n\nTask:\n{task}"

    async with client.messages.stream(
        model=settings.CLAUDE_MODEL,
        max_tokens=4096,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_content}],
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def qualify_lead(lead_data: dict) -> dict:
    """Score and summarize a lead using AI."""
    task = f"""Analyze this potential client lead and provide:
1. A lead score from 0-100
2. A 2-3 sentence summary of why they are or aren't a good fit
3. Recommended next action

Lead data:
{json.dumps(lead_data, indent=2)}

Respond in JSON format:
{{
  "score": <number 0-100>,
  "summary": "<2-3 sentence summary>",
  "next_action": "<specific recommended action>"
}}"""

    result = await run_agent_task(task)
    try:
        start = result.find("{")
        end = result.rfind("}") + 1
        return json.loads(result[start:end])
    except (json.JSONDecodeError, ValueError):
        return {"score": 50, "summary": result[:200], "next_action": "Follow up manually"}


async def generate_proposal(client_name: str, services: str, context: str = "") -> str:
    """Generate a professional proposal document."""
    task = f"""Write a professional digital agency proposal for:
Client: {client_name}
Services requested: {services}
Additional context: {context}

Include:
- Executive Summary
- Our Approach
- Scope of Work (detailed deliverables)
- Timeline (with milestones)
- Investment (pricing breakdown)
- Why Choose {settings.AGENCY_NAME}
- Next Steps

Make it compelling, specific, and ready to send."""

    return await run_agent_task(task)


async def generate_social_post(
    topic: str, platform: str = "LinkedIn", tone: str = "professional"
) -> str:
    """Generate a social media post."""
    task = f"""Write a {platform} post about: {topic}
Tone: {tone}
Include relevant hashtags.
Make it engaging and ready to publish."""

    return await run_agent_task(task)


async def generate_blog_post(topic: str, keywords: list[str] | None = None) -> dict:
    """Generate a full SEO-optimized blog post."""
    kw_str = ", ".join(keywords) if keywords else "naturally relevant terms"
    task = f"""Write a complete SEO-optimized blog post.
Topic: {topic}
Target keywords: {kw_str}

Include:
- Compelling H1 title
- Meta description (under 160 chars)
- Introduction
- 4-6 H2 sections with detailed content
- Conclusion with CTA
- Suggested internal linking opportunities

Format with clear headings."""

    content = await run_agent_task(task)
    lines = content.strip().split("\n")
    title = lines[0].lstrip("#").strip() if lines else topic
    return {"title": title, "content": content}


async def run_seo_audit(website_url: str, business_type: str = "") -> dict:
    """Generate an SEO audit and recommendations."""
    task = f"""Perform an SEO audit framework for:
Website: {website_url}
Business type: {business_type}

Provide:
1. Technical SEO checklist (10 items)
2. On-page optimization recommendations (5 items)
3. Content strategy recommendations (5 items)
4. Quick wins (3 immediate actions)
5. Overall SEO health score estimate (0-100)

Format as structured JSON."""

    result = await run_agent_task(task)
    return {"website": website_url, "audit": result, "generated_at": datetime.now(timezone.utc).isoformat()}
