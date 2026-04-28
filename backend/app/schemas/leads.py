from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.models.lead import LeadStatus, LeadSource, LeadPriority
from app.models.followup_task import TaskPriority, TaskType
from app.models.lead_activity import ActivityKind


# ─── Lead ─────────────────────────────────────────────────────────────────────

class LeadOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    company: str | None
    email: str | None
    phone: str | None
    whatsapp: str | None
    website: str | None
    industry: str | None
    location: str | None
    status: LeadStatus
    source: LeadSource
    priority: LeadPriority
    score: float
    deal_value: float
    tags: str | None
    notes: str | None
    ai_summary: str | None
    ai_next_action: str | None
    ai_key_factors: str | None
    assigned_to: str | None
    last_contact_at: datetime | None
    next_followup_at: datetime | None
    created_at: datetime
    updated_at: datetime


class LeadCreate(BaseModel):
    name: str
    company: str | None = None
    email: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    website: str | None = None
    industry: str | None = None
    location: str | None = None
    source: LeadSource = LeadSource.MANUAL
    priority: LeadPriority = LeadPriority.MEDIUM
    deal_value: float = 0.0
    tags: list[str] = []
    notes: str | None = None


class LeadUpdate(BaseModel):
    name: str | None = None
    company: str | None = None
    email: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    website: str | None = None
    industry: str | None = None
    location: str | None = None
    status: LeadStatus | None = None
    source: LeadSource | None = None
    priority: LeadPriority | None = None
    deal_value: float | None = None
    tags: list[str] | None = None
    notes: str | None = None
    assigned_to: str | None = None
    next_followup_at: datetime | None = None


class LeadStatusUpdate(BaseModel):
    status: LeadStatus
    note: str | None = None


class EmbedLeadCapture(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    company: str | None = None
    industry: str | None = None
    message: str | None = None
    service_interest: str | None = None
    source: LeadSource = LeadSource.WEBSITE_FORM
    referrer_url: str | None = None


# ─── Pipeline ─────────────────────────────────────────────────────────────────

class PipelineColumn(BaseModel):
    status: LeadStatus
    label: str
    count: int
    total_value: float
    leads: list[LeadOut]


class PipelineStats(BaseModel):
    total_leads: int
    total_pipeline_value: float
    avg_score: float
    won_this_month: int
    conversion_rate: float
    columns: list[PipelineColumn]


# ─── Follow-up Tasks ──────────────────────────────────────────────────────────

class TaskOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    lead_id: int
    title: str
    description: str | None
    task_type: TaskType
    priority: TaskPriority
    due_date: datetime | None
    completed: bool
    completed_at: datetime | None
    ai_generated: bool
    created_at: datetime


class TaskCreate(BaseModel):
    lead_id: int
    title: str
    description: str | None = None
    task_type: TaskType = TaskType.FOLLOW_UP
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: datetime | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    task_type: TaskType | None = None
    priority: TaskPriority | None = None
    due_date: datetime | None = None
    completed: bool | None = None


# ─── Activities ───────────────────────────────────────────────────────────────

class ActivityOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    lead_id: int
    kind: ActivityKind
    title: str
    description: str | None
    metadata_json: str | None
    created_by: str
    created_at: datetime


class ActivityCreate(BaseModel):
    kind: ActivityKind = ActivityKind.NOTE
    title: str
    description: str | None = None
    created_by: str = "user"


# ─── AI Operations ────────────────────────────────────────────────────────────

class LeadScoreResult(BaseModel):
    score: float
    summary: str
    next_action: str
    key_factors: list[str]
    strengths: list[str]
    risks: list[str]
    recommended_approach: str


class OutreachRequest(BaseModel):
    channel: str = "email"
    context: str | None = None
