"""Module 7 — AI Agent Brain
Autonomous Claude tool-use loop that operates the agency 24/7.
Each job creates an AgentRun audit record and logs every tool call as an AgentAction.
"""

import asyncio
import email as email_lib
import imaplib
import json
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Callable

import httpx
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.agent import AgentRun, AgentAction, AgentRunType, AgentRunStatus, AgentTrigger
from app.models.activity import Activity, ActivityType, ActivityStatus
from app.models.lead import Lead, LeadStatus
from app.models.followup_task import FollowUpTask
from app.models.proposal import Proposal, ProposalStatus, ProposalTemplate
from app.models.website import Website, WebsiteStatus
from app.models.whatsapp import WhatsAppContact, WhatsAppMessage, MessageDirection
from app.services.ai_agent import get_client

logger = logging.getLogger(__name__)

_AGENT_SYSTEM = (
    "You are MyWorker's autonomous AI agent — an elite digital-agency operations brain running 24/7.\n\n"
    "Your role is to take REAL ACTION using the provided tools. Rules:\n"
    "- Be decisive: if a lead needs follow-up, do it now.\n"
    "- Write personalised, professional messages — never generic templates.\n"
    "- For proposals, generate drafts for qualified leads (score ≥ 70).\n"
    "- For WhatsApp, keep replies concise (2–3 sentences).\n"
    "- End every session with a brief summary of actions taken.\n\n"
    f"Agency: {settings.AGENCY_NAME}"
)


# ─── Email helper ─────────────────────────────────────────────────────────────

async def _send_email(to: str, subject: str, html_body: str) -> bool:
    """Send email via SendGrid REST API."""
    if not settings.SENDGRID_API_KEY:
        logger.warning("SendGrid not configured — email not sent")
        return False
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "personalizations": [{"to": [{"email": to}]}],
                    "from": {"email": settings.EMAIL_FROM, "name": settings.EMAIL_FROM_NAME},
                    "subject": subject,
                    "content": [{"type": "text/html", "value": html_body}],
                },
            )
        return resp.status_code == 202
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return False


# ─── IMAP helper ──────────────────────────────────────────────────────────────

def _sync_fetch_emails(host: str, port: int, user: str, password: str) -> list[dict]:
    """Fetch recent unseen emails from IMAP inbox (runs in thread)."""
    try:
        mail = imaplib.IMAP4_SSL(host, port)
        mail.login(user, password)
        mail.select("INBOX")
        cutoff = (datetime.now() - timedelta(hours=24)).strftime("%d-%b-%Y")
        _, data = mail.search(None, f"(UNSEEN SINCE {cutoff})")
        ids = data[0].split() if data[0] else []
        results = []
        for num in ids[:20]:
            _, msg_data = mail.fetch(num, "(RFC822)")
            msg = email_lib.message_from_bytes(msg_data[0][1])
            body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    if part.get_content_type() == "text/plain":
                        try:
                            body = part.get_payload(decode=True).decode("utf-8", errors="ignore")
                        except Exception:
                            pass
                        break
            else:
                try:
                    body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")
                except Exception:
                    pass
            results.append({
                "from": msg.get("From", ""),
                "subject": msg.get("Subject", ""),
                "body": body[:2000],
            })
        mail.logout()
        return results
    except Exception as e:
        logger.error(f"IMAP fetch error: {e}")
        return []


async def _fetch_inbox_emails() -> list[dict]:
    if not all([settings.IMAP_HOST, settings.IMAP_USER, settings.IMAP_PASSWORD]):
        return []
    return await asyncio.to_thread(
        _sync_fetch_emails,
        settings.IMAP_HOST, settings.IMAP_PORT,
        settings.IMAP_USER, settings.IMAP_PASSWORD,
    )


# ─── Core agentic loop ────────────────────────────────────────────────────────

