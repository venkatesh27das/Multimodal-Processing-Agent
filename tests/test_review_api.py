from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.routes.dashboard import get_db
from backend.app.db.base import Base
from backend.app.db.seed import seed_registry_data
from backend.app.domain.enums import FileType, JobStatus, QualityStatus, ReviewStatus
from backend.app.main import app
from backend.app.models.domain import AuditEvent, FileRecord, ParseJob, ReviewItem


def make_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = testing_session_local()
    seed_registry_data(db)
    return db


def add_review_item(db) -> ReviewItem:
    file_record = FileRecord(
        id="review-file",
        original_filename="review.html",
        file_type=FileType.HTML.value,
        mime_type="text/html",
        size_bytes=128,
        checksum_sha256="e" * 64,
        source="test",
        storage_path="/tmp/review.html",
        status=JobStatus.REGISTERED.value,
        created_by="tester",
    )
    job = ParseJob(
        id="review-job",
        file_id=file_record.id,
        status=JobStatus.REVIEW_REQUIRED.value,
        parser_id="html_text",
        quality_status=QualityStatus.REVIEW_REQUIRED.value,
    )
    review_item = ReviewItem(
        id="review-item",
        job_id=job.id,
        file_id=file_record.id,
        status=ReviewStatus.OPEN.value,
        reason="Confidence below review threshold.",
    )
    db.add_all([file_record, job, review_item])
    db.commit()
    return review_item


def test_review_items_can_be_listed_and_approved() -> None:
    db = make_session()
    add_review_item(db)

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/review/items")
            assert response.status_code == 200
            assert response.json()[0]["status"] == "open"

            response = client.post(
                "/api/v1/review/items/review-item/approve",
                json={"resolution_notes": "Looks correct.", "actor": "reviewer@example.com"},
            )
            assert response.status_code == 200
            payload = response.json()
            assert payload["status"] == "resolved"
            assert payload["resolution_notes"] == "Looks correct."
            assert (
                db.query(AuditEvent)
                .filter(AuditEvent.action == "review_item_approved")
                .count()
                == 1
            )
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()


def test_review_item_can_be_rejected_and_summary_counts_open_items() -> None:
    db = make_session()
    add_review_item(db)

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            summary = client.get("/api/v1/review/summary")
            assert summary.status_code == 200
            assert summary.json()["pending_review"] == 1

            response = client.post(
                "/api/v1/review/items/review-item/reject",
                json={"resolution_notes": "Missing required table."},
            )
            assert response.status_code == 200
            assert response.json()["status"] == "dismissed"

            summary = client.get("/api/v1/review/summary")
            assert summary.json()["pending_review"] == 0
            assert (
                db.query(AuditEvent)
                .filter(AuditEvent.action == "review_item_rejected")
                .count()
                == 1
            )
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()
