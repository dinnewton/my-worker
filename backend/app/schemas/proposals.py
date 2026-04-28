from datetime import datetime
from pydantic import BaseModel, field_validator
from app.models.proposal import ProposalStatus, ProposalTemplate


class ProposalOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    lead_id: int | None
    title: str
    client_name: str
    client_email: str | None
    client_company: str | None
    template_type: ProposalTemplate
    status: ProposalStatus
    cover_letter: str | None
    services: str | None
    sections: str | None
    timeline: str | None
    deliverables: str | None
    pricing_breakdown: str | None
    value: float
    monthly_retainer: float
    setup_fee: float
    timeline_weeks: int
    notes: str | None
    version: int
    valid_until: datetime | None
    ai_generated: bool
    ai_win_tips: str | None
    share_token: str
    file_path: str | None
    signature_name: str | None
    signature_date: datetime | None
    created_at: datetime
    updated_at: datetime
    sent_at: datetime | None
    viewed_at: datetime | None
    accepted_at: datetime | None
    rejected_at: datetime | None


class ProposalCreate(BaseModel):
    lead_id: int | None = None
    title: str
    client_name: str
    client_email: str | None = None
    client_company: str | None = None
    template_type: ProposalTemplate = ProposalTemplate.CUSTOM
    services: str | None = None
    value: float = 0.0
    monthly_retainer: float = 0.0
    setup_fee: float = 0.0
    timeline_weeks: int = 4
    notes: str | None = None
    valid_until: datetime | None = None


class ProposalUpdate(BaseModel):
    title: str | None = None
    client_name: str | None = None
    client_email: str | None = None
    client_company: str | None = None
    template_type: ProposalTemplate | None = None
    cover_letter: str | None = None
    services: str | None = None
    sections: str | None = None
    timeline: str | None = None
    deliverables: str | None = None
    pricing_breakdown: str | None = None
    value: float | None = None
    monthly_retainer: float | None = None
    setup_fee: float | None = None
    timeline_weeks: int | None = None
    notes: str | None = None
    valid_until: datetime | None = None


class ProposalStatusUpdate(BaseModel):
    status: ProposalStatus


class AIGenerateRequest(BaseModel):
    lead_id: int | None = None
    client_name: str
    client_company: str | None = None
    client_email: str | None = None
    template_type: ProposalTemplate
    services: list[str]
    budget: float = 0.0
    timeline_weeks: int = 4
    notes: str | None = None


class SignProposalRequest(BaseModel):
    signature_name: str


class ProposalSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    title: str
    client_name: str
    client_company: str | None
    status: ProposalStatus
    template_type: ProposalTemplate
    value: float
    ai_generated: bool
    created_at: datetime
    sent_at: datetime | None
    accepted_at: datetime | None
