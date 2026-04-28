import json
import re
from datetime import datetime, timezone, timedelta
from app.services.ai_agent import get_client
from app.core.config import settings

SYSTEM_PROMPT = """You are MyWorker CRM AI — an elite sales intelligence engine.
You analyze leads, score their potential, predict behaviour, and generate hyper-personalized outreach.
Be specific, data-driven, and commercially focused. No generic advice.
Always return valid JSON when asked."""


async def _run(prompt: str, max_tokens: int = 1500) -> str:
    client = get_client()
    resp = await client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=max_tokens,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.content[0].text


def _parse_json(text: str) -> dict | list:
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    raw = match.group(1).strip() if match else text
    start = raw.find("{") if "{" in raw else raw.find("[")
    end = (raw.rfind("}") + 1) if "{" in raw else (raw.rfind("]") + 1)
    return json.loads(raw[start:end])


async def score_lead(lead_data: dict) -> dict:
    """AI-powered lead scoring with full analysis."""
    prompt = f"""Analyze this sales lead and provide a comprehensive qualification:

Lead data:
{json.dumps(lead_data, indent=2, default=str)}

Return JSON:
{{
  "score": <float 0-100>,
  "summary": "<2-3 sentence executive summary of this lead's potential>",
  "next_action": "<single most important action to take RIGHT NOW>",
  "key_factors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "strengths": ["<strength 1>", "<strength 2>"],
  "risks": ["<risk 1>", "<risk 2>"],
  "recommended_approach": "<specific strategy to convert this lead>",
  "estimated_close_probability": <float 0-100>,
  "suggested_deal_value": <float — estimated project value in USD>
}}

Scoring criteria:
- Budget indicators (company size, industry)
- Intent signals (urgency, specificity of request)
- Fit (services match, industry expertise)
- Engagement level
- Contact quality (email, phone available)"""

    result = await _run(prompt, max_tokens=1000)
    try:
        return _parse_json(result)
    except Exception:
        return {
            "score": 50.0,
            "summary": result[:300],
            "next_action": "Review lead manually",
            "key_factors": [],
            "strengths": [],
            "risks": [],
            "recommended_approach": "Manual review required",
            "estimated_close_probability": 30.0,
            "suggested_deal_value": 0.0,
        }


async def auto_generate_tasks(lead_data: dict) -> list[dict]:
    """Generate a prioritised follow-up task list for a lead."""
    name = lead_data.get("name", "Lead")
    source = lead_data.get("source", "unknown")
    score = lead_data.get("score", 50)
    status = lead_data.get("status", "new")

    prompt = f"""Generate 4-5 specific, actionable follow-up tasks for this lead:

Name: {name}
Source: {source}
Score: {score}/100
Current status: {status}
Company: {lead_data.get("company", "N/A")}
Industry: {lead_data.get("industry", "N/A")}
Notes: {lead_data.get("notes", "None")}

Rules:
- Tasks must be in logical sequence (most urgent first)
- Each task must have a concrete, measurable action
- Due dates must be realistic (1 day, 3 days, 1 week, 2 weeks from now)
- Higher score = more aggressive follow-up timeline

Return JSON array:
[
  {{
    "title": "<specific action>",
    "description": "<what exactly to do and why>",
    "task_type": "<call|email|whatsapp|meeting|proposal|follow_up|research>",
    "priority": "<urgent|high|medium|low>",
    "days_from_now": <integer>
  }}
]"""

    result = await _run(prompt, max_tokens=800)
    try:
        tasks = _parse_json(result)
        if not isinstance(tasks, list):
            return []
        now = datetime.now(timezone.utc)
        for t in tasks:
            days = t.pop("days_from_now", 1)
            t["due_date"] = (now + timedelta(days=int(days))).isoformat()
            t["ai_generated"] = True
        return tasks
    except Exception:
        return []


async def generate_outreach_message(lead_data: dict, channel: str = "email") -> str:
    """Generate personalised outreach for a specific channel."""
    channel_instructions = {
        "email": "professional email with subject line, greeting, value proposition, CTA, signature",
        "whatsapp": "casual WhatsApp message, max 3 short paragraphs, no formal salutations, ends with a question",
        "linkedin": "LinkedIn connection request or InMail, professional but personal, under 300 characters for request",
        "sms": "SMS message, max 160 characters, include name and clear CTA",
        "cold_call": "phone script with opener, discovery questions, value pitch, and next-step close",
    }
    instructions = channel_instructions.get(channel, channel_instructions["email"])

    prompt = f"""Write a {channel} outreach message for this lead. Make it highly personalised — reference their company, industry, or specific pain points.

Lead:
- Name: {lead_data.get("name")}
- Company: {lead_data.get("company", "N/A")}
- Industry: {lead_data.get("industry", "N/A")}
- Source: {lead_data.get("source", "N/A")}
- Notes: {lead_data.get("notes", "None")}
- AI summary: {lead_data.get("ai_summary", "None")}

Format: {instructions}

Agency context: {settings.AGENCY_NAME} — digital marketing & web development agency.
Services: SEO, social media management, web design, paid advertising, content marketing.

Write ONLY the message. No preamble."""

    return await _run(prompt, max_tokens=800)


async def get_lead_insights(lead_data: dict, activities: list[dict]) -> dict:
    """Deep AI analysis of a lead including history."""
    activities_str = "\n".join(
        f"- [{a.get('kind')}] {a.get('title')} ({a.get('created_at', '')})"
        for a in activities[-10:]
    ) or "No activities yet"

    prompt = f"""Provide strategic intelligence on this lead:

Lead: {json.dumps(lead_data, indent=2, default=str)}

Recent activities:
{activities_str}

Return JSON:
{{
  "health_score": <int 0-100, current relationship health>,
  "momentum": "<increasing|stable|declining>",
  "recommended_next_steps": ["<step 1>", "<step 2>", "<step 3>"],
  "red_flags": ["<flag if any>"],
  "opportunity_summary": "<what specifically makes this lead valuable>",
  "competitive_risks": "<are they likely talking to competitors?>",
  "ideal_close_date": "<timeframe estimate e.g. 2-3 weeks>",
  "talking_points": ["<specific point to raise in next conversation>", "..."]
}}"""

    result = await _run(prompt, max_tokens=1000)
    try:
        return _parse_json(result)
    except Exception:
        return {"health_score": 50, "momentum": "stable", "recommended_next_steps": [], "red_flags": []}


async def generate_lead_report_content(leads: list[dict]) -> str:
    """Generate a weekly CRM pipeline report."""
    summary = {
        "total": len(leads),
        "by_status": {},
        "total_pipeline_value": sum(l.get("deal_value", 0) for l in leads),
        "avg_score": sum(l.get("score", 0) for l in leads) / max(len(leads), 1),
    }
    for lead in leads:
        s = lead.get("status", "new")
        summary["by_status"][s] = summary["by_status"].get(s, 0) + 1

    prompt = f"""Write a concise weekly CRM pipeline report for the sales team.

Pipeline data:
{json.dumps(summary, indent=2)}

Include:
1. Executive summary (2 sentences)
2. Pipeline health assessment
3. Top 3 priorities this week
4. Risks to watch
5. Revenue forecast

Be specific and actionable. Business tone."""

    return await _run(prompt, max_tokens=600)