async def _run_agentic_loop(
    db: AsyncSession,
    run: AgentRun,
    task_prompt: str,
    tools: list[dict],
    executors: dict[str, Callable],
    max_turns: int = 10,
) -> str:
    """
    Multi-turn Claude tool-use loop.
    Calls Claude, executes each tool_use block, feeds results back, repeats
    until Claude stops calling tools.  Returns Claude's final text summary.
    """
    ai = get_client()
    messages: list[dict] = [{"role": "user", "content": task_prompt}]
    final_text = ""

    for _turn in range(max_turns):
        response = await ai.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=4096,
            system=[{"type": "text", "text": _AGENT_SYSTEM, "cache_control": {"type": "ephemeral"}}],
            tools=tools,
            messages=messages,
        )

        # Collect any text
        for block in response.content:
            if hasattr(block, "text"):
                final_text = block.text

        if response.stop_reason != "tool_use":
            break

        # Build assistant turn (serialise content blocks)
        assistant_content = []
        for block in response.content:
            if block.type == "text":
                assistant_content.append({"type": "text", "text": block.text})
            elif block.type == "tool_use":
                assistant_content.append({
                    "type": "tool_use",
                    "id": block.id,
                    "name": block.name,
                    "input": block.input,
                })

        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue

            t_start = time.monotonic()
            action = AgentAction(
                run_id=run.id,
                tool_name=block.name,
                tool_input=json.dumps(block.input),
                status="running",
            )
            db.add(action)
            await db.flush()

            try:
                executor = executors.get(block.name)
                if executor is None:
                    result: dict = {"error": f"Unknown tool: {block.name}"}
                    action.status = "error"
                else:
                    result = await executor(block.input)
                    action.status = "success"
                    run.actions_succeeded += 1
            except Exception as exc:
                result = {"error": str(exc)}
                action.status = "error"
                action.error = str(exc)
                run.actions_failed += 1
                logger.error(f"Tool {block.name} raised: {exc}")

            action.tool_output = json.dumps(result, default=str)
            action.duration_ms = int((time.monotonic() - t_start) * 1000)
            run.actions_taken += 1
            await db.commit()

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": json.dumps(result, default=str),
            })

        messages.append({"role": "assistant", "content": assistant_content})
        messages.append({"role": "user", "content": tool_results})

    return final_text


# ─── Run wrapper ──────────────────────────────────────────────────────────────

async def _start_run(
    db: AsyncSession,
    run_type: AgentRunType,
    trigger: AgentTrigger = AgentTrigger.SCHEDULED,
) -> AgentRun:
    run = AgentRun(run_type=run_type, trigger=trigger)
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return run


async def _finish_run(db: AsyncSession, run: AgentRun, t_start: float, summary: str) -> None:
    run.completed_at = datetime.now(timezone.utc)
    run.duration_seconds = time.monotonic() - t_start
    run.summary = summary or "No actions taken."
    if run.status == AgentRunStatus.RUNNING:
        run.status = AgentRunStatus.SUCCESS if run.actions_failed == 0 else AgentRunStatus.PARTIAL
    await db.commit()

    try:
        from app.api.websocket import broadcast
        await broadcast({
            "event": "agent_run",
            "data": {
                "id": run.id,
                "run_type": run.run_type,
                "status": run.status,
                "actions_taken": run.actions_taken,
                "summary": (run.summary or "")[:200],
                "duration_seconds": run.duration_seconds,
            },
        })
    except Exception:
        pass


# ─── Job 1: WhatsApp Check ────────────────────────────────────────────────────

TOOLS_WHATSAPP = [
    {
        "name": "list_unanswered_conversations",
        "description": "Returns WhatsApp conversations with inbound messages that haven't been replied to in the last 4 hours.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "send_whatsapp_reply",
        "description": "Send a WhatsApp text reply to a contact.",
        "input_schema": {
            "type": "object",
            "properties": {
                "wa_id":   {"type": "string", "description": "Contact's WhatsApp phone number (E.164)"},
                "message": {"type": "string", "description": "Message body to send"},
            },
            "required": ["wa_id", "message"],
        },
    },
    {
        "name": "create_lead_from_whatsapp",
        "description": "Create a CRM lead from a WhatsApp contact who shows buying intent.",
        "input_schema": {
            "type": "object",
            "properties": {
                "wa_id":   {"type": "string"},
                "name":    {"type": "string"},
                "notes":   {"type": "string", "description": "What they're interested in"},
            },
            "required": ["wa_id", "name", "notes"],
        },
    },
]


