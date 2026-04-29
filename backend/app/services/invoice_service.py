"""
Invoice service — PDF generation, Stripe checkout, M-Pesa STK push, email delivery.
"""
import base64
import hashlib
import io
import json
import logging
from datetime import datetime, timezone, timedelta

import httpx

from app.core.config import settings
from app.models.invoice import Invoice

logger = logging.getLogger(__name__)


# ── Number generator ────────────────────────────────────────────────────────

async def next_invoice_number(db) -> str:
    from sqlalchemy import func, select
    from app.models.invoice import Invoice as Inv
    result = await db.execute(select(func.count()).select_from(Inv))
    count = result.scalar() or 0
    year = datetime.now(timezone.utc).year
    return f"INV-{year}-{count + 1:04d}"


# ── PDF ─────────────────────────────────────────────────────────────────────

def generate_invoice_pdf(invoice: Invoice) -> bytes:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib.colors import HexColor, white
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT, TA_JUSTIFY

        BRAND  = HexColor("#6366f1")
        DARK   = HexColor("#111827")
        GRAY   = HexColor("#6b7280")
        LIGHT  = HexColor("#f9fafb")
        GREEN  = HexColor("#10b981")
        RED    = HexColor("#ef4444")

        styles = getSampleStyleSheet()
        h1 = ParagraphStyle("H1", parent=styles["Normal"], fontSize=26,
            textColor=DARK, fontName="Helvetica-Bold", spaceAfter=4)
        label = ParagraphStyle("Label", parent=styles["Normal"], fontSize=9,
            textColor=GRAY, leading=13)
        body = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10,
            textColor=DARK, leading=15, spaceAfter=4)
        right = ParagraphStyle("Right", parent=body, alignment=TA_RIGHT)

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4,
            rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)

        story = []

        # Header row: INVOICE label + invoice number
        header = Table(
            [[Paragraph("INVOICE", ParagraphStyle("Inv", parent=styles["Normal"],
                fontSize=28, textColor=BRAND, fontName="Helvetica-Bold")),
              Paragraph(f"<b>{invoice.invoice_number}</b>", right)]],
            colWidths=[9*cm, 8*cm]
        )
        header.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "BOTTOM")]))
        story.append(header)
        story.append(HRFlowable(width="100%", thickness=2, color=BRAND, spaceAfter=10))

        # From / To / Invoice info
        from_text = "FROM\nMyWorker Digital Agency\ncontact@myworker.ai"
        to_lines = [invoice.client_name]
        if invoice.client_company: to_lines.append(invoice.client_company)
        if invoice.client_email:   to_lines.append(invoice.client_email)
        if invoice.client_phone:   to_lines.append(invoice.client_phone)
        if invoice.client_address: to_lines.append(invoice.client_address)

        date_str = invoice.created_at.strftime("%B %d, %Y") if invoice.created_at else ""
        due_str  = invoice.due_date.strftime("%B %d, %Y") if invoice.due_date else "On Receipt"
        status_color = GREEN if invoice.status == "paid" else (RED if invoice.status == "overdue" else DARK)

        info_data = [
            [Paragraph(from_text.replace("\n","<br/>"), label),
             Paragraph(("TO\n" + "\n".join(to_lines)).replace("\n","<br/>"), label),
             Paragraph(
                 f"Date: {date_str}<br/>Due: {due_str}<br/>Currency: {invoice.currency}",
                 label
             )],
        ]
        info_t = Table(info_data, colWidths=[5.5*cm, 7*cm, 4.5*cm])
        info_t.setStyle(TableStyle([("VALIGN", (0,0),(-1,-1),"TOP"), ("PADDING",(0,0),(-1,-1),4)]))
        story.append(info_t)
        story.append(Spacer(1, 0.5*cm))

        # Line items table
        items_data = [["#", "Description", "Qty", "Unit Price", "Amount"]]
        items = json.loads(invoice.items or "[]")
        for i, item in enumerate(items, 1):
            qty   = item.get("quantity", 1)
            price = item.get("unit_price", 0.0)
            amt   = item.get("amount", qty * price)
            cur   = invoice.currency
            items_data.append([
                str(i),
                item.get("description", ""),
                str(qty),
                f"{cur} {price:,.2f}",
                f"{cur} {amt:,.2f}",
            ])

        items_t = Table(items_data, colWidths=[0.8*cm, 9*cm, 1.5*cm, 3*cm, 3*cm])
        items_t.setStyle(TableStyle([
            ("BACKGROUND", (0,0),(-1,0), BRAND),
            ("TEXTCOLOR",  (0,0),(-1,0), white),
            ("FONTNAME",   (0,0),(-1,0), "Helvetica-Bold"),
            ("FONTSIZE",   (0,0),(-1,-1), 9),
            ("ROWBACKGROUNDS", (0,1),(-1,-1), [LIGHT, white]),
            ("GRID",       (0,0),(-1,-1), 0.5, HexColor("#e5e7eb")),
            ("PADDING",    (0,0),(-1,-1), 7),
            ("ALIGN",      (2,0),(4,-1), "RIGHT"),
        ]))
        story.append(items_t)
        story.append(Spacer(1, 0.4*cm))

        # Totals
        cur = invoice.currency
        totals_data = [
            ["", "Subtotal:", f"{cur} {invoice.subtotal:,.2f}"],
        ]
        if invoice.tax_rate:
            totals_data.append(["", f"Tax ({invoice.tax_rate}%):", f"{cur} {invoice.tax_amount:,.2f}"])
        if invoice.discount_amount:
            totals_data.append(["", "Discount:", f"- {cur} {invoice.discount_amount:,.2f}"])
        totals_data.append(["", "TOTAL DUE:", f"{cur} {invoice.total:,.2f}"])
        if invoice.amount_paid:
            totals_data.append(["", "Amount Paid:", f"{cur} {invoice.amount_paid:,.2f}"])
            totals_data.append(["", "Balance Due:", f"{cur} {invoice.total - invoice.amount_paid:,.2f}"])

        totals_t = Table(totals_data, colWidths=[10*cm, 4*cm, 3*cm])
        totals_t.setStyle(TableStyle([
            ("FONTSIZE",  (0,0),(-1,-1), 9),
            ("FONTNAME",  (0,-1),(-1,-1), "Helvetica-Bold"),
            ("BACKGROUND",(0,-1),(-1,-1), HexColor("#f0fdf4")),
            ("TEXTCOLOR", (2,-1),(2,-1), GREEN),
            ("ALIGN",     (1,0),(2,-1), "RIGHT"),
            ("PADDING",   (0,0),(-1,-1), 5),
            ("LINEABOVE", (0,-1),(-1,-1), 1, BRAND),
        ]))
        story.append(totals_t)
        story.append(Spacer(1, 0.5*cm))

        # Payment info
        if invoice.stripe_payment_url:
            story.append(Paragraph(
                f"<b>Pay online:</b> {invoice.stripe_payment_url}",
                ParagraphStyle("Pay", parent=body, textColor=BRAND),
            ))
        if invoice.mpesa_phone:
            story.append(Paragraph(
                f"<b>M-Pesa:</b> Payment sent to {invoice.mpesa_phone}",
                body,
            ))

        # Status stamp
        if invoice.status == "paid":
            story.append(Paragraph(
                f"✓ PAID on {invoice.paid_at.strftime('%B %d, %Y') if invoice.paid_at else 'N/A'}",
                ParagraphStyle("Paid", parent=body, textColor=GREEN, fontName="Helvetica-Bold", fontSize=14),
            ))

        if invoice.notes:
            story.append(Spacer(1, 0.3*cm))
            story.append(Paragraph("<b>Notes:</b>", body))
            story.append(Paragraph(invoice.notes, label))

        story.append(Spacer(1, 0.8*cm))
        story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#e5e7eb"), spaceAfter=6))
        story.append(Paragraph(
            "Thank you for your business! — MyWorker Digital Agency",
            ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=GRAY, alignment=TA_CENTER),
        ))

        doc.build(story)
        return buf.getvalue()

    except ImportError:
        logger.warning("ReportLab not installed")
        return b"%PDF-1.4 placeholder"


