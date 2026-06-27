from datetime import datetime
from enum import StrEnum

from backend.app.schemas.common import APIModel


class ParseJobStatus(StrEnum):
    QUEUED = "queued"
    PLANNING = "planning"
    RUNNING = "running"
    REVIEW_REQUIRED = "review_required"
    COMPLETE = "complete"
    FAILED = "failed"


class ParseJobResponse(APIModel):
    job_id: str
    file_id: str
    status: ParseJobStatus
    parser_id: str | None
    quality_status: str
    created_at: datetime
    updated_at: datetime


class ParseJobCreate(APIModel):
    file_id: str

