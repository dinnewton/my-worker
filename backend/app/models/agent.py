import enum
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Integer, Float, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class AgentRunType(str, enum.Enum):
    FULL_LOOP      = "full_loop"
    WHATSAPP_CHECK = "whatsapp_check"
    EMAIL_LEADS    = "email_leads"
    FOLLOWUP_LEADS = "followup_leads"
    AUTO_PROPOSALS = "auto_proposals"
    WEBSITE_QUEUE  = "website_queue"
    DAILY_SUMMARY  = "daily_summary"


class AgentRunStatus(str, enum.Enum):
    RUNNING = "running"
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED  = "failed"
    SKIPPED = "skipped"


class AgentTrigger(str, enum.Enum):
    SCHEDULED = "scheduled"
    MANUAL    = "manual"


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id:                Mapped[int]        = mapped_column(primary_key=True, index=True)
    run_type:          Mapped[str]        = mapped_column(SAEnum(AgentRunType), nullable=False, index=True)
    status:            Mapped[str]        = mapped_column(
        SAEnum(AgentRunStatus), default=AgentRunStatus.RUNNING, nullable=False, index=True
    )
    trigger:           Mapped[str]        = mapped_column(
        SAEnum(AgentTrigger), default=AgentTrigger.SCHEDULED, nullable=False
    )
    actions_taken:     Mapped[int]        = mapped_column(Integer, default=0, nullable=False)
    actions_succeeded: Mapped[int]        = mapped_column(Integer, default=0, nullable=False)
    actions_failed:    Mapped[int]        = mapped_column(Integer, default=0, nullable=False)
    summary:           Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message:     Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at:        Mapped[datetime]   = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        nullable=False, index=True,
    )
    completed_at:      Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds:  Mapped[float | None]    = mapped_column(Float, nullable=True)

    actions: Mapped[list["AgentAction"]] = relationship(
        "AgentAction", back_populates="run", cascade="all, delete-orphan",
        order_by="AgentAction.created_at",
    )


class AgentAction(Base):
    __tablename__ = "agent_actions"

    id:          Mapped[int]        = mapped_column(primary_key=True, index=True)
    run_id:      Mapped[int]        = mapped_column(
        Integer, ForeignKey("agent_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tool_name:   Mapped[str]        = mapped_column(String(100), nullable=False)
    tool_input:  Mapped[str | None] = mapped_column(Text, nullable=True)   # JSON
    tool_output: Mapped[str | None] = mapped_column(Text, nullable=True)   # JSON
    status:      Mapped[str]        = mapped_column(String(20), default="success", nullable=False)
    error:       Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at:  Mapped[datetime]   = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    run: Mapped["AgentRun"] = relationship("AgentRun", back_populates="actions")
