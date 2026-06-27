from hashlib import sha256
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from backend.app.core.config import settings


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
            digest.update(chunk)
            output.write(chunk)

    return StoredFile(
        original_filename=file.filename or "upload.bin",
        content_type=file.content_type or "application/octet-stream",
        size_bytes=size_bytes,
        checksum_sha256=digest.hexdigest(),
        storage_path=target_path,
    )

