import json, logging, httpx
from app.core.config import settings
from app.services.ai_agent import get_client

logger = logging.getLogger(__name__)

META_API = "https://graph.facebook.com/v19.0"

AGENCY_SYSTEM = """You are a professional AI assistant for a digital marketing and web development agency called MyWorker.
Your role on WhatsApp:
- Answer questions about our services (web development, SEO, social media, email marketing, campaigns)
- Qualify leads by asking about their business, goals, budget and timeline
- Be warm, concise, and professional — this is WhatsApp, so keep replies short (2-4 sentences max)
- Never reveal you are an AI unless directly asked
- If the prospect is ready, offer to send a proposal or book a discovery call
Always respond with valid JSON only."""


# ── Meta Cloud API helpers ──────────────────────────────────────────────────

async def send_text_message(to: str, body: str) -> dict:
    """Send a plain text WhatsApp message via Meta Cloud API."""
    if not settings.WHATSAPP_PHONE_NUMBER_ID or not settings.WHATSAPP_ACCESS_TOKEN:
        logger.warning("WhatsApp not configured — message not sent")
        return {"status": "not_configured"}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{META_API}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages",
            headers={
                "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
                "Content-Type": "application/json",
            },
            json={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "text",
                "text": {"body": body, "preview_url": False},
            },
        )
        result = resp.json()
        if resp.status_code != 200:
            logger.error(f"WhatsApp send error {resp.status_code}: {result}")
        return result


async def send_template_message(to: str, template_name: str, language: str = "en", components: list | None = None) -> dict:
    """Send an approved WhatsApp template message."""
    if not settings.WHATSAPP_PHONE_NUMBER_ID or not settings.WHATSAPP_ACCESS_TOKEN:
        return {"status": "not_configured"}

    payload: dict = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language},
        },
    }
    if components:
        payload["template"]["components"] = components

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{META_API}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages",
            headers={
                "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        return resp.json()


async def mark_message_read(wa_message_id: str) -> None:
    """Mark incoming message as read (shows double blue ticks)."""
    if not settings.WHATSAPP_PHONE_NUMBER_ID or not settings.WHATSAPP_ACCESS_TOKEN:
        return
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(
            f"{META_API}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages",
            headers={"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}"},
            json={
                "messaging_product": "whatsapp",
                "status": "read",
                "message_id": wa_message_id,
            },
        )


# ── AI reply generation ─────────────────────────────────────────────────────

async def generate_ai_reply(
    contact_name: str,
    incoming_message: str,
    conversation_history: list[dict],
) -> dict:
    """
    Generate a contextual AI reply and lead qualification assessment.
    Returns: { reply, is_qualified, qualification_notes, lead_score, suggested_action }
    """
    client = get_client()

    history_lines = []
    for m in conversation_history[-12:]:   # last 12 messages for context
        prefix = "THEM" if m["direction"] == "inbound" else "US"
        history_lines.append(f"{prefix}: {m['body']}")
    history_text = "\n".join(history_lines) if history_lines else "(new conversation)"

    prompt = f"""Contact name: {contact_name}

Conversation so far:
{history_text}

Latest message from them: {incoming_message}

Write a short, natural WhatsApp reply. Also evaluate their lead potential.

Return JSON:
{{
  "reply": "your reply here (2-4 sentences, conversational)",
  "is_qualified": true or false,
  "qualification_notes": "1-2 sentences about their needs/budget/urgency",
  "lead_score": 0-100,
  "suggested_action": "send_proposal | book_call | send_pricing | nurture | none"
}}"""

    try:
        resp = await client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=600,
            system=[{"type": "text", "text": AGENCY_SYSTEM, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            raw = raw[4:] if raw.startswith("json") else raw
        return json.loads(raw)
    except Exception as e:
        logger.error(f"AI reply error: {e}")
        return {
            "reply": "Thank you for reaching out! Our team will follow up with you shortly. 😊",
            "is_qualified": False,
            "qualification_notes": "",
            "lead_score": 20,
            "suggested_action": "nurture",
        }


async def generate_ai_template(purpose: str, category: str, variables: list[str]) -> dict:
    """AI-generate a WhatsApp message template."""
    client = get_client()

    vars_display = ", ".join([f"{{{{{v}}}}}" for v in variables]) if variables else "none"
    prompt = f"""Create a WhatsApp Business message template for a digital marketing agency.

Purpose: {purpose}
Category: {category}
Variables to include: {vars_display}

Requirements:
- Body max 1024 chars, header max 60 chars, footer max 60 chars
- Variables must use double curly brace syntax: {{{{variable_name}}}}
- Be professional yet friendly
- Include a clear call-to-action

Return JSON:
{{
  "name": "snake_case_template_name",
  "header_text": "optional short header or null",
  "body_text": "main message body with {{{{variables}}}} if needed",
  "footer_text": "optional footer or null",
  "buttons": [{{"type": "QUICK_REPLY", "text": "Yes, interested"}}],
  "variables": ["list", "of", "variable", "names"]
}}"""

    resp = await client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=800,
        system=[{"type": "text", "text": "Create professional WhatsApp templates. Return valid JSON only.", "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
    )
    raw = resp.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        raw = raw[4:] if raw.startswith("json") else raw
    return json.loads(raw)


async def generate_broadcast_message(goal: str, audience: str) -> str:
    """AI-generate a broadcast message body."""
    client = get_client()
    resp = await client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=400,
        messages=[{
            "role": "user",
            "content": f"Write a short WhatsApp broadcast message for a digital marketing agency.\nGoal: {goal}\nAudience: {audience}\nKeep it under 300 chars, friendly and with a clear CTA. Return only the message text.",
        }],
    )
    return resp.content[0].text.strip()