async def run_whatsapp_check(trigger: AgentTrigger = AgentTrigger.SCHEDULED) -> None:
    if not settings.AGENT_ENABLED:
        return
    if not settings.WHATSAPP_PHONE_NUMBER_ID:
        logger.debug("WhatsApp not configured — skipping")
        return

    async with AsyncSessionLocal() as db:
        run = await _start_run(db, AgentRunType.WHATSAPP_CHECK, trigger)
        t0 = time.monotonic()
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=4)

            async def _list_unanswered(_: dict) -> dict:
                result = await db.execute(
                    select(WhatsAppContact).where(
                        and_(WhatsAppContact.unread_count > 0,
                             WhatsAppContact.last_message_at >= cutoff)
                    ).limit(10)
                )
                contacts = result.scalars().all()
                convs = []
                for c in contacts:
                    msgs_r = await db.execute(
                        select(WhatsAppMessage)
                        .where(WhatsAppMessage.contact_id == c.id)
                        .order_by(WhatsAppMessage.created_at.desc())
                        .limit(6)
                    )
                    msgs = msgs_r.scalars().all()
                    last_dir = msgs[0].direction if msgs else None
                    if last_dir != MessageDirection.INBOUND:
                        continue
                    convs.append({
                        "contact_id": c.id,
                        "wa_id": c.wa_id,
                        "name": c.name or c.profile_name or "Unknown",
                        "unread_count": c.unread_count,
                        "recent_messages": [
                            {"direction": m.direction, "body": m.body, "at": str(m.created_at)}
                            for m in reversed(msgs)
                        ],
                    })
                return {"conversations": convs, "count": len(convs)}

            async def _send_reply(inp: dict) -> dict:
                from app.services.whatsapp_service import send_text_message
                resp = await send_text_message(inp["wa_id"], inp["message"])
                # store outbound message
                c_r = await db.execute(select(WhatsAppContact).where(WhatsAppContact.wa_id == inp["wa_id"]))
                contact = c_r.scalar_one_or_none()
                if contact:
                    from app.models.whatsapp import WhatsAppMessage, MessageDirection, MessageType
                    db.add(WhatsAppMessage(
                        contact_id=contact.id,
                        direction=MessageDirection.OUTBOUND,
                        message_type=MessageType.TEXT,
                        body=inp["message"],
                        is_ai_generated=True,
                    ))
                    contact.unread_count = 0
                    await db.commit()
                return {"sent": True, "wa_id": inp["wa_id"]}

            async def _create_lead(inp: dict) -> dict:
                c_r = await db.execute(select(WhatsAppContact).where(WhatsAppContact.wa_id == inp["wa_id"]))
                contact = c_r.scalar_one_or_none()
                existing = await db.execute(select(Lead).where(Lead.whatsapp == inp["wa_id"]))
                if existing.scalar_one_or_none():
                    return {"status": "already_exists", "wa_id": inp["wa_id"]}
                lead = Lead(
                    name=inp["name"],
                    whatsapp=inp["wa_id"],
                    phone=inp["wa_id"],
                    source="whatsapp",
                    notes=inp.get("notes", ""),
                    status=LeadStatus.NEW,
                )
                db.add(lead)
                await db.commit()
                await db.refresh(lead)
                if contact:
                    contact.is_qualified = True
                    await db.commit()
                return {"status": "created", "lead_id": lead.id, "name": lead.name}

            summary = await _run_agentic_loop(
                db, run,
                task_prompt=(
                    "Check for unanswered WhatsApp conversations and reply to each one appropriately. "
                    "For contacts showing clear buying intent, also create a CRM lead. "
                    "Keep replies warm, professional, and concise."
                ),
                tools=TOOLS_WHATSAPP,
                executors={
                    "list_unanswered_conversations": _list_unanswered,
                    "send_whatsapp_reply": _send_reply,
                    "create_lead_from_whatsapp": _create_lead,
                },
            )
            await _finish_run(db, run, t0, summary)

        except Exception as exc:
            run.status = AgentRunStatus.FAILED
            run.error_message = str(exc)
            run.completed_at = datetime.now(timezone.utc)
            run.duration_seconds = time.monotonic() - t0
            await db.commit()
            logger.error(f"WhatsApp check failed: {exc}")


# ─── Job 2: Email Lead Detection ─────────────────────────────────────────────

TOOLS_EMAIL_LEADS = [
    {
        "name": "list_inbox_emails",
        "description": "Fetch unread emails from the configured inbox (last 24 hours).",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "create_lead_from_email",
        "description": "Create a CRM lead from an email inquiry.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name":    {"type": "string"},
                "email":   {"type": "string"},
                "company": {"type": "string"},
                "notes":   {"type": "string", "description": "Summary of what they need"},
            },
            "required": ["name", "email", "notes"],
        },
    },
]


