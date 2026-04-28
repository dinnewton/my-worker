from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Integer, Boolean, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
import enum


class TaskPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TaskType(str, enum.Enum):
    CALL = "call"
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    MEETING = "meeting"
    PROPOSAL = "proposal"
    FOLLOW_UP = "follow_up"
    RESEARCH = "research"
    OTHER = "other"


class FollowUpTask(Base):
    __tablename__ = "followup_tasks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    lead_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    task_type: Mapped[str] = mapped_column(
        SAEnum(TaskType), default=TaskType.FOLLOW_UP, nullable=False
    )
    priority: Mapped[str] = mapped_column(
        SAEnum(TaskPriority), default=TaskPriority.MEDIUM, nullable=False
    )
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