# ── Stripe ──────────────────────────────────────────────────────────────────

async def create_stripe_checkout(invoice: Invoice) -> dict:
    """Create a Stripe Checkout session and return {url, session_id}."""
    if not settings.STRIPE_SECRET_KEY:
        return {"url": None, "session_id": None, "error": "Stripe not configured"}

    try:
        import stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY

        # Build line items
        items = json.loads(invoice.items or "[]")
        stripe_items = []
        for item in items:
            amt = int(item.get("amount", 0) * 100)  # cents
            if amt <= 0:
                continue
            stripe_items.append({
                "price_data": {
                    "currency": invoice.currency.lower(),
                    "unit_amount": amt,
                    "product_data": {"name": item.get("description", "Service")},
                },
                "quantity": 1,
            })

        if not stripe_items:
            # Fallback to total
            stripe_items = [{
                "price_data": {
                    "currency": invoice.currency.lower(),
                    "unit_amount": int(invoice.total * 100),
                    "product_data": {"name": f"Invoice {invoice.invoice_number}"},
                },
                "quantity": 1,
            }]

        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=stripe_items,
            mode="payment",
            customer_email=invoice.client_email or None,
            metadata={"invoice_id": str(invoice.id), "invoice_number": invoice.invoice_number},
            success_url=f"{settings.ALLOWED_ORIGINS.split(',')[0]}/invoices/paid?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.ALLOWED_ORIGINS.split(',')[0]}/invoices",
        )
        return {"url": session.url, "session_id": session.id}
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        return {"url": None, "session_id": None, "error": str(e)}


