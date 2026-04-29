import json
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.invoice import Invoice, InvoiceStatus, PaymentMethod
from app.services.invoice_service import (
    next_invoice_number, generate_invoice_pdf,
    create_stripe_checkout, handle_stripe_webhook,
    initiate_mpesa_stk_push, send_invoice_email,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/invoices", tags=["invoices"])


# ── Schemas ─────────────────────────────────────────────────────────────────

class LineItem(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float
    amount: float | None = None

class InvoiceOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int; invoice_number: str; proposal_id: int | None
    client_name: str; client_email: str | None; client_phone: str | None
    client_company: str | None; client_address: str | None
    items: str; currency: str
    subtotal: float; tax_rate: float; tax_amount: float
    discount_amount: float; total: float; amount_paid: float
    status: InvoiceStatus; payment_method: PaymentMethod | None
    stripe_payment_url: str | None; mpesa_phone: str | None; mpesa_receipt: str | None
    share_token: str; notes: str | None
    due_date: datetime | None; sent_at: datetime | None; paid_at: datetime | None
    created_at: datetime; updated_at: datetime

class InvoiceCreate(BaseModel):
    proposal_id: int | None = None
    client_name: str; client_email: str | None = None; client_phone: str | None = None
    client_company: str | None = None; client_address: str | None = None
    items: list[LineItem]
    currency: str = "USD"
    tax_rate: float = 0.0
    discount_amount: float = 0.0
    due_date: datetime | None = None
    notes: str | None = None

class InvoiceUpdate(BaseModel):
    client_name: str | None = None; client_email: str | None = None
    client_phone: str | None = None; client_company: str | None = None
    client_address: str | None = None
    items: list[LineItem] | None = None
    currency: str | None = None
    tax_rate: float | None = None; discount_amount: float | None = None
    due_date: datetime | None = None; notes: str | None = None
    status: InvoiceStatus | None = None

class MpesaRequest(BaseModel):
    phone: str   # e.g. +254712345678


def _compute_totals(items: list[LineItem], tax_rate: float, discount: float) -> tuple[float, float, float, float]:
    for item in items:
        if item.amount is None:
            item.amount = round(item.quantity * item.unit_price, 2)
    subtotal = round(sum(i.amount for i in items), 2)
    tax_amt  = round(subtotal * tax_rate / 100, 2)
    total    = round(subtotal + tax_amt - discount, 2)
    return subtotal, tax_amt, total, discount


# ── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def invoice_stats(db: AsyncSession = Depends(get_db)):
    invs = (await db.execute(select(Invoice))).scalars().all()
    total_invoiced = sum(i.total for i in invs)
    total_paid     = sum(i.amount_paid for i in invs)
    overdue        = [i for i in invs if i.status == InvoiceStatus.OVERDUE]
    return {
        "total": len(invs),
        "total_invoiced": round(total_invoiced, 2),
        "total_paid": round(total_paid, 2),
        "total_outstanding": round(total_invoiced - total_paid, 2),
        "overdue": len(overdue),
        "by_status": {s.value: sum(1 for i in invs if i.status == s) for s in InvoiceStatus},
    }


# ── CRUD ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[InvoiceOut])
async def list_invoices(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Invoice).order_by(desc(Invoice.created_at)))
    return result.scalars().all()


@router.post("", response_model=InvoiceOut, status_code=201)
async def create_invoice(payload: InvoiceCreate, db: AsyncSession = Depends(get_db)):
    subtotal, tax_amt, total, discount = _compute_totals(
        payload.items, payload.tax_rate, payload.discount_amount
    )
    inv = Invoice(
        invoice_number=await next_invoice_number(db),
        proposal_id=payload.proposal_id,
        client_name=payload.client_name,
        client_email=payload.client_email,
        client_phone=payload.client_phone,
        client_company=payload.client_company,
        client_address=payload.client_address,
        items=json.dumps([i.model_dump() for i in payload.items]),
        currency=payload.currency,
        tax_rate=payload.tax_rate,
        tax_amount=tax_amt,
        discount_amount=discount,
        subtotal=subtotal,
        total=total,
        due_date=payload.due_date or datetime.now(timezone.utc) + timedelta(days=30),
        notes=payload.notes,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return inv


@router.get("/{iid}", response_model=InvoiceOut)
async def get_invoice(iid: int, db: AsyncSession = Depends(get_db)):
    inv = await db.get(Invoice, iid)
    if not inv: raise HTTPException(404, "Invoice not found")
    return inv


@router.patch("/{iid}", response_model=InvoiceOut)
async def update_invoice(iid: int, payload: InvoiceUpdate, db: AsyncSession = Depends(get_db)):
    inv = await db.get(Invoice, iid)
    if not inv: raise HTTPException(404, "Invoice not found")

    if payload.items is not None:
        subtotal, tax_amt, total, discount = _compute_totals(
            payload.items,
            payload.tax_rate if payload.tax_rate is not None else inv.tax_rate,
            payload.discount_amount if payload.discount_amount is not None else inv.discount_amount,
        )
        inv.items = json.dumps([i.model_dump() for i in payload.items])
        inv.subtotal = subtotal; inv.tax_amount = tax_amt
        inv.total = total; inv.discount_amount = discount

    for field in ["client_name","client_email","client_phone","client_company",
                  "client_address","currency","tax_rate","discount_amount","due_date","notes","status"]:
        val = getattr(payload, field)
        if val is not None:
            setattr(inv, field, val)

    if payload.status == InvoiceStatus.PAID and not inv.paid_at:
        inv.paid_at = datetime.now(timezone.utc)
        inv.amount_paid = inv.total

    await db.commit(); await db.refresh(inv); return inv


@router.delete("/{iid}", status_code=204)
async def delete_invoice(iid: int, db: AsyncSession = Depends(get_db)):
    inv = await db.get(Invoice, iid)
    if not inv: raise HTTPException(404, "Invoice not found")
    await db.delete(inv); await db.commit()


# ── Mark paid ────────────────────────────────────────────────────────────────

@router.patch("/{iid}/mark-paid", response_model=InvoiceOut)
async def mark_paid(iid: int, db: AsyncSession = Depends(get_db)):
    inv = await db.get(Invoice, iid)
    if not inv: raise HTTPException(404, "Invoice not found")
    inv.status = InvoiceStatus.PAID
    inv.paid_at = datetime.now(timezone.utc)
    inv.amount_paid = inv.total
    await db.commit(); await db.refresh(inv); return inv


# ── PDF export ───────────────────────────────────────────────────────────────

@router.get("/{iid}/pdf")
async def download_pdf(iid: int, db: AsyncSession = Depends(get_db)):
    inv = await db.get(Invoice, iid)
    if not inv: raise HTTPException(404, "Invoice not found")
    pdf = generate_invoice_pdf(inv)
    return Response(
        content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{inv.invoice_number}.pdf"'},
    )


# ── Email delivery ────────────────────────────────────────────────────────────

@router.post("/{iid}/send-email")
async def send_by_email(iid: int, db: AsyncSession = Depends(get_db)):
    inv = await db.get(Invoice, iid)
    if not inv: raise HTTPException(404, "Invoice not found")
    if not inv.client_email: raise HTTPException(400, "Invoice has no client email")

    pdf = generate_invoice_pdf(inv)
    ok  = await send_invoice_email(inv, pdf)
    if ok:
        inv.status = InvoiceStatus.SENT
        inv.sent_at = datetime.now(timezone.utc)
        await db.commit()
    return {"sent": ok}


# ── Stripe checkout ──────────────────────────────────────────────────────────

@router.post("/{iid}/stripe-checkout")
async def stripe_checkout(iid: int, db: AsyncSession = Depends(get_db)):
    inv = await db.get(Invoice, iid)
    if not inv: raise HTTPException(404, "Invoice not found")

    result = await create_stripe_checkout(inv)
    if result.get("url"):
        inv.stripe_checkout_session_id = result["session_id"]
        inv.stripe_payment_url = result["url"]
        inv.payment_method = PaymentMethod.STRIPE
        if inv.status == InvoiceStatus.DRAFT:
            inv.status = InvoiceStatus.SENT
        await db.commit()
    return result


# ── Stripe webhook ───────────────────────────────────────────────────────────

@router.post("/stripe-webhook", include_in_schema=False)
async def stripe_webhook_handler(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    event = await handle_stripe_webhook(payload, sig)

    if event.get("type") == "checkout.session.completed":
        session = event["data"]["object"]
        inv_id = session.get("metadata", {}).get("invoice_id")
        if inv_id:
            inv = await db.get(Invoice, int(inv_id))
            if inv:
                inv.status = InvoiceStatus.PAID
                inv.paid_at = datetime.now(timezone.utc)
                inv.amount_paid = inv.total
                await db.commit()
    return {"received": True}


# ── M-Pesa ───────────────────────────────────────────────────────────────────

@router.post("/{iid}/mpesa")
async def mpesa_stk(iid: int, payload: MpesaRequest, db: AsyncSession = Depends(get_db)):
    inv = await db.get(Invoice, iid)
    if not inv: raise HTTPException(404, "Invoice not found")

    result = await initiate_mpesa_stk_push(inv, payload.phone)
    if result.get("success"):
        inv.mpesa_checkout_request_id = result.get("checkout_request_id")
        inv.mpesa_merchant_request_id = result.get("merchant_request_id")
        inv.mpesa_phone = payload.phone
        inv.payment_method = PaymentMethod.MPESA
        if inv.status == InvoiceStatus.DRAFT:
            inv.status = InvoiceStatus.SENT
        await db.commit()
    return result


@router.post("/mpesa-callback", include_in_schema=False)
async def mpesa_callback(request: Request, db: AsyncSession = Depends(get_db)):
    """Safaricom calls this with the STK push result."""
    try:
        body = await request.json()
        stk = body.get("Body", {}).get("stkCallback", {})
        checkout_id = stk.get("CheckoutRequestID")
        result_code = stk.get("ResultCode")

        if checkout_id:
            result = await db.execute(
                select(Invoice).where(Invoice.mpesa_checkout_request_id == checkout_id)
            )
            inv = result.scalar_one_or_none()
            if inv and result_code == 0:
                items = stk.get("CallbackMetadata", {}).get("Item", [])
                receipt = next((i["Value"] for i in items if i["Name"] == "MpesaReceiptNumber"), None)
                inv.status = InvoiceStatus.PAID
                inv.paid_at = datetime.now(timezone.utc)
                inv.amount_paid = inv.total
                inv.mpesa_receipt = receipt
                await db.commit()
    except Exception as e:
        logger.error(f"M-Pesa callback error: {e}")
    return {"ResultCode": 0, "ResultDesc": "Accepted"}


# ── Public share view ────────────────────────────────────────────────────────

@router.get("/share/{token}", response_model=InvoiceOut)
async def view_shared_invoice(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Invoice).where(Invoice.share_token == token))
    inv = result.scalar_one_or_none()
    if not inv: raise HTTPException(404, "Invoice not found")
    if inv.status == InvoiceStatus.SENT and not inv.viewed_at:
        inv.status = InvoiceStatus.VIEWED
        inv.viewed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(inv)
    return inv
