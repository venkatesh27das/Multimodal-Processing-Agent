from datetime import datetime

from pydantic import Field

from backend.app.domain.enums import FileType, JobStatus
from backend.app.schemas.common import APIModel

ProcessingStatus = JobStatus


class FileUploadResponse(APIModel):
    file_id: str
    original_filename: str
    file_type: FileType
    mime_type: str
    size_bytes: int = Field(ge=0)
    checksum_sha256: str
    source: str
    storage_path: str
    status: ProcessingStatus
    uploaded_at: datetime