async def run_email_leads(trigger: AgentTrigger = AgentTrigger.SCHEDULED) -> None:
    if not settings.AGENT_ENABLED:
        return
    if not settings.IMAP_HOST:
        logger.debug("IMAP not configured — skipping email lead check")
        return

    async with AsyncSessionLocal() as db:
        run = await _start_run(db, AgentRunType.EMAIL_LEADS, trigger)
        t0 = time.monotonic()
        try:
            _emails_cache: list[dict] = []

            async def _list_emails(_: dict) -> dict:
                nonlocal _emails_cache
                _emails_cache = await _fetch_inbox_emails()
                return {"emails": _emails_cache, "count": len(_emails_cache)}

            async def _create_lead(inp: dict) -> dict:
                exists = await db.execute(select(Lead).where(Lead.email == inp["email"]))
                if exists.scalar_one_or_none():
                    return {"status": "duplicate", "email": inp["email"]}
                lead = Lead(
                    name=inp["name"],
                    email=inp["email"],
                    company=inp.get("company"),
                    notes=inp.get("notes", ""),
                    source="email_campaign",
                    status=LeadStatus.NEW,
                )
                db.add(lead)
                await db.commit()
                await db.refresh(lead)
                activity = Activity(
                    type=ActivityType.LEAD_FOUND,
                    status=ActivityStatus.SUCCESS,
                    title=f"New lead from email: {lead.name}",
                    description=lead.notes,
                    module="leads",
                )
                db.add(activity)
                await db.commit()
                return {"status": "created", "lead_id": lead.id, "name": lead.name}

            summary = await _run_agentic_loop(
                db, run,
                task_prompt=(
                    "Check the email inbox for new inquiries. "
                    "For each email that looks like a genuine business inquiry, create a CRM lead. "
                    "Ignore newsletters, spam, and non-lead emails."
                ),
                tools=TOOLS_EMAIL_LEADS,
                executors={
                    "list_inbox_emails": _list_emails,
                    "create_lead_from_email": _create_lead,
                },
            )
            await _finish_run(db, run, t0, summary)

        except Exception as exc:
            run.status = AgentRunStatus.FAILED
            run.error_message = str(exc)
            run.completed_at = datetime.now(timezone.utc)
            run.duration_seconds = time.monotonic() - t0
            await db.commit()
            logger.error(f"Email leads check failed: {exc}")


# ─── Job 3: Follow-up Leads ───────────────────────────────────────────────────

TOOLS_FOLLOWUP = [
    {
        "name": "list_overdue_tasks",
        "description": "Returns follow-up tasks that are past due and not yet completed.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "send_followup_email",
        "description": "Send a follow-up email to a lead.",
        "input_schema": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "integer"},
                "subject": {"type": "string"},
                "body":    {"type": "string", "description": "HTML email body"},
            },
            "required": ["lead_id", "subject", "body"],
        },
    },
    {
        "name": "send_followup_whatsapp",
        "description": "Send a WhatsApp follow-up message to a lead.",
        "input_schema": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "integer"},
                "message": {"type": "string"},
            },
            "required": ["lead_id", "message"],
        },
    },
    {
        "name": "mark_task_complete",
        "description": "Mark a follow-up task as completed.",
        "input_schema": {
            "type": "object",
            "properties": {"task_id": {"type": "integer"}},
            "required": ["task_id"],
        },
    },
]


