from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Integer, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
import enum


class ActivityKind(str, enum.Enum):
    NOTE = "note"
    CALL = "call"
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    MEETING = "meeting"
    STATUS_CHANGE = "status_change"
    SCORE_UPDATE = "score_update"
    TASK_CREATED = "task_created"
    TASK_COMPLETED = "task_completed"
    PROPOSAL_SENT = "proposal_sent"
    AI_ACTION = "ai_action"
    FORM_SUBMIT = "form_submit"


class LeadActivity(Base):
    __tablename__ = "lead_activities"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    lead_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(SAEnum(ActivityKind), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(100), default="agent", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
