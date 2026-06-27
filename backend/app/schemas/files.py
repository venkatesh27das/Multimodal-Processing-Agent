from datetime import datetime
from enum import StrEnum

from pydantic import Field

from backend.app.schemas.common import APIModel


class ProcessingStatus(StrEnum):
    REGISTERED = "registered"
    QUEUED = "queued"
    PROCESSING = "processing"
    REVIEW_REQUIRED = "review_required"
    COMPLETE = "complete"
    FAILED = "failed"


class FileUploadResponse(APIModel):
    file_id: str
    original_filename: str
    file_type: str
    mime_type: str
    size_bytes: int = Field(ge=0)
    checksum_sha256: str
    source: str
    storage_path: str
    status: ProcessingStatus
    uploaded_at: datetime