async def run_followup_leads(trigger: AgentTrigger = AgentTrigger.SCHEDULED) -> None:
    if not settings.AGENT_ENABLED:
        return

    async with AsyncSessionLocal() as db:
        run = await _start_run(db, AgentRunType.FOLLOWUP_LEADS, trigger)
        t0 = time.monotonic()
        try:
            now = datetime.now(timezone.utc)

            async def _list_tasks(_: dict) -> dict:
                result = await db.execute(
                    select(FollowUpTask)
                    .where(and_(
                        FollowUpTask.completed == False,
                        FollowUpTask.due_date <= now,
                    ))
                    .limit(15)
                )
                tasks = result.scalars().all()
                out = []
                for t in tasks:
                    lead_r = await db.execute(select(Lead).where(Lead.id == t.lead_id))
                    lead = lead_r.scalar_one_or_none()
                    if not lead:
                        continue
                    out.append({
                        "task_id": t.id,
                        "task_type": t.task_type,
                        "title": t.title,
                        "description": t.description,
                        "due_date": str(t.due_date),
                        "lead": {
                            "id": lead.id,
                            "name": lead.name,
                            "email": lead.email,
                            "whatsapp": lead.whatsapp,
                            "company": lead.company,
                            "status": lead.status,
                            "score": lead.score,
                            "notes": lead.notes,
                            "ai_summary": lead.ai_summary,
                        },
                    })
                return {"tasks": out, "count": len(out)}

            async def _send_email_fu(inp: dict) -> dict:
                lead_r = await db.execute(select(Lead).where(Lead.id == inp["lead_id"]))
                lead = lead_r.scalar_one_or_none()
                if not lead or not lead.email:
                    return {"error": "Lead has no email"}
                ok = await _send_email(lead.email, inp["subject"], inp["body"])
                if ok:
                    lead.last_contact_at = now
                    await db.commit()
                    db.add(Activity(
                        type=ActivityType.EMAIL_SENT,
                        status=ActivityStatus.SUCCESS,
                        title=f"Follow-up sent to {lead.name}",
                        description=inp["subject"],
                        module="leads",
                    ))
                    await db.commit()
                return {"sent": ok, "lead_id": inp["lead_id"]}

            async def _send_wa_fu(inp: dict) -> dict:
                lead_r = await db.execute(select(Lead).where(Lead.id == inp["lead_id"]))
                lead = lead_r.scalar_one_or_none()
                wa = lead.whatsapp or lead.phone if lead else None
                if not wa:
                    return {"error": "Lead has no WhatsApp"}
                from app.services.whatsapp_service import send_text_message
                resp = await send_text_message(wa, inp["message"])
                lead.last_contact_at = now
                await db.commit()
                return {"sent": True, "lead_id": inp["lead_id"], "wa_response": resp}

            async def _mark_done(inp: dict) -> dict:
                task_r = await db.execute(
                    select(FollowUpTask).where(FollowUpTask.id == inp["task_id"])
                )
                task = task_r.scalar_one_or_none()
                if not task:
                    return {"error": "Task not found"}
                task.completed = True
                task.completed_at = now
                await db.commit()
                return {"completed": True, "task_id": inp["task_id"]}

            summary = await _run_agentic_loop(
                db, run,
                task_prompt=(
                    "Check for overdue follow-up tasks and action them. "
                    "For each task, write a personalised message based on the lead's profile and history. "
                    "Use email for email tasks, WhatsApp for WhatsApp tasks. "
                    "Mark each task complete after sending."
                ),
                tools=TOOLS_FOLLOWUP,
                executors={
                    "list_overdue_tasks": _list_tasks,
                    "send_followup_email": _send_email_fu,
                    "send_followup_whatsapp": _send_wa_fu,
                    "mark_task_complete": _mark_done,
                },
            )
            await _finish_run(db, run, t0, summary)

        except Exception as exc:
            run.status = AgentRunStatus.FAILED
            run.error_message = str(exc)
            run.completed_at = datetime.now(timezone.utc)
            run.duration_seconds = time.monotonic() - t0
            await db.commit()
            logger.error(f"Follow-up leads job failed: {exc}")


# ─── Job 4: Auto-Draft Proposals ─────────────────────────────────────────────

TOOLS_PROPOSALS = [
    {
        "name": "list_proposal_candidates",
        "description": "Returns qualified leads without an existing proposal.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "generate_proposal_draft",
        "description": "AI-generate a draft proposal for a lead and save it (status=draft).",
        "input_schema": {
            "type": "object",
            "properties": {
                "lead_id":       {"type": "integer"},
                "template_type": {
                    "type": "string",
                    "enum": ["digital_marketing", "web_development", "seo",
                             "social_media", "email_marketing", "content_creation",
                             "full_service", "custom"],
                },
                "services":      {"type": "array", "items": {"type": "string"}},
            },
            "required": ["lead_id", "template_type", "services"],
        },
    },
]


