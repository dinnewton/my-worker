import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.core.database import Base


class MessageDirection(str, enum.Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class MessageStatus(str, enum.Enum):
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"


class MessageType(str, enum.Enum):
    TEXT = "text"
    TEMPLATE = "template"
    IMAGE = "image"
    DOCUMENT = "document"
    AUDIO = "audio"
    INTERACTIVE = "interactive"


class TemplateCategory(str, enum.Enum):
    MARKETING = "MARKETING"
    UTILITY = "UTILITY"
    AUTHENTICATION = "AUTHENTICATION"


class TemplateStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class BroadcastStatus(str, enum.Enum):
    DRAFT = "draft"
    SENDING = "sending"
    SENT = "sent"
    FAILED = "failed"


class WhatsAppContact(Base):
    __tablename__ = "whatsapp_contacts"

    id = Column(Integer, primary_key=True, index=True)
    wa_id = Column(String(50), unique=True, index=True)   # WhatsApp phone number (E.164)
    phone = Column(String(50))
    name = Column(String(200))
    profile_name = Column(String(200))                    # Name from WhatsApp profile
    is_qualified = Column(Boolean, default=False)
    qualification_notes = Column(Text)
    lead_score = Column(Integer, default=0)
    suggested_action = Column(String(100))                # next recommended action
    opt_in = Column(Boolean, default=True)
    unread_count = Column(Integer, default=0)
    last_message_at = Column(DateTime)
    last_message_preview = Column(String(200))
    created_at = Column(DateTime, default=datetime.utcnow)

    messages = relationship(
        "WhatsAppMessage", back_populates="contact",
        order_by="WhatsAppMessage.created_at", cascade="all, delete-orphan"
    )


class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_messages"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("whatsapp_contacts.id", ondelete="CASCADE"))
    wa_message_id = Column(String(200), unique=True, nullable=True)  # Meta's message ID
    direction = Column(SAEnum(MessageDirection))
    message_type = Column(SAEnum(MessageType), default=MessageType.TEXT)
    body = Column(Text)
    template_name = Column(String(200))
    media_url = Column(String(500))
    media_caption = Column(String(500))
    status = Column(SAEnum(MessageStatus), default=MessageStatus.SENT)
    is_ai_generated = Column(Boolean, default=False)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    contact = relationship("WhatsAppContact", back_populates="messages")


class WhatsAppTemplate(Base):
    __tablename__ = "whatsapp_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), unique=True)
    category = Column(SAEnum(TemplateCategory), default=TemplateCategory.MARKETING)
    language = Column(String(10), default="en")
    header_text = Column(Text)
    body_text = Column(Text)
    footer_text = Column(Text)
    buttons = Column(Text)           # JSON array of button objects
    variables = Column(Text)         # JSON array of variable names used
    status = Column(SAEnum(TemplateStatus), default=TemplateStatus.DRAFT)
    meta_template_id = Column(String(200))    # ID from Meta after approval
    use_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WhatsAppBroadcast(Base):
    __tablename__ = "whatsapp_broadcasts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200))
    template_id = Column(Integer, ForeignKey("whatsapp_templates.id"), nullable=True)
    message_body = Column(Text)
    target_filter = Column(String(100), default="all")  # all | qualified | unqualified
    recipient_count = Column(Integer, default=0)
    sent_count = Column(Integer, default=0)
    delivered_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    status = Column(SAEnum(BroadcastStatus), default=BroadcastStatus.DRAFT)
    scheduled_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    template = relationship("WhatsAppTemplate")
