import json
import logging
import os
from datetime import datetime, timezone

from app.models.proposal import Proposal, ProposalTemplate
from app.services.ai_agent import get_client

logger = logging.getLogger(__name__)

TEMPLATE_LABELS = {
    ProposalTemplate.DIGITAL_MARKETING: "Digital Marketing",
    ProposalTemplate.WEB_DEVELOPMENT:   "Web Development",
    ProposalTemplate.SEO:               "SEO & Search Marketing",
    ProposalTemplate.SOCIAL_MEDIA:      "Social Media Management",
    ProposalTemplate.EMAIL_MARKETING:   "Email Marketing",
    ProposalTemplate.CONTENT_CREATION:  "Content Creation",
    ProposalTemplate.FULL_SERVICE:      "Full-Service Digital Agency",
    ProposalTemplate.CUSTOM:            "Custom Services",
}

SYSTEM_PROMPT = """You are an expert digital marketing agency proposal writer.
You write compelling, professional business proposals that win clients.
Your proposals are specific, results-oriented, and clearly communicate value.
Always respond with valid JSON only — no markdown, no extra text."""


async def generate_proposal(
    client_name: str,
    client_company: str | None,
    template_type: ProposalTemplate,
    services: list[str],
    budget: float,
    timeline_weeks: int,
    notes: str | None = None,
    lead_data: dict | None = None,
) -> dict:
    client = get_client()

    lead_context = ""
    if lead_data:
        lead_context = f"""
Lead Intelligence:
- Industry: {lead_data.get('industry', 'Unknown')}
- Current status: {lead_data.get('status', 'new')}
- AI score: {lead_data.get('score', 0)}/100
- Notes: {lead_data.get('notes', 'None')}
- AI summary: {lead_data.get('ai_summary', 'None')}
"""

    prompt = f"""Generate a complete, professional proposal for the following:

Client: {client_name}{f' at {client_company}' if client_company else ''}
Service type: {TEMPLATE_LABELS.get(template_type, 'Custom')}
Services requested: {', '.join(services)}
Budget: {'$' + str(budget) if budget > 0 else 'To be determined'}
Timeline: {timeline_weeks} weeks
Additional notes: {notes or 'None'}
{lead_context}

Return a JSON object with exactly these keys:
{{
  "title": "Proposal title (specific, compelling)",
  "cover_letter": "2-3 paragraph personalized cover letter addressing the client by name",
  "sections": [
    {{
      "heading": "Section heading",
      "content": "Full section content (2-4 paragraphs)"
    }}
  ],
  "deliverables": ["deliverable 1", "deliverable 2", ...],
  "timeline": [
    {{"week": "Week 1-2", "milestone": "milestone description"}},
    ...
  ],
  "pricing_breakdown": [
    {{"item": "Service name", "description": "Brief description", "price": 0.0}},
    ...
  ],
  "value": total_contract_value_float,
  "monthly_retainer": monthly_amount_float_or_0,
  "setup_fee": one_time_setup_float_or_0,
  "ai_win_tips": [
    "tip to increase win rate 1",
    "tip to increase win rate 2",
    "tip to increase win rate 3"
  ]
}}

Sections to include (adapt based on service type):
1. Executive Summary
2. Understanding Your Business / Challenge
3. Our Proposed Solution
4. Our Approach & Methodology
5. Expected Results & ROI
6. Why Choose Us
7. Investment & Terms

Make it compelling, specific, and professional. Use real numbers and outcomes where possible."""

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


async def get_win_tips(proposal: Proposal) -> list[str]:
    client = get_client()

    prompt = f"""Analyze this proposal and give 5 specific tips to increase the win rate:

Title: {proposal.title}
Client: {proposal.client_name} ({proposal.client_company or 'Unknown company'})
Template: {proposal.template_type}
Value: ${proposal.value:,.0f}
Services: {proposal.services}

Return JSON array of 5 strings only: ["tip1", "tip2", "tip3", "tip4", "tip5"]"""

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=500,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


