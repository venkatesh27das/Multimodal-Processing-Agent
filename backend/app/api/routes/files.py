from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.domain.enums import FileType
from backend.app.models.domain import FileProfile, FileRecord
from backend.app.schemas.domain import FileProfileRead, FileRecordRead
from backend.app.schemas.files import FileUploadResponse, ProcessingStatus
from backend.app.services.file_profiling import file_profiler
from backend.app.services.file_storage import store_upload
from backend.app.services.file_type import infer_file_type

router = APIRouter(prefix="/files")


@router.post("/upload", response_model=FileUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> FileUploadResponse:
    stored = await store_upload(file)
    file_type = infer_file_type(stored.original_filename, stored.content_type)

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
    db.flush()

    profile = file_profiler.profile(record)
    db.add(profile)
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


@router.get("/{file_id}", response_model=FileRecordRead)
def get_file(file_id: str, db: Session = Depends(get_db)) -> FileRecordRead:
    file_record = db.get(FileRecord, file_id)
    if file_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return file_record


@router.get("/{file_id}/profile", response_model=FileProfileRead)
def get_file_profile(file_id: str, db: Session = Depends(get_db)) -> FileProfileRead:
    profile = db.query(FileProfile).filter(FileProfile.file_id == file_id).one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File profile not found")
    return profile
