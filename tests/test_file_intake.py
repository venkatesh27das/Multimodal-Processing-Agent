from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.routes.files import get_db
from backend.app.core.config import settings
from backend.app.db.base import Base
from backend.app.domain.enums import FileType, Modality
from backend.app.main import app
from backend.app.models.domain import FileProfile, FileRecord
from backend.app.services.file_type import infer_file_type


def make_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return testing_session_local()


def test_infer_file_type_uses_extension_and_mime_type() -> None:
    assert infer_file_type("sample.pdf", None) == FileType.PDF
    assert infer_file_type("sample.bin", "text/html") == FileType.HTML
    assert infer_file_type("sample.jpeg", "application/octet-stream") == FileType.IMAGE
    assert infer_file_type("sample.unknown", "application/octet-stream") == FileType.UNKNOWN


def test_upload_stores_file_creates_record_and_profile(tmp_path: Path) -> None:
    db = make_session()
    previous_storage_dir = settings.storage_dir
    settings.storage_dir = tmp_path

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/files/upload",
                files={
                    "file": (
                        "sample.html",
                        b"<html><body><table><tr><td>Hello</td></tr></table></body></html>",
                        "text/html",
                    )
                },
            )
            assert response.status_code == 201
            payload = response.json()

            file_id = payload["file_id"]
            stored_path = Path(payload["storage_path"])
            assert stored_path.exists()
            assert payload["file_type"] == FileType.HTML.value
            assert payload["mime_type"] == "text/html"
            assert payload["size_bytes"] > 0
            assert len(payload["checksum_sha256"]) == 64

            file_response = client.get(f"/api/v1/files/{file_id}")
            assert file_response.status_code == 200
            assert file_response.json()["original_filename"] == "sample.html"

            profile_response = client.get(f"/api/v1/files/{file_id}/profile")
            assert profile_response.status_code == 200
            profile = profile_response.json()
            assert profile["file_type"] == FileType.HTML.value
            assert profile["modalities"] == [Modality.DOCUMENT.value, Modality.TEXT.value]
            assert profile["has_text_layer"] is True
            assert profile["is_scanned"] is False
            assert profile["table_likelihood"] > 0
            assert "HTML parser" in profile["recommended_parsing_strategy"]

            record = db.get(FileRecord, file_id)
            assert record is not None
            db_profile = db.query(FileProfile).filter(FileProfile.file_id == file_id).one_or_none()
            assert db_profile is not None
    finally:
        app.dependency_overrides.pop(get_db, None)
        settings.storage_dir = previous_storage_dir
        db.close()


def test_profile_route_returns_404_for_missing_file_profile() -> None:
    db = make_session()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/files/missing/profile")
            assert response.status_code == 404
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()
