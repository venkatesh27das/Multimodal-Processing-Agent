from hashlib import sha256
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from backend.app.core.config import settings
from backend.app.core.logging import get_logger

logger = get_logger(__name__)


class StoredFile:
    def __init__(
        self,
        *,
        original_filename: str,
        content_type: str,
        size_bytes: int,
        checksum_sha256: str,
        storage_path: Path,
    ) -> None:
        self.original_filename = original_filename
        self.content_type = content_type
        self.size_bytes = size_bytes
        self.checksum_sha256 = checksum_sha256
        self.storage_path = storage_path


async def store_upload(file: UploadFile) -> StoredFile:
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "upload.bin").suffix
    target_path = settings.storage_dir / f"{uuid4()}{suffix}"

    digest = sha256()
    size_bytes = 0

    with target_path.open("wb") as output:
        while chunk := await file.read(1024 * 1024):
            size_bytes += len(chunk)
            if size_bytes > settings.max_upload_bytes:
                target_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Upload exceeds {settings.max_upload_bytes} byte limit",
                )
            digest.update(chunk)
            output.write(chunk)

    if size_bytes == 0:
        target_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )

    logger.info(
        "stored upload filename=%s size_bytes=%s path=%s",
        file.filename or "upload.bin",
        size_bytes,
        target_path,
    )

    return StoredFile(
        original_filename=file.filename or "upload.bin",
        content_type=file.content_type or "application/octet-stream",
        size_bytes=size_bytes,
        checksum_sha256=digest.hexdigest(),
        storage_path=target_path,
    )
