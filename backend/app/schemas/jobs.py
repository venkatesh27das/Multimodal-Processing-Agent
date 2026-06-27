from datetime import datetime

from backend.app.domain.enums import JobStatus, QualityStatus
from backend.app.schemas.common import APIModel

ParseJobStatus = JobStatus


class ParseJobResponse(APIModel):
    job_id: str
    file_id: str
    status: ParseJobStatus
    parser_id: str | None
    skill_id: str | None = None
    quality_status: QualityStatus
    created_at: datetime
    updated_at: datetime


class ParseJobCreate(APIModel):
    file_id: str
    parser_id: str | None = None
    skill_id: str | None = None
