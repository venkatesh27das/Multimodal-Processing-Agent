from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db.base import Base
from backend.app.db.seed import seed_registry_data
from backend.app.db.session import get_db
from backend.app.domain.enums import FileType, JobStatus, Modality
from backend.app.main import app
from backend.app.models.domain import AuditEvent, FileProfile, FileRecord


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


def add_html_file(db, tmp_path: Path, *, file_id: str, filename: str) -> FileRecord:
    storage_path = tmp_path / filename
    storage_path.write_text("<html><body>Invoice INV-1001</body></html>")
    file_record = FileRecord(
        id=file_id,
        original_filename=filename,
        file_type=FileType.HTML.value,
        mime_type="text/html",
        size_bytes=storage_path.stat().st_size,
        checksum_sha256="d" * 64,
        source="test",
        storage_path=str(storage_path),
        status=JobStatus.REGISTERED.value,
        created_by="tester",
    )
    profile = FileProfile(
        file_id=file_record.id,
        file_type=FileType.HTML.value,
        modalities=[Modality.DOCUMENT.value, Modality.TEXT.value],
        has_text_layer=True,
        is_scanned=False,
        table_likelihood=0.2,
        image_likelihood=0.1,
        layout_complexity="low",
        recommended_parsing_strategy="Use HTML parser.",
    )
    db.add_all([file_record, profile])
    db.commit()
    return file_record


def override_db(db):
    def _override():
        yield db

    return _override


def test_observability_endpoints_report_job_metrics_and_audit_events(tmp_path: Path) -> None:
    db = make_session()
    file_record = add_html_file(
        db,
        tmp_path,
        file_id="obs-html",
        filename="invoice.html",
    )
    app.dependency_overrides[get_db] = override_db(db)
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/jobs",
                json={
                    "file_id": file_record.id,
                    "requested_output_contract": {"parsed_text": True},
                    "quality_target": "balanced",
                    "cost_profile": "balanced",
                    "latency_profile": "interactive",
                    "governance_constraints": {},
                },
            )
            assert response.status_code == 201

            summary = client.get("/api/v1/observability/summary")
            assert summary.status_code == 200
            summary_payload = summary.json()
            assert summary_payload["jobs"]["total_jobs"] == 1
            assert summary_payload["jobs"]["completed_jobs"] == 1
            assert summary_payload["jobs"]["success_rate"] == 1
            assert summary_payload["fallback"]["count"] == 0

            parser_usage = client.get("/api/v1/observability/parser-usage")
            assert parser_usage.status_code == 200
            parser_payload = parser_usage.json()
            assert parser_payload[0]["parser_id"] == "html_text"
            assert parser_payload[0]["execution_count"] == 1

            quality = client.get("/api/v1/observability/quality")
            assert quality.status_code == 200
            assert quality.json()["passed"] == 2

            audit = client.get("/api/v1/audit/events")
            assert audit.status_code == 200
            actions = {event["action"] for event in audit.json()["events"]}
            assert "governance_policy_checked" in actions
            assert "job_completed" in actions
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()


def test_governance_policy_can_block_restricted_documents(tmp_path: Path) -> None:
    db = make_session()
    file_record = add_html_file(
        db,
        tmp_path,
        file_id="restricted-html",
        filename="confidential-contract.html",
    )
    app.dependency_overrides[get_db] = override_db(db)
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/jobs",
                json={
                    "file_id": file_record.id,
                    "requested_output_contract": {"parsed_text": True},
                    "quality_target": "balanced",
                    "cost_profile": "balanced",
                    "latency_profile": "interactive",
                    "governance_constraints": {
                        "restricted_document": True,
                        "block_restricted_documents": True,
                    },
                },
            )
            assert response.status_code == 409
            assert "Governance policy blocked" in response.json()["detail"]

            event = (
                db.query(AuditEvent)
                .filter(AuditEvent.action == "governance_policy_blocked")
                .one()
            )
            assert event.event_metadata["restricted_document"] is True
            assert event.event_metadata["allowed"] is False
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()
