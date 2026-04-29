import json
import logging
from app.models.website import WebsiteTemplate, SectionType
from app.services.ai_agent import get_client

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert web designer and copywriter specializing in high-converting business websites.
You write compelling, SEO-optimized website copy that converts visitors into clients.
Always respond with valid JSON only — no markdown, no extra text."""

TEMPLATE_PAGES = {
    WebsiteTemplate.BUSINESS:     ["Home", "About", "Services", "Portfolio", "Contact"],
    WebsiteTemplate.PORTFOLIO:    ["Home", "Work", "About", "Process", "Contact"],
    WebsiteTemplate.LANDING_PAGE: ["Home"],
    WebsiteTemplate.ECOMMERCE:    ["Home", "Shop", "About", "FAQ", "Contact"],
    WebsiteTemplate.BLOG:         ["Home", "Blog", "About", "Contact"],
    WebsiteTemplate.RESTAURANT:   ["Home", "Menu", "About", "Reservations", "Contact"],
    WebsiteTemplate.AGENCY:       ["Home", "Services", "Work", "Team", "Blog", "Contact"],
    WebsiteTemplate.SAAS:         ["Home", "Features", "Pricing", "Blog", "Contact"],
}

DEFAULT_SECTIONS = {
    "Home":         ["hero", "stats", "services", "testimonials", "cta"],
    "About":        ["about", "team", "stats", "cta"],
    "Services":     ["hero", "services", "pricing", "faq", "cta"],
    "Portfolio":    ["hero", "portfolio", "testimonials", "cta"],
    "Contact":      ["hero", "contact"],
    "Work":         ["hero", "portfolio", "cta"],
    "Process":      ["hero", "about", "cta"],
    "Features":     ["hero", "services", "stats", "faq", "cta"],
    "Pricing":      ["hero", "pricing", "faq", "cta"],
    "Blog":         ["hero", "blog", "cta"],
    "Shop":         ["hero", "services", "cta"],
    "Menu":         ["hero", "services", "contact"],
    "Reservations": ["hero", "contact"],
    "Team":         ["hero", "team", "cta"],
    "FAQ":          ["hero", "faq", "cta"],
}


async def generate_full_site(
    client_name: str,
    business_name: str,
    industry: str,
    description: str,
    template: WebsiteTemplate,
    target_audience: str | None,
    key_services: list[str],
    brand_colors: list[str],
    pages: list[str],
) -> dict:
    client = get_client()

    services_str = ", ".join(key_services) if key_services else "General services"
    colors_str = ", ".join(brand_colors) if brand_colors else "Blue and white"
    audience_str = target_audience or "general business audience"
    pages_str = ", ".join(pages)

    prompt = f"""Generate complete website content for the following business:

Business: {business_name}
Client: {client_name}
Industry: {industry}
Description: {description}
Template type: {template.value}
Target audience: {audience_str}
Key services: {services_str}
Brand colors: {colors_str}
Pages needed: {pages_str}

Return a JSON object:
{{
  "site_title": "SEO-optimized site title",
  "tagline": "Compelling one-line tagline",
  "meta_description": "155-char SEO meta description",
  "pages": [
    {{
      "name": "page name",
      "slug": "/url-slug",
      "title": "Page SEO title",
      "meta_description": "Page meta description",
      "sections": [
        {{
          "type": "section type (hero/about/services/portfolio/testimonials/pricing/faq/contact/team/cta/stats)",
          "heading": "Section heading",
          "subheading": "Section subheading",
          "content": "Section body copy (2-3 paragraphs for content sections)",
          "items": [
            {{"title": "item title", "description": "item description", "icon": "emoji"}}
          ],
          "cta_text": "Button text",
          "cta_link": "#contact"
        }}
      ]
    }}
  ],
  "seo_keywords": ["keyword1", "keyword2"],
  "color_scheme": {{
    "primary": "#hexcolor",
    "secondary": "#hexcolor",
    "accent": "#hexcolor"
  }}
}}

Write persuasive, professional copy. Each page should have 3-6 sections.
For hero sections: write a powerful headline + subheadline.
For services: list 4-6 specific services with descriptions.
For testimonials: write 3 realistic client testimonials.
For FAQ: write 5-6 common questions with detailed answers.
For pricing: write 3 pricing tiers (Basic/Pro/Enterprise or similar).
For stats: write 4 impressive but realistic business statistics."""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=6000,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


async def generate_section(
    section_type: SectionType,
    business_name: str,
    industry: str,
    description: str,
    page_name: str,
    additional_context: str | None = None,
) -> dict:
    client = get_client()

    prompt = f"""Generate website section content:

Business: {business_name}
Industry: {industry}
Description: {description}
Page: {page_name}
Section type: {section_type.value}
Context: {additional_context or 'None'}

Return JSON for one section:
{{
  "type": "{section_type.value}",
  "heading": "Section heading",
  "subheading": "Section subheading or tagline",
  "content": "Body copy (2-3 paragraphs if applicable)",
  "items": [{{"title": "...", "description": "...", "icon": "emoji"}}],
  "cta_text": "CTA button text",
  "cta_link": "#contact"
}}

Write compelling, conversion-focused copy specific to this business."""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


async def generate_seo_audit(website_data: dict) -> dict:
    client = get_client()
    prompt = f"""Perform an SEO audit for this website:

{json.dumps(website_data, indent=2)}

Return JSON:
{{
  "score": 0-100,
  "grade": "A/B/C/D/F",
  "issues": [{{"severity": "high/medium/low", "issue": "...", "fix": "..."}}],
  "strengths": ["..."],
  "recommendations": ["..."],
  "estimated_monthly_traffic": 0
}}"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)
