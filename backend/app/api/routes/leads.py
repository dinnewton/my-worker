import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_

from app.core.database import get_db
from app.core.config import settings
from app.models.lead import Lead, LeadStatus, LeadSource
from app.models.followup_task import FollowUpTask
from app.models.lead_activity import LeadActivity, ActivityKind
from app.models.activity import Activity, ActivityType, ActivityStatus
from app.schemas.leads import (
    LeadOut, LeadCreate, LeadUpdate, LeadStatusUpdate,
    TaskOut, TaskCreate, TaskUpdate,
    ActivityOut, ActivityCreate,
    PipelineStats, PipelineColumn,
    EmbedLeadCapture, LeadScoreResult, OutreachRequest,
)
from app.services import lead_service
from app.api.websocket import broadcast

router = APIRouter(prefix="/leads", tags=["leads"])

PIPELINE_META = [
    {"status": LeadStatus.NEW,           "label": "New",           "color": "#3b82f6"},
    {"status": LeadStatus.CONTACTED,     "label": "Contacted",     "color": "#f59e0b"},
    {"status": LeadStatus.QUALIFIED,     "label": "Qualified",     "color": "#8b5cf6"},
    {"status": LeadStatus.PROPOSAL_SENT, "label": "Proposal Sent", "color": "#ec4899"},
    {"status": LeadStatus.WON,           "label": "Won",           "color": "#10b981"},
    {"status": LeadStatus.LOST,          "label": "Lost",          "color": "#ef4444"},
]


# ──────────────────────────────────────────────────────────────────────────────
# Pipeline
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/pipeline", response_model=PipelineStats)
async def get_pipeline(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Lead).order_by(Lead.score.desc()))
    all_leads = result.scalars().all()

    columns: list[PipelineColumn] = []
    for meta in PIPELINE_META:
        stage_leads = [l for l in all_leads if l.status == meta["status"]]
        columns.append(PipelineColumn(
            status=meta["status"],
            label=meta["label"],
            count=len(stage_leads),
            total_value=sum(l.deal_value for l in stage_leads),
            leads=stage_leads,
        ))

    won_leads = [l for l in all_leads if l.status == LeadStatus.WON]
    total_closed = len([l for l in all_leads if l.status in (LeadStatus.WON, LeadStatus.LOST)])
    conversion = (len(won_leads) / total_closed * 100) if total_closed > 0 else 0.0

    return PipelineStats(
        total_leads=len(all_leads),
        total_pipeline_value=sum(l.deal_value for l in all_leads if l.status != LeadStatus.LOST),
        avg_score=sum(l.score for l in all_leads) / max(len(all_leads), 1),
        won_this_month=len(won_leads),
        conversion_rate=round(conversion, 1),
        columns=columns,
    )


# ──────────────────────────────────────────────────────────────────────────────
# CRUD
# ──────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[LeadOut])
async def list_leads(
    status: str | None = None,
    source: str | None = None,
    search: str | None = None,
    min_score: float = 0,
    limit: int = 100,
    skip: int = 0,
    db: AsyncSession = Depends(get_db),
):
    q = select(Lead).order_by(Lead.score.desc(), Lead.created_at.desc())
    if status:
        q = q.where(Lead.status == status)
    if source:
        q = q.where(Lead.source == source)
    if search:
        term = f"%{search}%"
        q = q.where(or_(
            Lead.name.ilike(term),
            Lead.company.ilike(term),
            Lead.email.ilike(term),
            Lead.industry.ilike(term),
        ))
    if min_score > 0:
        q = q.where(Lead.score >= min_score)
    result = await db.execute(q.offset(skip).limit(limit))
    return result.scalars().all()


