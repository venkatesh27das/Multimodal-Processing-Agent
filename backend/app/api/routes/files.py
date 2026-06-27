from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.domain.enums import FileType
from backend.app.models.file import FileRecord
from backend.app.schemas.files import FileUploadResponse, ProcessingStatus
from backend.app.services.file_storage import store_upload

router = APIRouter(prefix="/files")


def infer_file_type(filename: str) -> FileType:
    suffix = Path(filename).suffix.lstrip(".").lower()
    if suffix == "pdf":
        return FileType.PDF
    if suffix == "docx":
        return FileType.DOCX
    if suffix in {"png", "jpg", "jpeg", "gif", "webp", "tif", "tiff"}:
        return FileType.IMAGE
    if suffix in {"html", "htm"}:
        return FileType.HTML
    if suffix in {"mp3", "wav", "m4a", "aac", "flac"}:
        return FileType.AUDIO
    if suffix in {"mp4", "mov", "avi", "mkv", "webm"}:
        return FileType.VIDEO
    return FileType.UNKNOWN


@router.post("/upload", response_model=FileUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> FileUploadResponse:
    stored = await store_upload(file)
    file_type = infer_file_type(stored.original_filename)

    record = FileRecord(
        original_filename=stored.original_filename,
        file_type=file_type.value,
        mime_type=stored.content_type,
        size_bytes=stored.size_bytes,
        checksum_sha256=stored.checksum_sha256,
        source="ui",
        storage_path=str(stored.storage_path),
        status=ProcessingStatus.REGISTERED.value,
        created_by="local-user",
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return FileUploadResponse(
        file_id=record.id,
        original_filename=record.original_filename,
        file_type=FileType(record.file_type),
        mime_type=record.mime_type,
        size_bytes=record.size_bytes,
        checksum_sha256=record.checksum_sha256,
        source=record.source,
        storage_path=record.storage_path,
        status=ProcessingStatus(record.status),
        uploaded_at=record.uploaded_at,
    )