async def handle_stripe_webhook(payload: bytes, sig_header: str) -> dict:
    """Verify and parse a Stripe webhook event."""
    if not settings.STRIPE_WEBHOOK_SECRET:
        return {}
    try:
        import stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY
        event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
        return event
    except Exception as e:
        logger.error(f"Stripe webhook error: {e}")
        return {}


# ── M-Pesa (Safaricom Daraja) ────────────────────────────────────────────────

async def _mpesa_access_token() -> str:
    creds = base64.b64encode(
        f"{settings.MPESA_CONSUMER_KEY}:{settings.MPESA_CONSUMER_SECRET}".encode()
    ).decode()
    base = "https://sandbox.safaricom.co.ke" if settings.MPESA_ENV == "sandbox" else "https://api.safaricom.co.ke"
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            f"{base}/oauth/v1/generate?grant_type=client_credentials",
            headers={"Authorization": f"Basic {creds}"},
        )
        return resp.json().get("access_token", "")


async def initiate_mpesa_stk_push(invoice: Invoice, phone: str) -> dict:
    """Send an STK push to the customer's phone via Safaricom Daraja."""
    if not settings.MPESA_CONSUMER_KEY:
        return {"success": False, "error": "M-Pesa not configured"}

    try:
        token = await _mpesa_access_token()
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        password = base64.b64encode(
            f"{settings.MPESA_SHORTCODE}{settings.MPESA_PASSKEY}{timestamp}".encode()
        ).decode()

        amount = max(1, int(invoice.total))   # M-Pesa requires integer KES
        phone_clean = phone.lstrip("+").lstrip("0")
        if not phone_clean.startswith("254"):
            phone_clean = "254" + phone_clean

        base = "https://sandbox.safaricom.co.ke" if settings.MPESA_ENV == "sandbox" else "https://api.safaricom.co.ke"
        callback_url = settings.MPESA_CALLBACK_URL or f"{settings.ALLOWED_ORIGINS.split(',')[0]}/api/v1/invoices/mpesa-callback"

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{base}/mpesa/stkpush/v1/processrequest",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "BusinessShortCode": settings.MPESA_SHORTCODE,
                    "Password": password,
                    "Timestamp": timestamp,
                    "TransactionType": "CustomerPayBillOnline",
                    "Amount": amount,
                    "PartyA": phone_clean,
                    "PartyB": settings.MPESA_SHORTCODE,
                    "PhoneNumber": phone_clean,
                    "CallBackURL": callback_url,
                    "AccountReference": invoice.invoice_number,
                    "TransactionDesc": f"Payment for {invoice.invoice_number}",
                },
            )
            data = resp.json()
            if data.get("ResponseCode") == "0":
                return {
                    "success": True,
                    "checkout_request_id": data.get("CheckoutRequestID"),
                    "merchant_request_id": data.get("MerchantRequestID"),
                }
            return {"success": False, "error": data.get("errorMessage", "STK push failed"), "raw": data}
    except Exception as e:
        logger.error(f"M-Pesa STK push error: {e}")
        return {"success": False, "error": str(e)}


# ── Email delivery (SendGrid) ────────────────────────────────────────────────