async def run_auto_proposals(trigger: AgentTrigger = AgentTrigger.SCHEDULED) -> None:
    if not settings.AGENT_ENABLED:
        return

    async with AsyncSessionLocal() as db:
        run = await _start_run(db, AgentRunType.AUTO_PROPOSALS, trigger)
        t0 = time.monotonic()
        try:
            async def _list_candidates(_: dict) -> dict:
                leads_r = await db.execute(
                    select(Lead).where(
                        and_(
                            Lead.score >= settings.AUTO_PROPOSAL_MIN_SCORE,
                            Lead.status.in_([LeadStatus.QUALIFIED, LeadStatus.CONTACTED]),
                        )
                    ).limit(5)
                )
                leads = leads_r.scalars().all()
                out = []
                for lead in leads:
                    prop_r = await db.execute(
                        select(Proposal).where(
                            and_(Proposal.lead_id == lead.id,
                                 Proposal.status != ProposalStatus.REJECTED)
                        )
                    )
                    if prop_r.scalar_one_or_none():
                        continue
                    out.append({
                        "lead_id": lead.id,
                        "name": lead.name,
                        "company": lead.company,
                        "email": lead.email,
                        "industry": lead.industry,
                        "score": lead.score,
                        "notes": lead.notes,
                        "ai_summary": lead.ai_summary,
                        "deal_value": lead.deal_value,
                    })
                return {"candidates": out, "count": len(out)}

            async def _generate_draft(inp: dict) -> dict:
                from app.services.proposal_service import generate_proposal as ai_gen
                from app.models.proposal import ProposalTemplate

                lead_r = await db.execute(select(Lead).where(Lead.id == inp["lead_id"]))
                lead = lead_r.scalar_one_or_none()
                if not lead:
                    return {"error": "Lead not found"}

                try:
                    tmpl = ProposalTemplate(inp["template_type"])
                except ValueError:
                    tmpl = ProposalTemplate.CUSTOM

                data = await ai_gen(
                    client_name=lead.name,
                    client_company=lead.company,
                    template_type=tmpl,
                    services=inp.get("services", ["Digital Marketing"]),
                    budget=lead.deal_value or 0.0,
                    timeline_weeks=4,
                    notes=lead.notes,
                    lead_data={
                        "industry": lead.industry,
                        "status": lead.status,
                        "score": lead.score,
                        "notes": lead.notes,
                        "ai_summary": lead.ai_summary,
                    },
                )

                proposal = Proposal(
                    lead_id=lead.id,
                    title=data.get("title", f"Proposal for {lead.name}"),
                    client_name=lead.name,
                    client_email=lead.email,
                    client_company=lead.company,
                    template_type=tmpl,
                    status=ProposalStatus.DRAFT,
                    cover_letter=data.get("cover_letter"),
                    services=json.dumps(inp.get("services", [])),
                    sections=json.dumps(data.get("sections", [])),
                    timeline=json.dumps(data.get("timeline", [])),
                    deliverables=json.dumps(data.get("deliverables", [])),
                    pricing_breakdown=json.dumps(data.get("pricing_breakdown", [])),
                    value=data.get("total_value", lead.deal_value or 0.0),
                    monthly_retainer=data.get("monthly_retainer", 0.0),
                    setup_fee=data.get("setup_fee", 0.0),
                    timeline_weeks=data.get("timeline_weeks", 4),
                    ai_generated=True,
                    ai_win_tips=json.dumps(data.get("win_tips", [])),
                )
                db.add(proposal)
                lead.status = LeadStatus.PROPOSAL_SENT
                db.add(Activity(
                    type=ActivityType.PROPOSAL_SENT,
                    status=ActivityStatus.SUCCESS,
                    title=f"Auto-draft proposal: {lead.name}",
                    description="AI-generated proposal draft created",
                    module="proposals",
                ))
                await db.commit()
                await db.refresh(proposal)
                return {"status": "draft_created", "proposal_id": proposal.id, "lead": lead.name}

            summary = await _run_agentic_loop(
                db, run,
                task_prompt=(
                    "Find qualified leads that don't have a proposal yet. "
                    "For each, determine the best service template based on their industry and notes, "
                    "then generate a draft proposal. Proposals are saved as DRAFT for human review."
                ),
                tools=TOOLS_PROPOSALS,
                executors={
                    "list_proposal_candidates": _list_candidates,
                    "generate_proposal_draft": _generate_draft,
                },
            )
            await _finish_run(db, run, t0, summary)

        except Exception as exc:
            run.status = AgentRunStatus.FAILED
            run.error_message = str(exc)
            run.completed_at = datetime.now(timezone.utc)
            run.duration_seconds = time.monotonic() - t0
            await db.commit()
            logger.error(f"Auto-proposals job failed: {exc}")


# ─── Job 5: Website Build Queue ───────────────────────────────────────────────

