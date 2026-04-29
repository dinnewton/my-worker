from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Integer, Float, Boolean, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
import enum


class SEOProjectStatus(str, enum.Enum):
    ACTIVE   = "active"
    PAUSED   = "paused"
    COMPLETE = "complete"


class SEOProject(Base):
    __tablename__ = "seo_projects"

    id: Mapped[int]           = mapped_column(primary_key=True, index=True)
    lead_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)
    client_name: Mapped[str]  = mapped_column(String(255), nullable=False)
    website_url: Mapped[str]  = mapped_column(String(500), nullable=False)
    status: Mapped[str]       = mapped_column(SAEnum(SEOProjectStatus), default=SEOProjectStatus.ACTIVE, nullable=False)

    # Audit results (JSON)
    keywords: Mapped[str | None]          = mapped_column(Text, nullable=True)  # JSON [{keyword, volume, difficulty, ranking}]
    technical_issues: Mapped[str | None]  = mapped_column(Text, nullable=True)  # JSON [{severity, issue, fix}]
    backlinks: Mapped[str | None]         = mapped_column(Text, nullable=True)  # JSON
    competitors: Mapped[str | None]       = mapped_column(Text, nullable=True)  # JSON
    recommendations: Mapped[str | None]   = mapped_column(Text, nullable=True)  # JSON

    # Scores
    seo_score: Mapped[int | None]         = mapped_column(Integer, nullable=True)
    technical_score: Mapped[int | None]   = mapped_column(Integer, nullable=True)
    content_score: Mapped[int | None]     = mapped_column(Integer, nullable=True)
    authority_score: Mapped[int | None]   = mapped_column(Integer, nullable=True)

    # Traffic estimates
    estimated_monthly_traffic: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_monthly_traffic: Mapped[int | None]    = mapped_column(Integer, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_audit_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc), nullable=False,
    )