@router.post("", response_model=LeadOut)
async def create_lead(payload: LeadCreate, db: AsyncSession = Depends(get_db)):
    lead_dict = payload.model_dump()
    tags = lead_dict.pop("tags", [])

    # AI scoring
    score_result = await lead_service.score_lead(lead_dict)

    lead = Lead(
        **lead_dict,
        tags=json.dumps(tags),
        score=score_result.get("score", 50),
        ai_summary=score_result.get("summary"),
        ai_next_action=score_result.get("next_action"),
        ai_key_factors=json.dumps(score_result.get("key_factors", [])),
    )
    if score_result.get("suggested_deal_value") and lead.deal_value == 0:
        lead.deal_value = float(score_result["suggested_deal_value"])

    db.add(lead)

    activity_log = Activity(
        type=ActivityType.LEAD_FOUND,
        status=ActivityStatus.SUCCESS,
        title=f"New lead: {lead.name}",
        description=score_result.get("summary", ""),
        module="leads",
    )
    db.add(activity_log)
    await db.commit()
    await db.refresh(lead)

    # Auto-generate follow-up tasks
    lead_data = {
        "name": lead.name, "company": lead.company, "industry": lead.industry,
        "source": lead.source, "score": lead.score, "status": lead.status,
        "notes": lead.notes,
    }
    tasks_data = await lead_service.auto_generate_tasks(lead_data)
    for t in tasks_data:
        due = datetime.fromisoformat(t.pop("due_date")) if "due_date" in t else None
        task = FollowUpTask(lead_id=lead.id, due_date=due, **{k: v for k, v in t.items() if k != "due_date"})
        db.add(task)

    # First timeline entry
    entry = LeadActivity(
        lead_id=lead.id, kind=ActivityKind.AI_ACTION,
        title="Lead created & scored by AI",
        description=f"Score: {lead.score:.0f}/100. {score_result.get('next_action', '')}",
        created_by="agent",
    )
    db.add(entry)
    await db.commit()

    await broadcast({
        "event": "activity",
        "data": {
            "type": ActivityType.LEAD_FOUND,
            "status": "success",
            "title": f"New lead: {lead.name}",
            "module": "leads",
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    })
    return lead


@router.get("/{lead_id}", response_model=LeadOut)
async def get_lead(lead_id: int, db: AsyncSession = Depends(get_db)):
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    return lead


@router.patch("/{lead_id}", response_model=LeadOut)
async def update_lead(lead_id: int, payload: LeadUpdate, db: AsyncSession = Depends(get_db)):
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")

    data = payload.model_dump(exclude_unset=True)
    tags = data.pop("tags", None)
    if tags is not None:
        data["tags"] = json.dumps(tags)

    old_status = lead.status
    for k, v in data.items():
        setattr(lead, k, v)

    if "status" in data and data["status"] != old_status:
        entry = LeadActivity(
            lead_id=lead.id, kind=ActivityKind.STATUS_CHANGE,
            title=f"Status changed: {old_status} → {data['status']}",
            created_by="user",
        )
        db.add(entry)

    await db.commit()
    await db.refresh(lead)
    return lead


@router.delete("/{lead_id}")
async def delete_lead(lead_id: int, db: AsyncSession = Depends(get_db)):
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    await db.delete(lead)
    await db.commit()
    return {"ok": True}


# ──────────────────────────────────────────────────────────────────────────────
# Pipeline stage move
# ──────────────────────────────────────────────────────────────────────────────

@router.patch("/{lead_id}/status", response_model=LeadOut)
async def move_pipeline_stage(
    lead_id: int, payload: LeadStatusUpdate, db: AsyncSession = Depends(get_db)
):
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")

    old_status = lead.status
    lead.status = payload.status
    if payload.status == LeadStatus.WON or payload.status == LeadStatus.CONTACTED:
        lead.last_contact_at = datetime.now(timezone.utc)

    entry = LeadActivity(
        lead_id=lead.id, kind=ActivityKind.STATUS_CHANGE,
        title=f"Moved: {old_status.replace('_', ' ').title()} → {payload.status.replace('_', ' ').title()}",
        description=payload.note,
        created_by="user",
    )
    db.add(entry)

    activity_log = Activity(
        type=ActivityType.LEAD_FOUND,
        status=ActivityStatus.SUCCESS,
        title=f"Lead moved to {payload.status.replace('_', ' ').title()}: {lead.name}",
        module="leads",
    )
    db.add(activity_log)
    await db.commit()
    await db.refresh(lead)

    await broadcast({
        "event": "lead_moved",
        "data": {"lead_id": lead_id, "from": old_status, "to": payload.status},
    })
    return lead


# ──────────────────────────────────────────────────────────────────────────────
# Activities / Timeline
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/{lead_id}/activities", response_model=list[ActivityOut])
async def get_lead_activities(lead_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LeadActivity)
        .where(LeadActivity.lead_id == lead_id)
        .order_by(LeadActivity.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()


@router.post("/{lead_id}/activities", response_model=ActivityOut)
async def add_lead_activity(
    lead_id: int, payload: ActivityCreate, db: AsyncSession = Depends(get_db)
):
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")

    entry = LeadActivity(lead_id=lead_id, **payload.model_dump())
    db.add(entry)

    if payload.kind in (ActivityKind.CALL, ActivityKind.EMAIL, ActivityKind.WHATSAPP, ActivityKind.MEETING):
        lead.last_contact_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(entry)
    return entry


# ──────────────────────────────────────────────────────────────────────────────
# Follow-up Tasks
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/{lead_id}/tasks", response_model=list[TaskOut])
async def get_lead_tasks(lead_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(FollowUpTask)
        .where(FollowUpTask.lead_id == lead_id)
        .order_by(FollowUpTask.completed, FollowUpTask.due_date)
    )
    return result.scalars().all()


@router.post("/{lead_id}/tasks", response_model=TaskOut)
async def create_task(lead_id: int, payload: TaskCreate, db: AsyncSession = Depends(get_db)):
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    task = FollowUpTask(**payload.model_dump())
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.patch("/tasks/{task_id}", response_model=TaskOut)
async def update_task(task_id: int, payload: TaskUpdate, db: AsyncSession = Depends(get_db)):
    task = await db.get(FollowUpTask, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("completed") is True and not task.completed_at:
        data["completed_at"] = datetime.now(timezone.utc)
    for k, v in data.items():
        setattr(task, k, v)

    if task.completed:
        entry = LeadActivity(
            lead_id=task.lead_id, kind=ActivityKind.TASK_COMPLETED,
            title=f"Task completed: {task.title}",
            created_by="user",
        )
        db.add(entry)

    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    task = await db.get(FollowUpTask, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    await db.delete(task)
    await db.commit()
    return {"ok": True}


@router.get("/tasks/all", response_model=list[TaskOut])
async def get_all_tasks(
    completed: bool | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    q = select(FollowUpTask).order_by(FollowUpTask.due_date)
    if completed is not None:
        q = q.where(FollowUpTask.completed == completed)
    result = await db.execute(q.limit(limit))
    return result.scalars().all()


# ──────────────────────────────────────────────────────────────────────────────
# AI Operations
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/{lead_id}/ai/score", response_model=LeadScoreResult)
async def ai_score_lead(lead_id: int, db: AsyncSession = Depends(get_db)):
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")

    lead_data = {
        "name": lead.name, "company": lead.company, "email": lead.email,
        "phone": lead.phone, "industry": lead.industry, "website": lead.website,
        "source": lead.source, "status": lead.status, "notes": lead.notes,
        "deal_value": lead.deal_value, "location": lead.location,
    }
    result = await lead_service.score_lead(lead_data)

    lead.score = result["score"]
    lead.ai_summary = result.get("summary")
    lead.ai_next_action = result.get("next_action")
    lead.ai_key_factors = json.dumps(result.get("key_factors", []))

    entry = LeadActivity(
        lead_id=lead.id, kind=ActivityKind.SCORE_UPDATE,
        title=f"AI score updated: {result['score']:.0f}/100",
        description=result.get("summary"),
        created_by="agent",
    )
    db.add(entry)
    await db.commit()
    return result


@router.post("/{lead_id}/ai/tasks")
async def ai_generate_tasks(lead_id: int, db: AsyncSession = Depends(get_db)):
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")

    lead_data = {
        "name": lead.name, "company": lead.company, "industry": lead.industry,
        "source": lead.source, "score": lead.score, "status": lead.status, "notes": lead.notes,
    }
    tasks_data = await lead_service.auto_generate_tasks(lead_data)

    created: list[FollowUpTask] = []
    for t in tasks_data:
        due_str = t.pop("due_date", None)
        due = datetime.fromisoformat(due_str) if due_str else None
        task = FollowUpTask(lead_id=lead_id, due_date=due, **{k: v for k, v in t.items()})
        db.add(task)
        created.append(task)

    entry = LeadActivity(
        lead_id=lead_id, kind=ActivityKind.TASK_CREATED,
        title=f"AI generated {len(created)} follow-up tasks",
        created_by="agent",
    )
    db.add(entry)
    await db.commit()
    return {"created": len(created), "tasks": [{"title": t.title, "due_date": str(t.due_date)} for t in created]}


@router.post("/{lead_id}/ai/outreach")
async def ai_generate_outreach(
    lead_id: int, payload: OutreachRequest, db: AsyncSession = Depends(get_db)
):
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")

    lead_data = {
        "name": lead.name, "company": lead.company, "industry": lead.industry,
        "source": lead.source, "notes": lead.notes, "ai_summary": lead.ai_summary,
    }
    message = await lead_service.generate_outreach_message(lead_data, payload.channel)

    entry = LeadActivity(
        lead_id=lead.id, kind=ActivityKind.AI_ACTION,
        title=f"AI outreach generated ({payload.channel})",
        description=message[:300],
        created_by="agent",
    )
    db.add(entry)
    await db.commit()
    return {"channel": payload.channel, "message": message}


@router.get("/{lead_id}/ai/insights")
async def ai_lead_insights(lead_id: int, db: AsyncSession = Depends(get_db)):
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")

    result = await db.execute(
        select(LeadActivity)
        .where(LeadActivity.lead_id == lead_id)
        .order_by(LeadActivity.created_at.desc())
        .limit(10)
    )
    activities = [
        {"kind": a.kind, "title": a.title, "created_at": str(a.created_at)}
        for a in result.scalars().all()
    ]
    lead_data = {
        "name": lead.name, "company": lead.company, "industry": lead.industry,
        "status": lead.status, "score": lead.score, "deal_value": lead.deal_value,
        "notes": lead.notes, "ai_summary": lead.ai_summary,
    }
    return await lead_service.get_lead_insights(lead_data, activities)


# ──────────────────────────────────────────────────────────────────────────────
# Embed Form (public endpoints — no auth required)
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/embed/capture", response_model=dict)
async def embed_capture(payload: EmbedLeadCapture, db: AsyncSession = Depends(get_db)):
    """Public endpoint — receives lead submissions from embedded forms on client websites."""
    lead_dict = payload.model_dump()
    message = lead_dict.pop("message", None)
    service_interest = lead_dict.pop("service_interest", None)
    referrer = lead_dict.pop("referrer_url", None)

    notes_parts = []
    if message:
        notes_parts.append(f"Message: {message}")
    if service_interest:
        notes_parts.append(f"Service interest: {service_interest}")
    if referrer:
        notes_parts.append(f"Form URL: {referrer}")

    score_data = await lead_service.score_lead(lead_dict)

    lead = Lead(
        **lead_dict,
        notes="\n".join(notes_parts) if notes_parts else None,
        score=score_data.get("score", 50),
        ai_summary=score_data.get("summary"),
        ai_next_action=score_data.get("next_action"),
        ai_key_factors=json.dumps(score_data.get("key_factors", [])),
    )
    db.add(lead)

    activity_log = Activity(
        type=ActivityType.LEAD_FOUND,
        status=ActivityStatus.SUCCESS,
        title=f"Website form submission: {lead.name}",
        description=score_data.get("summary", ""),
        module="leads",
    )
    db.add(activity_log)
    await db.commit()
    await db.refresh(lead)

    tasks_data = await lead_service.auto_generate_tasks(lead_dict)
    for t in tasks_data:
        due_str = t.pop("due_date", None)
        due = datetime.fromisoformat(due_str) if due_str else None
        db.add(FollowUpTask(lead_id=lead.id, due_date=due, **{k: v for k, v in t.items()}))

    entry = LeadActivity(
        lead_id=lead.id, kind=ActivityKind.FORM_SUBMIT,
        title="Lead captured via website form",
        description="\n".join(notes_parts),
        created_by="website",
    )
    db.add(entry)
    await db.commit()

    await broadcast({
        "event": "activity",
        "data": {
            "type": ActivityType.LEAD_FOUND, "status": "success",
            "title": f"New form submission: {lead.name}",
            "module": "leads",
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    })
    return {"success": True, "message": "Thank you! We'll be in touch shortly.", "lead_id": lead.id}


@router.get("/embed/snippet", response_class=HTMLResponse)
async def get_embed_snippet():
    """Return the HTML embed snippet for client websites."""
    backend_url = "https://your-backend-domain.com"
    html = f"""<!-- MyWorker Lead Capture Form — paste this anywhere on your website -->
<div id="mw-form-wrap" style="font-family:Inter,system-ui,sans-serif;max-width:480px;padding:28px;background:#fff;border-radius:12px;box-shadow:0 2px 16px rgba(0,0,0,.1)">
  <h3 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#111">Get a Free Consultation</h3>
  <p style="margin:0 0 20px;font-size:14px;color:#6b7280">Tell us about your project and we'll be in touch within 24 hours.</p>
  <form id="mw-lead-form">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <input name="name" placeholder="Your Name *" required style="padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none;grid-column:1/-1">
      <input name="email" type="email" placeholder="Email Address" style="padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none">
      <input name="phone" placeholder="Phone Number" style="padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none">
    </div>
    <input name="company" placeholder="Company Name" style="width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none;margin-bottom:12px;box-sizing:border-box">
    <select name="service_interest" style="width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none;margin-bottom:12px;box-sizing:border-box;background:#fff">
      <option value="">What do you need help with?</option>
      <option value="Web Development">Web Development</option>
      <option value="Digital Marketing">Digital Marketing</option>
      <option value="SEO">SEO Optimisation</option>
      <option value="Social Media">Social Media Management</option>
      <option value="Paid Advertising">Paid Advertising</option>
      <option value="Full Agency Retainer">Full Agency Retainer</option>
    </select>
    <textarea name="message" placeholder="Tell us about your project..." rows="3" style="width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none;margin-bottom:16px;box-sizing:border-box;resize:vertical"></textarea>
    <button type="submit" id="mw-submit" style="width:100%;padding:12px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">
      Get Free Consultation →
    </button>
    <p id="mw-msg" style="margin:12px 0 0;text-align:center;font-size:13px;display:none"></p>
  </form>
</div>
<script>
(function(){{
  var form=document.getElementById('mw-lead-form');
  var btn=document.getElementById('mw-submit');
  var msg=document.getElementById('mw-msg');
  form.addEventListener('submit',async function(e){{
    e.preventDefault();
    btn.textContent='Sending...';btn.disabled=true;
    var data={{}};
    new FormData(form).forEach(function(v,k){{if(v)data[k]=v;}});
    data.source='website_form';
    data.referrer_url=window.location.href;
    try{{
      var r=await fetch('{backend_url}/api/v1/leads/embed/capture',{{
        method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify(data)
      }});
      var j=await r.json();
      if(r.ok){{
        form.style.display='none';
        msg.style.display='block';
        msg.style.color='#10b981';
        msg.textContent='✓ '+j.message;
      }}else{{throw new Error(j.detail||'Error');}}
    }}catch(err){{
      msg.style.display='block';msg.style.color='#ef4444';
      msg.textContent='Something went wrong. Please try again.';
      btn.textContent='Get Free Consultation →';btn.disabled=false;
    }}
  }});
}})();
</script>"""
    return html
