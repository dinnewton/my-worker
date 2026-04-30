import io
import json
import base64
import logging
import zipfile
import textwrap
from datetime import datetime, timezone

import httpx

from app.core.config import settings
from app.models.website import Website, WebsitePage, WebsiteTemplate, SectionType
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
    ai = get_client()

    services_str = ", ".join(key_services) if key_services else "General services"
    colors_str   = ", ".join(brand_colors) if brand_colors else "Blue and white"
    audience_str = target_audience or "general business audience"
    pages_str    = ", ".join(pages)

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
          "type": "section type",
          "heading": "Section heading",
          "subheading": "Section subheading",
          "content": "Section body copy",
          "items": [{{"title": "item title", "description": "item description", "icon": "emoji"}}],
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

    response = await ai.messages.create(
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
    ai = get_client()

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

    response = await ai.messages.create(
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
    ai = get_client()
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

    response = await ai.messages.create(
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


# ─── Static HTML Generator ────────────────────────────────────────────────────

def _render_section_html(section: dict, primary: str = "#6366f1") -> str:
    stype = section.get("type", "")
    heading = section.get("heading", "")
    subheading = section.get("subheading", "")
    content = section.get("content", "")
    items = section.get("items") or []
    cta_text = section.get("cta_text", "")
    cta_link = section.get("cta_link", "#contact")

    if stype == "hero":
        items_html = "".join(
            f'<div class="stat-item"><div class="stat-num">{it.get("icon","")}</div>'
            f'<div class="stat-label">{it.get("title","")}</div></div>'
            for it in items[:4]
        )
        return f"""<section class="hero">
  <div class="container">
    <h1>{heading}</h1>
    <p class="lead">{subheading}</p>
    {f'<div class="hero-stats">{items_html}</div>' if items else ""}
    {f'<a href="{cta_link}" class="btn">{cta_text}</a>' if cta_text else ""}
  </div>
</section>"""

    if stype in ("about", "custom"):
        return f"""<section class="section">
  <div class="container">
    <h2>{heading}</h2>
    <p class="sub">{subheading}</p>
    <p>{content}</p>
    {f'<a href="{cta_link}" class="btn-outline">{cta_text}</a>' if cta_text else ""}
  </div>
</section>"""

    if stype == "services":
        cards = "".join(
            f'<div class="card"><div class="card-icon">{it.get("icon","⚙️")}</div>'
            f'<h3>{it.get("title","")}</h3><p>{it.get("description","")}</p></div>'
            for it in items
        )
        return f"""<section class="section bg-light">
  <div class="container">
    <h2 class="center">{heading}</h2>
    <p class="sub center">{subheading}</p>
    <div class="grid">{cards}</div>
  </div>
</section>"""

    if stype == "pricing":
        tiers = items[:3]
        cards = ""
        for i, tier in enumerate(tiers):
            featured = "featured" if i == 1 else ""
            cards += (f'<div class="price-card {featured}"><h3>{tier.get("title","")}</h3>'
                      f'<p>{tier.get("description","")}</p>'
                      f'<a href="#contact" class="btn">Get Started</a></div>')
        return f"""<section class="section">
  <div class="container">
    <h2 class="center">{heading}</h2>
    <p class="sub center">{subheading}</p>
    <div class="price-grid">{cards}</div>
  </div>
</section>"""

    if stype == "testimonials":
        quotes = "".join(
            f'<blockquote><p>"{it.get("description","")}"</p>'
            f'<cite>— {it.get("title","")}</cite></blockquote>'
            for it in items
        )
        return f"""<section class="section bg-light">
  <div class="container">
    <h2 class="center">{heading}</h2>
    <div class="testimonials">{quotes}</div>
  </div>
</section>"""

    if stype == "faq":
        qs = "".join(
            f'<details><summary>{it.get("title","")}</summary><p>{it.get("description","")}</p></details>'
            for it in items
        )
        return f"""<section class="section">
  <div class="container narrow">
    <h2 class="center">{heading}</h2>
    <div class="faq">{qs}</div>
  </div>
</section>"""

    if stype == "stats":
        stats_html = "".join(
            f'<div class="stat"><span class="num">{it.get("icon","")}</span>'
            f'<span class="lbl">{it.get("title","")}</span>'
            f'<span class="desc">{it.get("description","")}</span></div>'
            for it in items
        )
        return f"""<section class="stats-bar">
  <div class="container">
    <div class="stats-grid">{stats_html}</div>
  </div>
</section>"""

    if stype == "contact":
        return f"""<section class="section" id="contact">
  <div class="container narrow">
    <h2 class="center">{heading}</h2>
    <p class="sub center">{subheading}</p>
    <form class="contact-form" onsubmit="return false">
      <input type="text" placeholder="Your Name" required />
      <input type="email" placeholder="Email Address" required />
      <textarea placeholder="Your Message" rows="5"></textarea>
      <button type="submit" class="btn">Send Message</button>
    </form>
  </div>
</section>"""

    if stype == "cta":
        return f"""<section class="cta-section">
  <div class="container center">
    <h2>{heading}</h2>
    <p>{subheading}</p>
    {f'<a href="{cta_link}" class="btn btn-light">{cta_text}</a>' if cta_text else ""}
  </div>
</section>"""

    if stype == "team":
        members = "".join(
            f'<div class="team-card"><div class="avatar">{it.get("icon","👤")}</div>'
            f'<h4>{it.get("title","")}</h4><p>{it.get("description","")}</p></div>'
            for it in items
        )
        return f"""<section class="section bg-light">
  <div class="container">
    <h2 class="center">{heading}</h2>
    <p class="sub center">{subheading}</p>
    <div class="team-grid">{members}</div>
  </div>
</section>"""

    # portfolio / blog / generic
    items_html = "".join(
        f'<div class="card"><div class="card-icon">{it.get("icon","📄")}</div>'
        f'<h3>{it.get("title","")}</h3><p>{it.get("description","")}</p></div>'
        for it in items
    )
    return f"""<section class="section">
  <div class="container">
    <h2 class="center">{heading}</h2>
    <p class="sub center">{subheading}</p>
    {f'<div class="grid">{items_html}</div>' if items_html else f'<p class="center">{content}</p>'}
  </div>
</section>"""


def generate_page_html(
    site_name: str,
    page_name: str,
    page_title: str,
    meta_description: str,
    sections: list[dict],
    all_pages: list[dict],
    primary_color: str = "#6366f1",
) -> str:
    nav_links = " ".join(
        f'<a href="{p.get("slug", "/")}">{p.get("name","")}</a>'
        for p in all_pages
    )
    sections_html = "\n".join(_render_section_html(s, primary_color) for s in sections)

    css = f"""
        *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{ font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1f2937; line-height: 1.6; }}
        .container {{ max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; }}
        .container.narrow {{ max-width: 720px; }}
        h1 {{ font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 800; line-height: 1.2; }}
        h2 {{ font-size: clamp(1.5rem, 3vw, 2.25rem); font-weight: 700; margin-bottom: 0.75rem; }}
        h3 {{ font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; }}
        p {{ margin-bottom: 1rem; color: #4b5563; }}
        .lead {{ font-size: 1.25rem; color: #6b7280; margin: 1rem 0 2rem; max-width: 640px; }}
        .sub {{ color: #6b7280; margin-bottom: 2.5rem; font-size: 1.1rem; }}
        .center {{ text-align: center; margin-left: auto; margin-right: auto; }}
        nav {{ background: #fff; border-bottom: 1px solid #e5e7eb; padding: 1rem 0; position: sticky; top: 0; z-index: 100; }}
        nav .inner {{ display: flex; align-items: center; justify-content: space-between; max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; }}
        nav .logo {{ font-size: 1.25rem; font-weight: 800; color: {primary_color}; text-decoration: none; }}
        nav .links {{ display: flex; gap: 1.5rem; }}
        nav a {{ color: #374151; text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: color .2s; }}
        nav a:hover {{ color: {primary_color}; }}
        .hero {{ background: linear-gradient(135deg,{primary_color}18 0%,{primary_color}05 100%); padding: 6rem 0; border-bottom: 1px solid #e5e7eb; }}
        .hero-stats {{ display: flex; gap: 2rem; margin: 2rem 0; flex-wrap: wrap; }}
        .stat-item {{ text-align: center; }}
        .stat-num {{ font-size: 1.5rem; }}
        .stat-label {{ font-size: 0.8rem; color: #6b7280; }}
        .btn {{ display: inline-block; background: {primary_color}; color: #fff; padding: 0.75rem 2rem; border-radius: 0.5rem; font-weight: 600; text-decoration: none; font-size: 0.95rem; border: none; cursor: pointer; transition: opacity .2s; }}
        .btn:hover {{ opacity: 0.9; }}
        .btn-outline {{ display: inline-block; border: 2px solid {primary_color}; color: {primary_color}; padding: 0.7rem 1.8rem; border-radius: 0.5rem; font-weight: 600; text-decoration: none; transition: all .2s; }}
        .btn-outline:hover {{ background: {primary_color}; color: #fff; }}
        .btn-light {{ background: #fff; color: {primary_color}; }}
        .section {{ padding: 5rem 0; }}
        .bg-light {{ background: #f9fafb; }}
        .grid {{ display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 1.5rem; }}
        .card {{ background: #fff; border: 1px solid #e5e7eb; border-radius: 1rem; padding: 1.5rem; }}
        .card-icon {{ font-size: 2rem; margin-bottom: 0.75rem; }}
        .price-grid {{ display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 1.5rem; margin-top: 2rem; }}
        .price-card {{ border: 2px solid #e5e7eb; border-radius: 1rem; padding: 2rem; text-align: center; }}
        .price-card.featured {{ border-color: {primary_color}; background: {primary_color}08; }}
        .price-card h3 {{ color: {primary_color}; font-size: 1.25rem; margin-bottom: 1rem; }}
        .stats-bar {{ background: {primary_color}; padding: 3rem 0; }}
        .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit,minmax(150px,1fr)); gap: 2rem; text-align: center; }}
        .stats-grid .num {{ display: block; font-size: 2rem; font-weight: 800; color: #fff; }}
        .stats-grid .lbl {{ display: block; color: rgba(255,255,255,.8); font-weight: 600; }}
        .stats-grid .desc {{ display: block; color: rgba(255,255,255,.6); font-size: 0.8rem; }}
        .testimonials {{ display: grid; grid-template-columns: repeat(auto-fit,minmax(260px,1fr)); gap: 1.5rem; margin-top: 2rem; }}
        blockquote {{ background: #fff; border: 1px solid #e5e7eb; border-left: 4px solid {primary_color}; padding: 1.5rem; border-radius: 0.75rem; }}
        blockquote p {{ font-style: italic; margin-bottom: 0.5rem; }}
        blockquote cite {{ font-size: 0.85rem; color: {primary_color}; font-weight: 600; }}
        .faq {{ margin-top: 2rem; }}
        details {{ border: 1px solid #e5e7eb; border-radius: 0.75rem; margin-bottom: 0.75rem; overflow: hidden; }}
        summary {{ padding: 1rem 1.25rem; cursor: pointer; font-weight: 600; color: #111827; }}
        details p {{ padding: 0 1.25rem 1rem; }}
        .contact-form {{ display: flex; flex-direction: column; gap: 1rem; margin-top: 2rem; }}
        .contact-form input, .contact-form textarea {{ padding: 0.75rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem; font-size: 1rem; outline: none; }}
        .contact-form input:focus, .contact-form textarea:focus {{ border-color: {primary_color}; box-shadow: 0 0 0 3px {primary_color}20; }}
        .cta-section {{ background: linear-gradient(135deg,{primary_color},{primary_color}cc); color: #fff; padding: 5rem 0; }}
        .cta-section h2 {{ color: #fff; }}
        .cta-section p {{ color: rgba(255,255,255,.85); font-size: 1.1rem; margin-bottom: 2rem; }}
        .team-grid {{ display: grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap: 1.5rem; text-align: center; }}
        .team-card .avatar {{ font-size: 3rem; margin-bottom: 0.75rem; }}
        footer {{ background: #111827; color: #9ca3af; text-align: center; padding: 2rem; font-size: 0.85rem; }}
        @media (max-width:640px) {{ nav .links {{ display: none; }} .hero {{ padding: 4rem 0; }} }}
    """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{page_title or page_name} — {site_name}</title>
  <meta name="description" content="{meta_description or ''}" />
  <style>{css}</style>
</head>
<body>
  <nav>
    <div class="inner">
      <a class="logo" href="/">{site_name}</a>
      <div class="links">{nav_links}</div>
    </div>
  </nav>
  {sections_html}
  <footer><p>&copy; {datetime.now().year} {site_name}. All rights reserved.</p></footer>
</body>
</html>"""


def generate_static_zip(site: Website, pages: list) -> bytes:
    primary = "#6366f1"
    try:
        brand = json.loads(site.brand_colors or "[]")
        if brand:
            primary = brand[0]
    except Exception:
        pass

    pages_meta = [{"name": p.name, "slug": p.slug} for p in pages]

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for page in pages:
            try:
                sections = json.loads(page.sections or "[]")
            except Exception:
                sections = []

            filename = "index.html" if page.slug in ("/", "") else page.slug.strip("/") + ".html"
            html = generate_page_html(
                site_name=site.name,
                page_name=page.name,
                page_title=page.title or page.name,
                meta_description=page.meta_description or "",
                sections=sections,
                all_pages=pages_meta,
                primary_color=primary,
            )
            zf.writestr(filename, html)

        zf.writestr("robots.txt", f"User-agent: *\nAllow: /\n")
        urls = "\n".join(
            f"  <url><loc>{site.live_url or ''}{p.slug}</loc></url>"
            for p in pages
        )
        zf.writestr("sitemap.xml", f'<?xml version="1.0" encoding="UTF-8"?>\n'
                    f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}\n</urlset>')

    buf.seek(0)
    return buf.read()


# ─── Netlify Deploy ───────────────────────────────────────────────────────────

async def deploy_to_netlify(site: Website, pages: list, token: str) -> dict:
    zip_bytes = generate_static_zip(site, pages)
    headers_json = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=60) as client:
        if site.netlify_site_id:
            site_id = site.netlify_site_id
        else:
            resp = await client.post(
                "https://api.netlify.com/api/v1/sites",
                headers=headers_json,
                json={"name": site.name.lower().replace(" ", "-")[:63]},
            )
            resp.raise_for_status()
            site_id = resp.json()["id"]

        deploy_resp = await client.post(
            f"https://api.netlify.com/api/v1/sites/{site_id}/deploys",
            headers={**headers_json, "Content-Type": "application/zip"},
            content=zip_bytes,
        )
        deploy_resp.raise_for_status()
        data = deploy_resp.json()
        return {
            "site_id": site_id,
            "deploy_url": data.get("deploy_ssl_url") or data.get("deploy_url") or f"https://{data.get('subdomain','')}.netlify.app",
            "admin_url": data.get("admin_url", ""),
            "state": data.get("state", ""),
        }


# ─── Vercel Deploy ────────────────────────────────────────────────────────────

async def deploy_to_vercel(site: Website, pages: list, token: str) -> dict:
    primary = "#6366f1"
    try:
        brand = json.loads(site.brand_colors or "[]")
        if brand:
            primary = brand[0]
    except Exception:
        pass

    pages_meta = [{"name": p.name, "slug": p.slug} for p in pages]
    files = []
    for page in pages:
        try:
            sections = json.loads(page.sections or "[]")
        except Exception:
            sections = []

        html = generate_page_html(
            site_name=site.name,
            page_name=page.name,
            page_title=page.title or page.name,
            meta_description=page.meta_description or "",
            sections=sections,
            all_pages=pages_meta,
            primary_color=primary,
        )
        filename = "index.html" if page.slug in ("/", "") else page.slug.strip("/") + ".html"
        files.append({"file": filename, "data": base64.b64encode(html.encode()).decode(), "encoding": "base64"})

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.vercel.com/v13/deployments",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={
                "name": site.name.lower().replace(" ", "-")[:63],
                "files": files,
                "projectSettings": {"framework": None, "outputDirectory": None},
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "project_id": data.get("projectId", ""),
            "deploy_url": f"https://{data.get('url', '')}",
            "state": data.get("readyState", ""),
        }


# ─── WordPress Deploy ─────────────────────────────────────────────────────────

async def deploy_to_wordpress(
    site: Website,
    pages: list,
    wp_url: str,
    wp_user: str,
    wp_password: str,
) -> dict:
    creds = base64.b64encode(f"{wp_user}:{wp_password}".encode()).decode()
    headers = {"Authorization": f"Basic {creds}", "Content-Type": "application/json"}
    base_url = wp_url.rstrip("/")
    results = []

    async with httpx.AsyncClient(timeout=30) as client:
        for page in pages:
            try:
                sections = json.loads(page.sections or "[]")
            except Exception:
                sections = []

            content_parts = []
            for sec in sections:
                if sec.get("heading"):
                    content_parts.append(f'<h2>{sec["heading"]}</h2>')
                if sec.get("content"):
                    content_parts.append(f'<p>{sec["content"]}</p>')
                for item in (sec.get("items") or []):
                    content_parts.append(f'<h3>{item.get("icon","")} {item.get("title","")}</h3>'
                                         f'<p>{item.get("description","")}</p>')

            slug = page.slug.strip("/") or "home"
            try:
                resp = await client.post(
                    f"{base_url}/wp-json/wp/v2/pages",
                    headers=headers,
                    json={
                        "title": page.title or page.name,
                        "content": "\n".join(content_parts),
                        "slug": slug,
                        "status": "publish",
                        "excerpt": page.meta_description or "",
                    },
                )
                resp.raise_for_status()
                wp_page = resp.json()
                results.append({"page": page.name, "wp_id": wp_page.get("id"), "link": wp_page.get("link")})
            except Exception as e:
                results.append({"page": page.name, "error": str(e)})

    return {"wp_url": base_url, "pages": results, "total": len(results)}


# ─── Requirements email ───────────────────────────────────────────────────────

async def send_requirements_intake_email(
    client_email: str,
    client_name: str,
    site_name: str,
    intake_url: str,
) -> bool:
    if not settings.SENDGRID_API_KEY:
        logger.warning("SendGrid not configured — skipping requirements email")
        return False

    body = (
        f"Hi {client_name},\n\n"
        f"We're excited to start building your website: {site_name}!\n\n"
        "Please fill out our quick requirements intake form (takes ~5 minutes):\n\n"
        f"{intake_url}\n\n"
        f"Best,\n{settings.AGENCY_NAME}"
    )
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail

        sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        message = Mail(
            from_email=(settings.EMAIL_FROM, settings.EMAIL_FROM_NAME),
            to_emails=client_email,
            subject=f"Website Requirements: {site_name}",
            plain_text_content=body,
        )
        sg.send(message)
        return True
    except Exception as e:
        logger.error(f"Requirements email failed: {e}")
        return False
