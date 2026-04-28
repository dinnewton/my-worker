from datetime import datetime
from pydantic import BaseModel
from app.models.activity import ActivityType, ActivityStatus


class ActivityOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    type: ActivityType
    status: ActivityStatus
    title: str
    description: str | None
    module: str | None
    created_at: datetime


class ActivityCreate(BaseModel):
    type: ActivityType
    status: ActivityStatus = ActivityStatus.SUCCESS
    title: str
    description: str | None = None
    module: str | None = None
    metadata_json: str | None = None
