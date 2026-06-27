from pathlib import Path

from backend.app.domain.enums import FileType

IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "tif", "tiff", "bmp"}
AUDIO_EXTENSIONS = {"mp3", "wav", "m4a", "aac", "flac", "ogg"}
VIDEO_EXTENSIONS = {"mp4", "mov", "avi", "mkv", "webm", "m4v"}


def infer_file_type(filename: str, mime_type: str | None = None) -> FileType:
    mime = (mime_type or "").lower()
    suffix = Path(filename).suffix.lstrip(".").lower()

    if suffix == "pdf" or mime == "application/pdf":
        return FileType.PDF
    if suffix == "docx" or mime.endswith("wordprocessingml.document"):
        return FileType.DOCX
    if suffix in {"html", "htm"} or mime in {"text/html", "application/xhtml+xml"}:
        return FileType.HTML
    if suffix in IMAGE_EXTENSIONS or mime.startswith("image/"):
        return FileType.IMAGE
    if suffix in AUDIO_EXTENSIONS or mime.startswith("audio/"):
        return FileType.AUDIO
    if suffix in VIDEO_EXTENSIONS or mime.startswith("video/"):
        return FileType.VIDEO
    return FileType.UNKNOWN

