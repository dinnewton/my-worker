from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "MyWorker"
    APP_ENV: str = "development"
    SECRET_KEY: str = "dev-secret-key"
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    DATABASE_URL: str = "postgresql+asyncpg://myworker:myworker@localhost:5432/myworker"
    REDIS_URL: str = "redis://localhost:6379/0"

    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-sonnet-4-6"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    # M-Pesa (Safaricom Daraja)
    MPESA_CONSUMER_KEY: str = ""
    MPESA_CONSUMER_SECRET: str = ""
    MPESA_SHORTCODE: str = ""
    MPESA_PASSKEY: str = ""
    MPESA_CALLBACK_URL: str = ""
    MPESA_ENV: str = "sandbox"   # sandbox | production

    # Email (SendGrid)
    SENDGRID_API_KEY: str = ""
    EMAIL_FROM: str = "noreply@myworker.ai"
    EMAIL_FROM_NAME: str = "MyWorker Agency"

    # WhatsApp Business (Meta Cloud API)
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_ACCESS_TOKEN: str = ""
    WHATSAPP_VERIFY_TOKEN: str = "myworker_wh_verify_2024"
    WHATSAPP_APP_SECRET: str = ""
    WHATSAPP_AUTO_REPLY: bool = True

    # Netlify
    NETLIFY_ACCESS_TOKEN: str = ""

    # Vercel
    VERCEL_ACCESS_TOKEN: str = ""

    # WordPress (global fallback; per-site credentials stored in DB)
    WP_DEFAULT_URL: str = ""
    WP_DEFAULT_USER: str = ""
    WP_DEFAULT_APP_PASSWORD: str = ""

    AGENCY_NAME: str = "MyWorker Digital Agency"
    AGENCY_EMAIL: str = "contact@myworker.ai"
    LEAD_SCAN_INTERVAL_MINUTES: int = 30
    POST_SCHEDULE_HOUR: int = 9
    POST_SCHEDULE_MINUTE: int = 0

    # ─── Agent Brain (Module 7) ───────────────────────────────────────────────
    AGENT_ENABLED: bool = True
    ADMIN_EMAIL: str = ""           # recipient for daily summary email
    ADMIN_WHATSAPP: str = ""        # E.164, e.g. +254712345678
    # IMAP — check inbox for new lead inquiries
    IMAP_HOST: str = ""
    IMAP_PORT: int = 993
    IMAP_USER: str = ""
    IMAP_PASSWORD: str = ""
    # Minimum AI lead score to auto-draft a proposal
    AUTO_PROPOSAL_MIN_SCORE: float = 70.0
    # Hours between full agent loop runs
    AGENT_LOOP_INTERVAL_HOURS: int = 1
    # UTC hour for daily summary (0–23)
    AGENT_SUMMARY_HOUR: int = 8

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
