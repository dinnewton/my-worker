import enum
import secrets
from datetime import datetime, timezone
from sqlalchemy import String, Text, Float, Integer, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class InvoiceStatus(str, enum.Enum):
    DRAFT     = "draft"
    SENT      = "sent"
    VIEWED    = "viewed"
    PAID      = "paid"
    PARTIAL   = "partial"
    OVERDUE   = "overdue"
    CANCELLED = "cancelled"


class PaymentMethod(str, enum.Enum):
    STRIPE        = "stripe"
    MPESA         = "mpesa"
    BANK_TRANSFER = "bank_transfer"
    CASH          = "cash"
    OTHER         = "other"


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int]          = mapped_column(primary_key=True, index=True)
    proposal_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("proposals.id", ondelete="SET NULL"), nullable=True)
    invoice_number: Mapped[str]     = mapped_column(String(50), unique=True, index=True)

    # Client info
    client_name: Mapped[str]          = mapped_column(String(255))
    client_email: Mapped[str | None]  = mapped_column(String(255), nullable=True)
    client_phone: Mapped[str | None]  = mapped_column(String(50), nullable=True)
    client_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    client_company: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Line items (JSON array: [{description, quantity, unit_price, amount}])
    items: Mapped[str]   = mapped_column(Text, default="[]")
    currency: Mapped[str] = mapped_column(String(10), default="USD")

    # Financials
    subtotal:        Mapped[float] = mapped_column(Float, default=0.0)
    tax_rate:        Mapped[float] = mapped_column(Float, default=0.0)   # percentage, e.g. 16.0
    tax_amount:      Mapped[float] = mapped_column(Float, default=0.0)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0)
    total:           Mapped[float] = mapped_column(Float, default=0.0)
    amount_paid:     Mapped[float] = mapped_column(Float, default=0.0)

    # Status & payment
    status:         Mapped[str] = mapped_column(SAEnum(InvoiceStatus), default=InvoiceStatus.DRAFT)
    payment_method: Mapped[str | None] = mapped_column(SAEnum(PaymentMethod), nullable=True)

    # Stripe
    stripe_checkout_session_id: Mapped[str | None] = mapped_column(String(300), nullable=True)
    stripe_payment_url:         Mapped[str | None] = mapped_column(String(500), nullable=True)

    # M-Pesa
    mpesa_checkout_request_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    mpesa_merchant_request_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    mpesa_phone:               Mapped[str | None] = mapped_column(String(20), nullable=True)
    mpesa_receipt:             Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Sharing
    share_token: Mapped[str] = mapped_column(
        String(64), default=lambda: secrets.token_urlsafe(32), unique=True, index=True
    )

    # Dates
    due_date:   Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at:    Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    viewed_at:  Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at:    Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime]        = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime]        = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