async def send_invoice_email(invoice: Invoice, pdf_bytes: bytes) -> bool:
    """Send invoice PDF via SendGrid."""
    if not settings.SENDGRID_API_KEY or not invoice.client_email:
        logger.warning("SendGrid not configured or no client email")
        return False

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            payload = {
                "personalizations": [{"to": [{"email": invoice.client_email, "name": invoice.client_name}]}],
                "from": {"email": settings.EMAIL_FROM, "name": settings.EMAIL_FROM_NAME},
                "subject": f"Invoice {invoice.invoice_number} from MyWorker Agency",
                "content": [{
                    "type": "text/html",
                    "value": _invoice_email_html(invoice),
                }],
                "attachments": [{
                    "content": base64.b64encode(pdf_bytes).decode(),
                    "type": "application/pdf",
                    "filename": f"{invoice.invoice_number}.pdf",
                    "disposition": "attachment",
                }],
            }
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={"Authorization": f"Bearer {settings.SENDGRID_API_KEY}", "Content-Type": "application/json"},
                json=payload,
            )
            return resp.status_code in (200, 202)
    except Exception as e:
        logger.error(f"Invoice email error: {e}")
        return False


async def send_proposal_email(proposal, pdf_bytes: bytes, share_url: str) -> bool:
    """Send proposal PDF + share link via SendGrid."""
    if not settings.SENDGRID_API_KEY or not proposal.client_email:
        logger.warning("SendGrid not configured or no client email")
        return False

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            payload = {
                "personalizations": [{"to": [{"email": proposal.client_email, "name": proposal.client_name}]}],
                "from": {"email": settings.EMAIL_FROM, "name": settings.EMAIL_FROM_NAME},
                "subject": f"Proposal: {proposal.title}",
                "content": [{
                    "type": "text/html",
                    "value": _proposal_email_html(proposal, share_url),
                }],
                "attachments": [{
                    "content": base64.b64encode(pdf_bytes).decode(),
                    "type": "application/pdf",
                    "filename": f"proposal_{proposal.id}.pdf",
                    "disposition": "attachment",
                }],
            }
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={"Authorization": f"Bearer {settings.SENDGRID_API_KEY}", "Content-Type": "application/json"},
                json=payload,
            )
            return resp.status_code in (200, 202)
    except Exception as e:
        logger.error(f"Proposal email error: {e}")
        return False


def _invoice_email_html(invoice: Invoice) -> str:
    pay_btn = ""
    if invoice.stripe_payment_url:
        pay_btn = f'<a href="{invoice.stripe_payment_url}" style="display:inline-block;padding:12px 28px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">Pay Now (Card)</a>'

    return f"""<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;color:#111827">
<div style="background:#6366f1;padding:24px;border-radius:12px 12px 0 0;color:white">
  <h1 style="margin:0;font-size:24px">Invoice {invoice.invoice_number}</h1>
  <p style="margin:4px 0 0;opacity:.8">MyWorker Digital Agency</p>
</div>
<div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">
  <p>Hi {invoice.client_name},</p>
  <p>Please find your invoice attached. A summary is below:</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr style="background:#f9fafb"><td style="padding:10px;font-weight:600">Invoice Number</td><td style="padding:10px">{invoice.invoice_number}</td></tr>
    <tr><td style="padding:10px;font-weight:600">Amount Due</td><td style="padding:10px;font-weight:700;color:#6366f1">{invoice.currency} {invoice.total:,.2f}</td></tr>
    <tr style="background:#f9fafb"><td style="padding:10px;font-weight:600">Due Date</td><td style="padding:10px">{invoice.due_date.strftime('%B %d, %Y') if invoice.due_date else 'On Receipt'}</td></tr>
  </table>
  {pay_btn}
  <p style="margin-top:24px;color:#6b7280;font-size:14px">Thank you for your business!</p>
</div></body></html>"""


def _proposal_email_html(proposal, share_url: str) -> str:
    return f"""<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;color:#111827">
<div style="background:#6366f1;padding:24px;border-radius:12px 12px 0 0;color:white">
  <h1 style="margin:0;font-size:22px">{proposal.title}</h1>
  <p style="margin:4px 0 0;opacity:.8">MyWorker Digital Agency</p>
</div>
<div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">
  <p>Dear {proposal.client_name},</p>
  <p>Thank you for your interest. Please find your proposal attached and review it online via the secure link below.</p>
  <a href="{share_url}" style="display:inline-block;padding:12px 28px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">View & Sign Proposal</a>
  <p style="color:#6b7280;font-size:14px">The proposal is valid for 30 days. You can review, comment and e-sign directly in the browser — no app required.</p>
  <p style="color:#6b7280;font-size:14px">We look forward to working with you!</p>
</div></body></html>"""