TOOLS_WEBSITE_QUEUE = [
    {
        "name": "list_website_queue",
        "description": "Returns websites in planning/in_progress status that have no generated pages yet.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "generate_website_content",
        "description": "Run AI content generation for a website in the build queue.",
        "input_schema": {
            "type": "object",
            "properties": {"site_id": {"type": "integer"}},
            "required": ["site_id"],
        },
    },
]


async def run_website_queue(trigger: AgentTrigger = AgentTrigger.SCHEDULED) -> None:
    if not settings.AGENT_ENABLED:
        return

    async with AsyncSessionLocal() as db:
        run = await _start_run(db, AgentRunType.WEBSITE_QUEUE, trigger)
        t0 = time.monotonic()
        try:
            async def _list_queue(_: dict) -> dict:
                result = await db.execute(
                    select(Website).where(
                        and_(
                            Website.status.in_([WebsiteStatus.PLANNING, WebsiteStatus.IN_PROGRESS]),
                            Website.pages_count == 0,
                        )
                    ).limit(3)
                )
                sites = result.scalars().all()
                return {
                    "queue": [
                        {
                            "site_id": s.id,
                            "name": s.name,
                            "client": s.client_name,
                            "template": s.template,
                            "industry": s.industry,
                            "description": s.description,
                            "status": s.status,
                        }
                        for s in sites
                    ],
                    "count": len(sites),
                }

            async def _generate_content(inp: dict) -> dict:
                from app.services.website_service import generate_full_site
                site_r = await db.execute(
                    select(Website).where(Website.id == inp["site_id"])
                )
                site = site_r.scalar_one_or_none()
                if not site:
                    return {"error": "Site not found"}
                pages = await generate_full_site(db, site)
                site.status = WebsiteStatus.IN_PROGRESS
                site.pages_count = len(pages)
                site.progress = 30
                db.add(Activity(
                    type=ActivityType.SITE_BUILT,
                    status=ActivityStatus.SUCCESS,
                    title=f"AI content generated: {site.name}",
                    description=f"{len(pages)} pages created for {site.client_name}",
                    module="websites",
                ))
                await db.commit()
                return {"status": "generated", "site_id": site.id, "pages": len(pages)}

            summary = await _run_agentic_loop(
                db, run,
                task_prompt=(
                    "Check the website build queue for sites with no pages yet. "
                    "Process each one by generating AI content. "
                    "Process up to 3 sites per run to avoid timeouts."
                ),
                tools=TOOLS_WEBSITE_QUEUE,
                executors={
                    "list_website_queue": _list_queue,
                    "generate_website_content": _generate_content,
                },
            )
            await _finish_run(db, run, t0, summary)

        except Exception as exc:
            run.status = AgentRunStatus.FAILED
            run.error_message = str(exc)
            run.completed_at = datetime.now(timezone.utc)
            run.duration_seconds = time.monotonic() - t0
            await db.commit()
            logger.error(f"Website queue job failed: {exc}")


# ─── Job 6: Daily Admin Summary ───────────────────────────────────────────────

TOOLS_DAILY_SUMMARY = [
    {
        "name": "get_daily_metrics",
        "description": "Fetch comprehensive 24-hour performance metrics for the agency.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "send_admin_email_report",
        "description": "Send the daily summary report email to the admin.",
        "input_schema": {
            "type": "object",
            "properties": {
                "subject":   {"type": "string"},
                "html_body": {"type": "string"},
            },
            "required": ["subject", "html_body"],
        },
    },
    {
        "name": "send_admin_whatsapp_report",
        "description": "Send a short daily summary via WhatsApp to the admin.",
        "input_schema": {
            "type": "object",
            "properties": {"message": {"type": "string"}},
            "required": ["message"],
        },
    },
]