def generate_pdf_bytes(proposal: Proposal) -> bytes:
    """Generate a PDF for the proposal using ReportLab."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib.colors import HexColor, black, white
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
        import io

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2 * cm,
            leftMargin=2 * cm,
            topMargin=2 * cm,
            bottomMargin=2 * cm,
        )

        BRAND   = HexColor("#6366f1")
        DARK    = HexColor("#111827")
        GRAY    = HexColor("#6b7280")
        LIGHT   = HexColor("#f9fafb")
        SUCCESS = HexColor("#10b981")

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle("Title", parent=styles["Normal"],
            fontSize=26, textColor=DARK, fontName="Helvetica-Bold",
            spaceAfter=6, alignment=TA_LEFT)
        h1_style = ParagraphStyle("H1", parent=styles["Normal"],
            fontSize=16, textColor=BRAND, fontName="Helvetica-Bold",
            spaceBefore=16, spaceAfter=6)
        h2_style = ParagraphStyle("H2", parent=styles["Normal"],
            fontSize=12, textColor=DARK, fontName="Helvetica-Bold",
            spaceBefore=10, spaceAfter=4)
        body_style = ParagraphStyle("Body", parent=styles["Normal"],
            fontSize=10, textColor=DARK, leading=16,
            spaceAfter=8, alignment=TA_JUSTIFY)
        small_style = ParagraphStyle("Small", parent=styles["Normal"],
            fontSize=8, textColor=GRAY, leading=12)
        sub_style = ParagraphStyle("Sub", parent=styles["Normal"],
            fontSize=9, textColor=GRAY, leading=13)

        story = []

        # ── Cover ──────────────────────────────────────────────────────────────
        story.append(Paragraph("PROPOSAL", ParagraphStyle("Label", parent=styles["Normal"],
            fontSize=10, textColor=BRAND, fontName="Helvetica-Bold", spaceAfter=4,
            tracking=2)))
        story.append(Paragraph(proposal.title, title_style))
        story.append(HRFlowable(width="100%", thickness=2, color=BRAND, spaceAfter=12))

        # Client info table
        prepared_for = f"<b>Prepared for:</b> {proposal.client_name}"
        if proposal.client_company:
            prepared_for += f", {proposal.client_company}"
        date_str = proposal.created_at.strftime("%B %d, %Y") if proposal.created_at else datetime.now().strftime("%B %d, %Y")
        story.append(Paragraph(prepared_for, body_style))
        story.append(Paragraph(f"<b>Prepared by:</b> MyWorker Agency", body_style))
        story.append(Paragraph(f"<b>Date:</b> {date_str}", body_style))
        if proposal.valid_until:
            story.append(Paragraph(f"<b>Valid until:</b> {proposal.valid_until.strftime('%B %d, %Y')}", body_style))
        story.append(Spacer(1, 0.5 * cm))

        # ── Cover Letter ───────────────────────────────────────────────────────
        if proposal.cover_letter:
            story.append(Paragraph("Cover Letter", h1_style))
            story.append(HRFlowable(width="100%", thickness=0.5, color=BRAND, spaceAfter=8))
            for para in proposal.cover_letter.split("\n\n"):
                if para.strip():
                    story.append(Paragraph(para.strip(), body_style))
            story.append(Spacer(1, 0.4 * cm))

        # ── Sections ──────────────────────────────────────────────────────────
        if proposal.sections:
            try:
                sections = json.loads(proposal.sections)
                for sec in sections:
                    story.append(Paragraph(sec.get("heading", ""), h1_style))
                    story.append(HRFlowable(width="100%", thickness=0.5, color=BRAND, spaceAfter=8))
                    content = sec.get("content", "")
                    for para in content.split("\n\n"):
                        if para.strip():
                            story.append(Paragraph(para.strip(), body_style))
                    story.append(Spacer(1, 0.3 * cm))
            except Exception:
                pass

        # ── Deliverables ──────────────────────────────────────────────────────
        if proposal.deliverables:
            try:
                deliverables = json.loads(proposal.deliverables)
                story.append(Paragraph("Deliverables", h1_style))
                story.append(HRFlowable(width="100%", thickness=0.5, color=BRAND, spaceAfter=8))
                for d in deliverables:
                    story.append(Paragraph(f"• {d}", body_style))
                story.append(Spacer(1, 0.3 * cm))
            except Exception:
                pass

        # ── Timeline ──────────────────────────────────────────────────────────
        if proposal.timeline:
            try:
                milestones = json.loads(proposal.timeline)
                story.append(Paragraph("Project Timeline", h1_style))
                story.append(HRFlowable(width="100%", thickness=0.5, color=BRAND, spaceAfter=8))
                t_data = [["Period", "Milestone"]]
                for m in milestones:
                    t_data.append([m.get("week", ""), m.get("milestone", "")])
                t = Table(t_data, colWidths=[4 * cm, 13 * cm])
                t.setStyle(TableStyle([
                    ("BACKGROUND",  (0, 0), (-1, 0), BRAND),
                    ("TEXTCOLOR",   (0, 0), (-1, 0), white),
                    ("FONTNAME",    (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE",    (0, 0), (-1, -1), 9),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT, white]),
                    ("GRID",        (0, 0), (-1, -1), 0.5, HexColor("#e5e7eb")),
                    ("PADDING",     (0, 0), (-1, -1), 6),
                ]))
                story.append(t)
                story.append(Spacer(1, 0.4 * cm))
            except Exception:
                pass

        # ── Pricing ───────────────────────────────────────────────────────────
        if proposal.pricing_breakdown:
            try:
                items = json.loads(proposal.pricing_breakdown)
                story.append(Paragraph("Investment Summary", h1_style))
                story.append(HRFlowable(width="100%", thickness=0.5, color=BRAND, spaceAfter=8))
                p_data = [["Service", "Description", "Investment"]]
                for item in items:
                    price = item.get("price", 0)
                    price_str = f"${price:,.0f}" if price else "Included"
                    p_data.append([item.get("item", ""), item.get("description", ""), price_str])

                total_row = ["", "TOTAL INVESTMENT", f"${proposal.value:,.0f}"]
                p_data.append(total_row)

                p = Table(p_data, colWidths=[5 * cm, 9 * cm, 3 * cm])
                p.setStyle(TableStyle([
                    ("BACKGROUND",  (0, 0), (-1, 0), BRAND),
                    ("TEXTCOLOR",   (0, 0), (-1, 0), white),
                    ("FONTNAME",    (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTNAME",    (0, -1), (-1, -1), "Helvetica-Bold"),
                    ("BACKGROUND",  (0, -1), (-1, -1), HexColor("#f0fdf4")),
                    ("TEXTCOLOR",   (2, -1), (2, -1), SUCCESS),
                    ("FONTSIZE",    (0, 0), (-1, -1), 9),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -2), [LIGHT, white]),
                    ("GRID",        (0, 0), (-1, -1), 0.5, HexColor("#e5e7eb")),
                    ("PADDING",     (0, 0), (-1, -1), 7),
                    ("ALIGN",       (2, 0), (2, -1), "RIGHT"),
                ]))
                story.append(p)
                story.append(Spacer(1, 0.4 * cm))
            except Exception:
                pass

        # ── Signature ─────────────────────────────────────────────────────────
        story.append(Paragraph("Acceptance & Signature", h1_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=BRAND, spaceAfter=8))

        if proposal.signature_name:
            story.append(Paragraph(
                f"✓ Accepted by <b>{proposal.signature_name}</b> on "
                f"{proposal.signature_date.strftime('%B %d, %Y') if proposal.signature_date else 'N/A'}",
                ParagraphStyle("Signed", parent=body_style, textColor=SUCCESS),
            ))
        else:
            sig_data = [
                ["Client Signature:", "_" * 40, "Date:", "_" * 20],
                ["Print Name:",       "_" * 40, "",      ""],
            ]
            sig_t = Table(sig_data, colWidths=[3.5 * cm, 8 * cm, 2 * cm, 4 * cm])
            sig_t.setStyle(TableStyle([
                ("FONTSIZE",  (0, 0), (-1, -1), 9),
                ("TEXTCOLOR", (0, 0), (-1, -1), GRAY),
                ("PADDING",   (0, 0), (-1, -1), 6),
            ]))
            story.append(sig_t)

        story.append(Spacer(1, 0.8 * cm))
        story.append(Paragraph(
            "Thank you for considering MyWorker Agency. We look forward to partnering with you.",
            ParagraphStyle("Footer", parent=small_style, alignment=TA_CENTER, textColor=GRAY),
        ))

        doc.build(story)
        return buffer.getvalue()

    except ImportError:
        logger.warning("ReportLab not installed — returning empty PDF placeholder")
        return b"%PDF-1.4 placeholder"
