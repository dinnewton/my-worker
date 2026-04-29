import json, logging, hmac, hashlib
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.whatsapp import (
    WhatsAppContact, WhatsAppMessage, WhatsAppTemplate, WhatsAppBroadcast,
    MessageDirection, MessageStatus, MessageType, TemplateCategory,
    TemplateStatus, BroadcastStatus,
)
from app.services.whatsapp_service import (
    send_text_message, send_template_message, mark_message_read,
    generate_ai_reply, generate_ai_template, generate_broadcast_message,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


# ── Pydantic schemas ────────────────────────────────────────────────────────

class ContactOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int; wa_id: str; phone: str | None; name: str | None; profile_name: str | None
    is_qualified: bool; lead_score: int; suggested_action: str | None
    opt_in: bool; unread_count: int
    last_message_at: datetime | None; last_message_preview: str | None
    created_at: datetime

class MessageOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int; contact_id: int; direction: MessageDirection; message_type: MessageType
    body: str | None; status: MessageStatus; is_ai_generated: bool
    media_url: str | None; media_caption: str | None; created_at: datetime

class TemplateOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int; name: str; category: TemplateCategory; language: str
    header_text: str | None; body_text: str | None; footer_text: str | None
    buttons: str | None; variables: str | None; status: TemplateStatus
    use_count: int; created_at: datetime

class BroadcastOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int; name: str; message_body: str | None; target_filter: str
    recipient_count: int; sent_count: int; delivered_count: int; failed_count: int
    status: BroadcastStatus; scheduled_at: datetime | None; sent_at: datetime | None
    created_at: datetime

class SendMessageReq(BaseModel):
    contact_id: int
    body: str
    message_type: MessageType = MessageType.TEXT

class CreateTemplateReq(BaseModel):
    name: str; category: TemplateCategory = TemplateCategory.MARKETING
    language: str = "en"; header_text: str | None = None; body_text: str
    footer_text: str | None = None; buttons: list | None = None
    variables: list[str] | None = None

class AITemplateReq(BaseModel):
    purpose: str; category: str = "MARKETING"; variables: list[str] = []

class CreateBroadcastReq(BaseModel):
    name: str; message_body: str; target_filter: str = "all"
    template_id: int | None = None

class AIBroadcastReq(BaseModel):
    goal: str; audience: str

class SendBroadcastReq(BaseModel):
    broadcast_id: int

class UpdateContactReq(BaseModel):
    name: str | None = None; is_qualified: bool | None = None
    qualification_notes: str | None = None; opt_in: bool | None = None


# ── Webhook (Meta verification + incoming messages) ─────────────────────────

@router.get("/webhook", response_class=PlainTextResponse)
async def verify_webhook(
    hub_mode: str = Query(alias="hub.mode", default=""),
    hub_challenge: str = Query(alias="hub.challenge", default=""),
    hub_verify_token: str = Query(alias="hub.verify_token", default=""),
):
    """Meta calls this GET to verify the webhook URL during setup."""
    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        logger.info("WhatsApp webhook verified successfully")
        return hub_challenge
    raise HTTPException(403, "Webhook verification failed")


@router.post("/webhook", status_code=200)
async def receive_webhook(
    request: Request,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Receive incoming WhatsApp messages from Meta."""
    body_bytes = await request.body()

    # Verify signature if app secret is configured
    if settings.WHATSAPP_APP_SECRET:
        sig = request.headers.get("x-hub-signature-256", "")
        expected = "sha256=" + hmac.new(
            settings.WHATSAPP_APP_SECRET.encode(),
            body_bytes,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(sig, expected):
            raise HTTPException(403, "Invalid signature")

    try:
        payload = json.loads(body_bytes)
    except Exception:
        return {"status": "ok"}

    # Walk the payload tree
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            messages = value.get("messages", [])
            contacts_meta = value.get("contacts", [])

            for msg in messages:
                wa_id = msg.get("from")
                wa_msg_id = msg.get("id")
                msg_type = msg.get("type", "text")
                body_text = ""

                if msg_type == "text":
                    body_text = msg.get("text", {}).get("body", "")
                elif msg_type in ("image", "document", "audio", "video"):
                    body_text = f"[{msg_type.upper()}]"
                elif msg_type == "interactive":
                    inter = msg.get("interactive", {})
                    body_text = inter.get("button_reply", {}).get("title") or inter.get("list_reply", {}).get("title", "[INTERACTIVE]")

                if not wa_id or not body_text:
                    continue

                # Get or create contact
                result = await db.execute(select(WhatsAppContact).where(WhatsAppContact.wa_id == wa_id))
                contact = result.scalar_one_or_none()

                profile_name = next(
                    (c.get("profile", {}).get("name") for c in contacts_meta if c.get("wa_id") == wa_id), None
                )

                if not contact:
                    contact = WhatsAppContact(
                        wa_id=wa_id, phone=wa_id,
                        name=profile_name or wa_id,
                        profile_name=profile_name,
                    )
                    db.add(contact)
                    await db.flush()
                elif profile_name and not contact.profile_name:
                    contact.profile_name = profile_name

                # Save inbound message
                inbound = WhatsAppMessage(
                    contact_id=contact.id,
                    wa_message_id=wa_msg_id,
                    direction=MessageDirection.INBOUND,
                    message_type=MessageType(msg_type) if msg_type in MessageType._value2member_map_ else MessageType.TEXT,
                    body=body_text,
                    status=MessageStatus.READ,
                )
                db.add(inbound)

                contact.last_message_at = datetime.utcnow()
                contact.last_message_preview = body_text[:100]
                contact.unread_count = (contact.unread_count or 0) + 1
                await db.commit()

                # Mark as read + auto-reply in background
                if wa_msg_id:
                    background.add_task(mark_message_read, wa_msg_id)

                if settings.WHATSAPP_AUTO_REPLY:
                    history_result = await db.execute(
                        select(WhatsAppMessage)
                        .where(WhatsAppMessage.contact_id == contact.id)
                        .order_by(WhatsAppMessage.created_at)
                    )
                    history = [{"direction": m.direction.value, "body": m.body} for m in history_result.scalars().all()]
                    background.add_task(
                        _auto_reply_task, contact.id, contact.name or wa_id, body_text, history
                    )

    return {"status": "ok"}


async def _auto_reply_task(contact_id: int, contact_name: str, message: str, history: list[dict]) -> None:
    """Background task: generate AI reply, save it, send via Meta API."""
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        try:
            ai = await generate_ai_reply(contact_name, message, history)
            reply_text = ai.get("reply", "")
            if not reply_text:
                return

            # Update contact qualification data
            contact = await db.get(WhatsAppContact, contact_id)
            if contact:
                contact.is_qualified = ai.get("is_qualified", contact.is_qualified)
                contact.lead_score = ai.get("lead_score", contact.lead_score)
                contact.qualification_notes = ai.get("qualification_notes") or contact.qualification_notes
                contact.suggested_action = ai.get("suggested_action")
                contact.last_message_preview = reply_text[:100]

                # Save outbound AI message
                out_msg = WhatsAppMessage(
                    contact_id=contact_id,
                    direction=MessageDirection.OUTBOUND,
                    body=reply_text,
                    is_ai_generated=True,
                    status=MessageStatus.SENT,
                )
                db.add(out_msg)

                result = await send_text_message(contact.wa_id, reply_text)
                if "messages" in result:
                    out_msg.wa_message_id = result["messages"][0].get("id")
                    out_msg.status = MessageStatus.DELIVERED
                else:
                    out_msg.status = MessageStatus.FAILED
                    out_msg.error_message = json.dumps(result)

                await db.commit()
        except Exception as e:
            logger.error(f"Auto-reply task failed: {e}")


# ── Stats ───────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    contacts = (await db.execute(select(WhatsAppContact))).scalars().all()
    messages = (await db.execute(select(WhatsAppMessage))).scalars().all()
    broadcasts = (await db.execute(select(WhatsAppBroadcast))).scalars().all()
    qualified = [c for c in contacts if c.is_qualified]
    inbound = [m for m in messages if m.direction == MessageDirection.INBOUND]
    return {
        "total_contacts": len(contacts),
        "qualified_leads": len(qualified),
        "total_messages": len(messages),
        "inbound_today": len([m for m in inbound if m.created_at and m.created_at.date() == datetime.utcnow().date()]),
        "broadcasts_sent": len([b for b in broadcasts if b.status == BroadcastStatus.SENT]),
        "auto_reply_enabled": settings.WHATSAPP_AUTO_REPLY,
        "configured": bool(settings.WHATSAPP_PHONE_NUMBER_ID and settings.WHATSAPP_ACCESS_TOKEN),
    }


# ── Contacts ────────────────────────────────────────────────────────────────

class ManualContactReq(BaseModel):
    wa_id: str; name: str | None = None; phone: str | None = None

@router.post("/contacts/manual", response_model=ContactOut, status_code=201)
async def add_manual_contact(payload: ManualContactReq, db: AsyncSession = Depends(get_db)):
    """Add a contact manually (for testing / demo mode)."""
    existing = (await db.execute(select(WhatsAppContact).where(WhatsAppContact.wa_id == payload.wa_id))).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "Contact with this WhatsApp ID already exists")
    c = WhatsAppContact(
        wa_id=payload.wa_id,
        phone=payload.phone or payload.wa_id,
        name=payload.name or payload.wa_id,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c


@router.get("/contacts", response_model=list[ContactOut])
async def list_contacts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WhatsAppContact).order_by(desc(WhatsAppContact.last_message_at))
    )
    return result.scalars().all()


@router.get("/contacts/{cid}", response_model=ContactOut)
async def get_contact(cid: int, db: AsyncSession = Depends(get_db)):
    c = await db.get(WhatsAppContact, cid)
    if not c:
        raise HTTPException(404, "Contact not found")
    return c


@router.patch("/contacts/{cid}", response_model=ContactOut)
async def update_contact(cid: int, payload: UpdateContactReq, db: AsyncSession = Depends(get_db)):
    c = await db.get(WhatsAppContact, cid)
    if not c:
        raise HTTPException(404, "Contact not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(c, k, v)
    await db.commit()
    await db.refresh(c)
    return c


@router.delete("/contacts/{cid}", status_code=204)
async def delete_contact(cid: int, db: AsyncSession = Depends(get_db)):
    c = await db.get(WhatsAppContact, cid)
    if not c:
        raise HTTPException(404, "Contact not found")
    await db.delete(c)
    await db.commit()


# ── Messages ────────────────────────────────────────────────────────────────

@router.get("/contacts/{cid}/messages", response_model=list[MessageOut])
async def get_messages(cid: int, db: AsyncSession = Depends(get_db)):
    c = await db.get(WhatsAppContact, cid)
    if not c:
        raise HTTPException(404, "Contact not found")
    # Clear unread count when conversation is opened
    c.unread_count = 0
    await db.commit()
    result = await db.execute(
        select(WhatsAppMessage)
        .where(WhatsAppMessage.contact_id == cid)
        .order_by(WhatsAppMessage.created_at)
    )
    return result.scalars().all()


@router.post("/send", response_model=MessageOut, status_code=201)
async def send_message(payload: SendMessageReq, db: AsyncSession = Depends(get_db)):
    contact = await db.get(WhatsAppContact, payload.contact_id)
    if not contact:
        raise HTTPException(404, "Contact not found")

    msg = WhatsAppMessage(
        contact_id=contact.id,
        direction=MessageDirection.OUTBOUND,
        message_type=payload.message_type,
        body=payload.body,
        status=MessageStatus.SENT,
    )
    db.add(msg)
    contact.last_message_at = datetime.utcnow()
    contact.last_message_preview = payload.body[:100]
    await db.flush()

    result = await send_text_message(contact.wa_id, payload.body)
    if "messages" in result:
        msg.wa_message_id = result["messages"][0].get("id")
        msg.status = MessageStatus.DELIVERED
    elif not settings.WHATSAPP_PHONE_NUMBER_ID:
        msg.status = MessageStatus.SENT   # demo mode
    else:
        msg.status = MessageStatus.FAILED
        msg.error_message = json.dumps(result)

    await db.commit()
    await db.refresh(msg)
    return msg


@router.post("/contacts/{cid}/ai-reply", response_model=MessageOut, status_code=201)
async def trigger_ai_reply(cid: int, db: AsyncSession = Depends(get_db)):
    """Manually trigger an AI reply for the last inbound message."""
    contact = await db.get(WhatsAppContact, cid)
    if not contact:
        raise HTTPException(404, "Contact not found")

    hist_result = await db.execute(
        select(WhatsAppMessage).where(WhatsAppMessage.contact_id == cid).order_by(WhatsAppMessage.created_at)
    )
    history = hist_result.scalars().all()
    if not history:
        raise HTTPException(400, "No messages in conversation")

    last_inbound = next((m for m in reversed(history) if m.direction == MessageDirection.INBOUND), None)
    if not last_inbound:
        raise HTTPException(400, "No inbound message to reply to")

    hist_dicts = [{"direction": m.direction.value, "body": m.body} for m in history]
    ai = await generate_ai_reply(contact.name or contact.wa_id, last_inbound.body or "", hist_dicts)

    contact.is_qualified = ai.get("is_qualified", contact.is_qualified)
    contact.lead_score = ai.get("lead_score", contact.lead_score)
    contact.qualification_notes = ai.get("qualification_notes") or contact.qualification_notes
    contact.suggested_action = ai.get("suggested_action")

    reply_body = ai.get("reply", "")
    msg = WhatsAppMessage(
        contact_id=cid,
        direction=MessageDirection.OUTBOUND,
        body=reply_body,
        is_ai_generated=True,
        status=MessageStatus.SENT,
    )
    db.add(msg)
    contact.last_message_at = datetime.utcnow()
    contact.last_message_preview = reply_body[:100]
    await db.flush()

    result = await send_text_message(contact.wa_id, reply_body)
    if "messages" in result:
        msg.wa_message_id = result["messages"][0].get("id")
        msg.status = MessageStatus.DELIVERED

    await db.commit()
    await db.refresh(msg)
    return msg


# ── Templates ───────────────────────────────────────────────────────────────

@router.get("/templates", response_model=list[TemplateOut])
async def list_templates(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WhatsAppTemplate).order_by(desc(WhatsAppTemplate.created_at)))
    return result.scalars().all()


@router.post("/templates", response_model=TemplateOut, status_code=201)
async def create_template(payload: CreateTemplateReq, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(WhatsAppTemplate).where(WhatsAppTemplate.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Template '{payload.name}' already exists")
    t = WhatsAppTemplate(
        name=payload.name,
        category=payload.category,
        language=payload.language,
        header_text=payload.header_text,
        body_text=payload.body_text,
        footer_text=payload.footer_text,
        buttons=json.dumps(payload.buttons) if payload.buttons else None,
        variables=json.dumps(payload.variables) if payload.variables else None,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return t


@router.post("/templates/ai", response_model=TemplateOut, status_code=201)
async def ai_create_template(payload: AITemplateReq, db: AsyncSession = Depends(get_db)):
    try:
        data = await generate_ai_template(payload.purpose, payload.category, payload.variables)
    except Exception as e:
        raise HTTPException(500, str(e))

    # Ensure unique name
    base_name = data.get("name", "template")
    name = base_name
    suffix = 1
    while (await db.execute(select(WhatsAppTemplate).where(WhatsAppTemplate.name == name))).scalar_one_or_none():
        name = f"{base_name}_{suffix}"
        suffix += 1

    buttons = data.get("buttons")
    variables = data.get("variables", payload.variables)

    t = WhatsAppTemplate(
        name=name,
        category=TemplateCategory(payload.category) if payload.category in TemplateCategory._value2member_map_ else TemplateCategory.MARKETING,
        body_text=data.get("body_text", ""),
        header_text=data.get("header_text"),
        footer_text=data.get("footer_text"),
        buttons=json.dumps(buttons) if buttons else None,
        variables=json.dumps(variables) if variables else None,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return t


@router.delete("/templates/{tid}", status_code=204)
async def delete_template(tid: int, db: AsyncSession = Depends(get_db)):
    t = await db.get(WhatsAppTemplate, tid)
    if not t:
        raise HTTPException(404, "Template not found")
    await db.delete(t)
    await db.commit()


# ── Broadcasts ──────────────────────────────────────────────────────────────

@router.get("/broadcasts", response_model=list[BroadcastOut])
async def list_broadcasts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WhatsAppBroadcast).order_by(desc(WhatsAppBroadcast.created_at)))
    return result.scalars().all()


@router.post("/broadcasts", response_model=BroadcastOut, status_code=201)
async def create_broadcast(payload: CreateBroadcastReq, db: AsyncSession = Depends(get_db)):
    b = WhatsAppBroadcast(
        name=payload.name,
        message_body=payload.message_body,
        target_filter=payload.target_filter,
        template_id=payload.template_id,
    )
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return b


@router.post("/broadcasts/ai-message")
async def ai_broadcast_message(payload: AIBroadcastReq):
    try:
        text = await generate_broadcast_message(payload.goal, payload.audience)
        return {"message": text}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/broadcasts/{bid}/send", response_model=BroadcastOut)
async def send_broadcast(bid: int, db: AsyncSession = Depends(get_db)):
    b = await db.get(WhatsAppBroadcast, bid)
    if not b:
        raise HTTPException(404, "Broadcast not found")
    if b.status not in (BroadcastStatus.DRAFT, BroadcastStatus.FAILED):
        raise HTTPException(400, f"Cannot send broadcast in status '{b.status}'")

    # Get target contacts
    q = select(WhatsAppContact).where(WhatsAppContact.opt_in == True)
    if b.target_filter == "qualified":
        q = q.where(WhatsAppContact.is_qualified == True)
    elif b.target_filter == "unqualified":
        q = q.where(WhatsAppContact.is_qualified == False)
    contacts = (await db.execute(q)).scalars().all()

    b.status = BroadcastStatus.SENDING
    b.recipient_count = len(contacts)
    await db.commit()

    sent, failed = 0, 0
    for contact in contacts:
        try:
            result = await send_text_message(contact.wa_id, b.message_body or "")
            if "messages" in result or not settings.WHATSAPP_PHONE_NUMBER_ID:
                sent += 1
                # Record message
                db.add(WhatsAppMessage(
                    contact_id=contact.id,
                    direction=MessageDirection.OUTBOUND,
                    body=b.message_body,
                    status=MessageStatus.SENT,
                ))
            else:
                failed += 1
        except Exception:
            failed += 1

    b.sent_count = sent
    b.failed_count = failed
    b.delivered_count = sent
    b.status = BroadcastStatus.SENT
    b.sent_at = datetime.utcnow()
    await db.commit()
    await db.refresh(b)
    return b


@router.delete("/broadcasts/{bid}", status_code=204)
async def delete_broadcast(bid: int, db: AsyncSession = Depends(get_db)):
    b = await db.get(WhatsAppBroadcast, bid)
    if not b:
        raise HTTPException(404, "Broadcast not found")
    await db.delete(b)
    await db.commit()


# ── Quick send helpers ──────────────────────────────────────────────────────

class QuickSendReq(BaseModel):
    contact_id: int
    type: Literal["proposal", "invoice", "site_preview"]
    link: str
    note: str | None = None

@router.post("/quick-send", response_model=MessageOut, status_code=201)
async def quick_send(payload: QuickSendReq, db: AsyncSession = Depends(get_db)):
    """Send a proposal/invoice/site-preview link via WhatsApp."""
    contact = await db.get(WhatsAppContact, payload.contact_id)
    if not contact:
        raise HTTPException(404, "Contact not found")

    type_labels = {"proposal": "proposal", "invoice": "invoice", "site_preview": "website preview"}
    label = type_labels.get(payload.type, "document")
    body = f"Hi {contact.name or 'there'}! 👋 Here's your {label}: {payload.link}"
    if payload.note:
        body += f"\n\n{payload.note}"

    msg = WhatsAppMessage(
        contact_id=contact.id,
        direction=MessageDirection.OUTBOUND,
        body=body,
        status=MessageStatus.SENT,
    )
    db.add(msg)
    contact.last_message_at = datetime.utcnow()
    contact.last_message_preview = body[:100]
    await db.flush()

    result = await send_text_message(contact.wa_id, body)
    if "messages" in result:
        msg.wa_message_id = result["messages"][0].get("id")
        msg.status = MessageStatus.DELIVERED

    await db.commit()
    await db.refresh(msg)
    return msg