async def run_daily_summary(trigger: AgentTrigger = AgentTrigger.SCHEDULED) -> None:
    if not settings.AGENT_ENABLED:
        return

    async with AsyncSessionLocal() as db:
        run = await _start_run(db, AgentRunType.DAILY_SUMMARY, trigger)
        t0 = time.monotonic()
        try:
            yesterday = datetime.now(timezone.utc) - timedelta(hours=24)

            async def _get_metrics(_: dict) -> dict:
                new_leads = await db.scalar(
                    select(func.count(Lead.id)).where(Lead.created_at >= yesterday)
                )
                active_leads = await db.scalar(
                    select(func.count(Lead.id)).where(
                        Lead.status.in_([LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED])
                    )
                )
                proposals_today = await db.scalar(
                    select(func.count(Proposal.id)).where(Proposal.created_at >= yesterday)
                )
                accepted = await db.scalar(
                    select(func.count(Proposal.id)).where(Proposal.status == ProposalStatus.ACCEPTED)
                )
                revenue = await db.scalar(
                    select(func.coalesce(func.sum(Proposal.value), 0.0))
                    .where(Proposal.status == ProposalStatus.ACCEPTED)
                ) or 0.0

                sites_in_progress = await db.scalar(
                    select(func.count(Website.id)).where(
                        Website.status == WebsiteStatus.IN_PROGRESS
                    )
                )
                sites_live = await db.scalar(
                    select(func.count(Website.id)).where(Website.status == WebsiteStatus.LIVE)
                )

                runs_today = await db.execute(
                    select(AgentRun).where(AgentRun.started_at >= yesterday).limit(20)
                )
                agent_runs = runs_today.scalars().all()
                agent_summary = [
                    f"{r.run_type}: {r.status} ({r.actions_taken} actions)"
                    for r in agent_runs
                ]

                return {
                    "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                    "new_leads_24h": new_leads or 0,
                    "active_leads": active_leads or 0,
                    "proposals_created_24h": proposals_today or 0,
                    "accepted_proposals_total": accepted or 0,
                    "total_revenue_pipeline": float(revenue),
                    "sites_in_progress": sites_in_progress or 0,
                    "sites_live": sites_live or 0,
                    "agent_runs_24h": agent_summary,
                    "agency": settings.AGENCY_NAME,
                }

            async def _send_email_report(inp: dict) -> dict:
                if not settings.ADMIN_EMAIL:
                    return {"skipped": "ADMIN_EMAIL not configured"}
                ok = await _send_email(settings.ADMIN_EMAIL, inp["subject"], inp["html_body"])
                return {"sent": ok, "to": settings.ADMIN_EMAIL}

            async def _send_wa_report(inp: dict) -> dict:
                if not settings.ADMIN_WHATSAPP:
                    return {"skipped": "ADMIN_WHATSAPP not configured"}
                from app.services.whatsapp_service import send_text_message
                resp = await send_text_message(settings.ADMIN_WHATSAPP, inp["message"])
                return {"sent": True, "response": resp}

            today_str = datetime.now(timezone.utc).strftime("%A %d %B %Y")
            summary = await _run_agentic_loop(
                db, run,
                task_prompt=(
                    f"Prepare and send the daily summary report for {today_str}. "
                    "1) Fetch today's metrics. "
                    "2) Write a concise executive summary email (HTML, 200-300 words) covering "
                    "leads, proposals, revenue, site builds, and agent actions. "
                    "3) Write a 3-line WhatsApp summary. "
                    "4) Send both reports."
                ),
                tools=TOOLS_DAILY_SUMMARY,
                executors={
                    "get_daily_metrics": _get_metrics,
                    "send_admin_email_report": _send_email_report,
                    "send_admin_whatsapp_report": _send_wa_report,
                },
            )
            await _finish_run(db, run, t0, summary)

        except Exception as exc:
            run.status = AgentRunStatus.FAILED
            run.error_message = str(exc)
            run.completed_at = datetime.now(timezone.utc)
            run.duration_seconds = time.monotonic() - t0
            await db.commit()
            logger.error(f"Daily summary job failed: {exc}")


# ─── Orchestrator: Full Hourly Loop ───────────────────────────────────────────

async def run_full_agent_loop() -> None:
    """Master hourly loop — runs all sub-jobs in sequence."""
    if not settings.AGENT_ENABLED:
        logger.info("Agent is disabled (AGENT_ENABLED=false)")
        return

    logger.info("▶ Agent brain: starting full loop")
    jobs = [
        ("WhatsApp check", run_whatsapp_check),
        ("Email leads",    run_email_leads),
        ("Follow-ups",     run_followup_leads),
        ("Auto-proposals", run_auto_proposals),
        ("Website queue",  run_website_queue),
    ]
    for name, job in jobs:
        try:
            logger.info(f"  → {name}")
            await job(AgentTrigger.SCHEDULED)
        except Exception as exc:
            logger.error(f"Agent job '{name}' crashed: {exc}")

    logger.info("✓ Agent brain: full loop complete")
