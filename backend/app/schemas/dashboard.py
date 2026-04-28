from datetime import datetime
from pydantic import BaseModel
from app.models.lead import LeadStatus, LeadSource
from app.models.proposal import ProposalStatus


class KPIData(BaseModel):
    active_leads: int = 0
    posts_published: int = 0
    proposals_sent: int = 0
    sites_built: int = 0
    revenue: float = 0.0
    leads_delta: int = 0
    posts_delta: int = 0
    proposals_delta: int = 0
    revenue_delta: float = 0.0


class LeadOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    company: str | None
    email: str | None
    industry: str | None
    status: LeadStatus
    source: LeadSource
    score: float
    ai_summary: str | None
    created_at: datetime


class LeadCreate(BaseModel):
    name: str
    company: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    industry: str | None = None
    source: LeadSource = LeadSource.MANUAL
    notes: str | None = None


class ProposalOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    title: str
    client_name: str
    client_email: str | None
    status: ProposalStatus
    services: str | None
    value: float
    ai_generated: bool
    created_at: datetime
    sent_at: datetime | None


class ProposalCreate(BaseModel):
    lead_id: int | None = None
    title: str
    client_name: str
    client_email: str | None = None
    services: str | None = None
    value: float = 0.0


class NotificationOut(BaseModel):
    id: str
    title: str
    message: str
    type: str
    read: bool = False
    created_at: datetime


class AgentTaskRequest(BaseModel):
    task: str
    context: str | None = None
