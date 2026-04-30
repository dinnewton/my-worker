import enum
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Float, Integer, Boolean, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class TeamRole(str, enum.Enum):
    OWNER   = "owner"
    ADMIN   = "admin"
    MANAGER = "manager"
    VIEWER  = "viewer"


class AgencySettings(Base):
    """Singleton settings row (always id=1). Upsert with id=1 to update."""
    __tablename__ = "agency_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)

    # ── Business profile ──────────────────────────────────────────────────────
    agency_name:    Mapped[str]        = mapped_column(String(255), default="My Agency",   nullable=False)
    agency_email:   Mapped[str]        = mapped_column(String(255), default="",            nullable=False)
    agency_phone:   Mapped[str | None] = mapped_column(String(50),  nullable=True)
    agency_website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    agency_logo_url:Mapped[str | None] = mapped_column(String(500), nullable=True)
    tagline:        Mapped[str | None] = mapped_column(String(255), nullable=True)
    timezone:       Mapped[str]        = mapped_column(String(100), default="UTC",         nullable=False)
    currency:       Mapped[str]        = mapped_column(String(10),  default="USD",         nullable=False)

    # Services & pricing
    services_offered:  Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string[]
    pricing_model:     Mapped[str]        = mapped_column(String(20), default="both", nullable=False)  # project|retainer|both
    starting_price:    Mapped[float]      = mapped_column(Float, default=500.0, nullable=False)

    # ── Social profiles ────────────────────────────────────────────────────────
    twitter_handle:  Mapped[str | None] = mapped_column(String(100), nullable=True)
    linkedin_url:    Mapped[str | None] = mapped_column(String(500), nullable=True)
    facebook_page:   Mapped[str | None] = mapped_column(String(500), nullable=True)
    instagram_handle:Mapped[str | None] = mapped_column(String(100), nullable=True)
    tiktok_handle:   Mapped[str | None] = mapped_column(String(100), nullable=True)

    # ── Notification preferences ───────────────────────────────────────────────
    notif_new_lead:        Mapped[bool]        = mapped_column(Boolean, default=True,  nullable=False)
    notif_proposal_viewed: Mapped[bool]        = mapped_column(Boolean, default=True,  nullable=False)
    notif_proposal_signed: Mapped[bool]        = mapped_column(Boolean, default=True,  nullable=False)
    notif_campaign_report: Mapped[bool]        = mapped_column(Boolean, default=False, nullable=False)
    notif_weekly_summary:  Mapped[bool]        = mapped_column(Boolean, default=True,  nullable=False)
    notif_email:           Mapped[str | None]  = mapped_column(String(255), nullable=True)
    notif_whatsapp:        Mapped[str | None]  = mapped_column(String(50),  nullable=True)

    # ── Working hours ──────────────────────────────────────────────────────────
    work_start_time: Mapped[str] = mapped_column(String(5),  default="09:00", nullable=False)  # HH:MM
    work_end_time:   Mapped[str] = mapped_column(String(5),  default="18:00", nullable=False)
    work_days:       Mapped[str] = mapped_column(Text, default='["mon","tue","wed","thu","fri"]', nullable=False)  # JSON
    respect_working_hours: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ── Agent behavior ─────────────────────────────────────────────────────────
    agent_enabled:              Mapped[bool]  = mapped_column(Boolean, default=True,           nullable=False)
    agent_tone:                 Mapped[str]   = mapped_column(String(20), default="professional", nullable=False)  # professional|casual|friendly
    agent_aggressiveness:       Mapped[str]   = mapped_column(String(10), default="medium",    nullable=False)  # low|medium|high
    agent_auto_reply_whatsapp:  Mapped[bool]  = mapped_column(Boolean, default=True,           nullable=False)
    agent_auto_draft_proposals: Mapped[bool]  = mapped_column(Boolean, default=True,           nullable=False)
    agent_proposal_min_score:   Mapped[float] = mapped_column(Float,   default=70.0,           nullable=False)
    agent_daily_summary:        Mapped[bool]  = mapped_column(Boolean, default=True,           nullable=False)
    agent_summary_hour:         Mapped[int]   = mapped_column(Integer, default=8,              nullable=False)  # UTC hour
    agent_loop_interval_hours:  Mapped[int]   = mapped_column(Integer, default=1,              nullable=False)
    admin_email:                Mapped[str | None] = mapped_column(String(255), nullable=True)
    admin_whatsapp:             Mapped[str | None] = mapped_column(String(50),  nullable=True)
    # Follow-up cadence in days per aggressiveness level (serialised as JSON)
    followup_intervals:         Mapped[str] = mapped_column(Text, default='{"low":[3,7,14],"medium":[1,3,7],"high":[1,2,4]}', nullable=False)

    # ── API keys (stored as plaintext — protect DB access) ────────────────────
    anthropic_api_key:         Mapped[str | None] = mapped_column(Text, nullable=True)
    sendgrid_api_key:          Mapped[str | None] = mapped_column(Text, nullable=True)
    semrush_api_key:           Mapped[str | None] = mapped_column(Text, nullable=True)
    google_analytics_id:       Mapped[str | None] = mapped_column(String(50), nullable=True)
    stripe_secret_key:         Mapped[str | None] = mapped_column(Text, nullable=True)
    stripe_publishable_key:    Mapped[str | None] = mapped_column(String(255), nullable=True)
    # WhatsApp / Meta
    whatsapp_phone_number_id:  Mapped[str | None] = mapped_column(String(100), nullable=True)
    whatsapp_access_token:     Mapped[str | None] = mapped_column(Text, nullable=True)
    whatsapp_app_secret:       Mapped[str | None] = mapped_column(Text, nullable=True)
    # Social media publishing
    facebook_page_access_token:Mapped[str | None] = mapped_column(Text, nullable=True)
    instagram_business_id:     Mapped[str | None] = mapped_column(String(100), nullable=True)
    linkedin_access_token:     Mapped[str | None] = mapped_column(Text, nullable=True)
    tiktok_access_token:       Mapped[str | None] = mapped_column(Text, nullable=True)
    twitter_api_key:           Mapped[str | None] = mapped_column(Text, nullable=True)
    twitter_api_secret:        Mapped[str | None] = mapped_column(Text, nullable=True)
    twitter_access_token:      Mapped[str | None] = mapped_column(Text, nullable=True)
    twitter_access_secret:     Mapped[str | None] = mapped_column(Text, nullable=True)
    # Deployment
    netlify_access_token:      Mapped[str | None] = mapped_column(Text, nullable=True)
    vercel_access_token:       Mapped[str | None] = mapped_column(Text, nullable=True)
    # IMAP for email lead detection
    imap_host:     Mapped[str | None] = mapped_column(String(255), nullable=True)
    imap_port:     Mapped[int]        = mapped_column(Integer, default=993, nullable=False)
    imap_user:     Mapped[str | None] = mapped_column(String(255), nullable=True)
    imap_password: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Automation schedules ──────────────────────────────────────────────────
    schedule_content:         Mapped[str] = mapped_column(String(10), default="24h", nullable=False)
    schedule_lead_scoring:    Mapped[str] = mapped_column(String(10), default="6h",  nullable=False)
    schedule_seo_monitoring:  Mapped[str] = mapped_column(String(10), default="72h", nullable=False)
    schedule_campaign_reports:Mapped[str] = mapped_column(String(10), default="24h", nullable=False)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class TeamMember(Base):
    __tablename__ = "team_members"

    id:            Mapped[int]        = mapped_column(primary_key=True, index=True)
    name:          Mapped[str]        = mapped_column(String(255), nullable=False)
    email:         Mapped[str]        = mapped_column(String(255), unique=True, nullable=False, index=True)
    role:          Mapped[str]        = mapped_column(SAEnum(TeamRole), default=TeamRole.VIEWER, nullable=False)
    avatar_url:    Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active:     Mapped[bool]       = mapped_column(Boolean, default=True, nullable=False)
    invited_by:    Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_active_at:Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    invited_at:    Mapped[datetime]   = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    @property
    def initials(self) -> str:
        parts = self.name.split()
        return "".join(p[0].upper() for p in parts[:2]) if parts else "?"
