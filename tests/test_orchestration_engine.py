from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.routes.jobs import get_db
from backend.app.db.base import Base
from backend.app.db.seed import seed_registry_data
from backend.app.domain.enums import FileType, JobStatus, Modality, QualityStatus, ReviewStatus
from backend.app.main import app
from backend.app.models.domain import (
    AuditEvent,
    FileProfile,
    FileRecord,
    ParsedAsset,
    ParseJob,
    ParserExecutionResult,
    ParsingPlan,
    QualityReport,
    ReviewItem,
)


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


def add_file_with_profile(
    db,
    *,
    tmp_path: Path,
    file_id: str,
    filename: str,
    file_type: FileType,
    content: bytes,
    modalities: list[Modality],
    has_text_layer: bool | None,
    is_scanned: bool | None,
) -> FileRecord:
    storage_path = tmp_path / filename
    storage_path.write_bytes(content)
    file_record = FileRecord(
        id=file_id,
        original_filename=filename,
        file_type=file_type.value,
        mime_type="text/html" if file_type == FileType.HTML else "image/png",
        size_bytes=len(content),
        checksum_sha256="c" * 64,
        source="test",
        storage_path=str(storage_path),
        status=JobStatus.REGISTERED.value,
        created_by="tester",
    )
    profile = FileProfile(
        file_id=file_record.id,
        file_type=file_type.value,
        modalities=[modality.value for modality in modalities],
        has_text_layer=has_text_layer,
        is_scanned=is_scanned,
        table_likelihood=0.2,
        image_likelihood=0.2,
        layout_complexity="low",
        recommended_parsing_strategy="test",
    )
    db.add_all([file_record, profile])
    db.commit()
    return file_record


def run_job(
    client: TestClient,
    file_id: str,
    *,
    governance_constraints: dict[str, object] | None = None,
    quality_target: str = "balanced",
    requested_output_contract: dict[str, object] | None = None,
):
    return client.post(
        "/api/v1/jobs",
        json={
            "file_id": file_id,
            "requested_output_contract": requested_output_contract or {},
            "quality_target": quality_target,
            "cost_profile": "balanced",
            "latency_profile": "interactive",
            "governance_constraints": governance_constraints or {},
        },
    )


def test_successful_parse_publishes_asset_without_review(tmp_path: Path) -> None:
    db = make_session()
    file_record = add_file_with_profile(
        db,
        tmp_path=tmp_path,
        file_id="html-success",
        filename="success.html",
        file_type=FileType.HTML,
        content=b"<html><body>Hello orchestration</body></html>",
        modalities=[Modality.DOCUMENT, Modality.TEXT],
        has_text_layer=True,
        is_scanned=False,
    )

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = run_job(client, file_record.id)
            assert response.status_code == 201
            payload = response.json()
            job_id = payload["job"]["id"]

            assert payload["job"]["status"] == JobStatus.COMPLETE.value
            assert payload["job"]["quality_status"] == QualityStatus.PASSED.value
            assert payload["job"]["parser_id"] == "html_text"
            assert payload["review_item"] is None
            assert payload["assets"][0]["parsed_text"]

            assert client.get(f"/api/v1/jobs/{job_id}").status_code == 200
            assert client.get(f"/api/v1/jobs/{job_id}/plan").status_code == 200
            assert client.get(f"/api/v1/jobs/{job_id}/quality").status_code == 200
            assets_response = client.get(f"/api/v1/jobs/{job_id}/assets")
            assert assets_response.status_code == 200
            assert len(assets_response.json()) == 1
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()


def test_fallback_triggered_for_low_confidence_image(tmp_path: Path) -> None:
    db = make_session()
    file_record = add_file_with_profile(
        db,
        tmp_path=tmp_path,
        file_id="image-fallback",
        filename="fallback.png",
        file_type=FileType.IMAGE,
        content=b"not-really-an-image",
        modalities=[Modality.IMAGE],
        has_text_layer=False,
        is_scanned=True,
    )

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = run_job(client, file_record.id)
            assert response.status_code == 201
            job_id = response.json()["job"]["id"]

            executions = (
                db.query(ParserExecutionResult)
                .filter(ParserExecutionResult.job_id == job_id)
                .all()
            )
            assert {execution.parser_id for execution in executions} == {"image_ocr", "mock_vlm"}
            assert (
                db.query(AuditEvent)
                .filter(AuditEvent.action == "fallback_triggered")
                .filter(AuditEvent.entity_id == job_id)
                .count()
                == 1
            )
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()


def test_fallback_policy_none_disables_fallback_execution(tmp_path: Path) -> None:
    db = make_session()
    file_record = add_file_with_profile(
        db,
        tmp_path=tmp_path,
        file_id="image-no-fallback",
        filename="no-fallback.png",
        file_type=FileType.IMAGE,
        content=b"not-really-an-image",
        modalities=[Modality.IMAGE],
        has_text_layer=False,
        is_scanned=True,
    )

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = run_job(
                client,
                file_record.id,
                governance_constraints={"fallback_policy": "none"},
            )
            assert response.status_code == 201
            job_id = response.json()["job"]["id"]
            executions = (
                db.query(ParserExecutionResult)
                .filter(ParserExecutionResult.job_id == job_id)
                .all()
            )
            assert [execution.parser_id for execution in executions] == ["image_ocr"]
            assert response.json()["assets"][0]["fallback_used"] is False
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()


def test_route_below_threshold_to_review_can_be_disabled(tmp_path: Path) -> None:
    db = make_session()
    file_record = add_file_with_profile(
        db,
        tmp_path=tmp_path,
        file_id="html-no-review",
        filename="no-review.html",
        file_type=FileType.HTML,
        content=b"<html><body>Short text</body></html>",
        modalities=[Modality.DOCUMENT, Modality.TEXT],
        has_text_layer=True,
        is_scanned=False,
    )

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = run_job(
                client,
                file_record.id,
                requested_output_contract={"quality_threshold": 0.99},
                governance_constraints={"route_below_threshold_to_review": False},
            )
            assert response.status_code == 201
            payload = response.json()
            assert payload["job"]["status"] == JobStatus.COMPLETE.value
            assert payload["review_item"] is None
            assert payload["quality"]["human_review_required"] is False
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()


def test_review_triggered_when_best_result_is_below_threshold(tmp_path: Path) -> None:
    db = make_session()
    file_record = add_file_with_profile(
        db,
        tmp_path=tmp_path,
        file_id="image-review",
        filename="review.png",
        file_type=FileType.IMAGE,
        content=b"not-really-an-image",
        modalities=[Modality.IMAGE],
        has_text_layer=False,
        is_scanned=True,
    )

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = run_job(client, file_record.id)
            assert response.status_code == 201
            payload = response.json()
            job_id = payload["job"]["id"]

            assert payload["job"]["status"] == JobStatus.REVIEW_REQUIRED.value
            assert payload["job"]["quality_status"] == QualityStatus.REVIEW_REQUIRED.value
            assert payload["review_item"]["status"] == "open"
            assert db.query(ReviewItem).filter(ReviewItem.job_id == job_id).count() == 1
            latest_quality = (
                db.query(QualityReport)
                .filter(QualityReport.job_id == job_id)
                .order_by(QualityReport.created_at.desc())
                .first()
            )
            assert latest_quality is not None
            assert latest_quality.human_review_required is True
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()


def test_asset_is_published_for_completed_job(tmp_path: Path) -> None:
    db = make_session()
    file_record = add_file_with_profile(
        db,
        tmp_path=tmp_path,
        file_id="html-asset",
        filename="asset.html",
        file_type=FileType.HTML,
        content=b"<html><body>Asset text</body></html>",
        modalities=[Modality.DOCUMENT, Modality.TEXT],
        has_text_layer=True,
        is_scanned=False,
    )

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = run_job(client, file_record.id)
            assert response.status_code == 201
            job_id = response.json()["job"]["id"]

            asset = db.query(ParsedAsset).filter(ParsedAsset.job_id == job_id).one_or_none()
            assert asset is not None
            assert asset.asset_type == "unified_parsed_asset"
            assert asset.parser_used == "html_text"
            assert asset.fallback_used is False
            assert asset.chunks
            assert asset.embeddings
            assert asset.entities
            assert asset.quality_report["quality_status"] == QualityStatus.PASSED.value
            assert asset.lineage["source_file_id"] == file_record.id
            assert "Asset text" in (asset.parsed_text or "")
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()


def test_delete_job_removes_run_outputs(tmp_path: Path) -> None:
    db = make_session()
    file_record = add_file_with_profile(
        db,
        tmp_path=tmp_path,
        file_id="html-delete",
        filename="delete.html",
        file_type=FileType.HTML,
        content=b"<html><body>Delete me</body></html>",
        modalities=[Modality.DOCUMENT, Modality.TEXT],
        has_text_layer=True,
        is_scanned=False,
    )

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = run_job(client, file_record.id)
            assert response.status_code == 201
            job_id = response.json()["job"]["id"]

            assert db.get(ParseJob, job_id) is not None
            assert db.query(ParsingPlan).filter(ParsingPlan.job_id == job_id).count() == 1
            parser_results = db.query(ParserExecutionResult).filter(
                ParserExecutionResult.job_id == job_id,
            )
            assert parser_results.count() == 1
            assert db.query(QualityReport).filter(QualityReport.job_id == job_id).count() >= 1
            assert db.query(ParsedAsset).filter(ParsedAsset.job_id == job_id).count() == 1

            delete_response = client.delete(f"/api/v1/jobs/{job_id}")
            assert delete_response.status_code == 204

            assert client.get(f"/api/v1/jobs/{job_id}").status_code == 404
            assert db.get(ParseJob, job_id) is None
            assert db.query(ParsingPlan).filter(ParsingPlan.job_id == job_id).count() == 0
            assert parser_results.count() == 0
            assert db.query(QualityReport).filter(QualityReport.job_id == job_id).count() == 0
            assert db.query(ParsedAsset).filter(ParsedAsset.job_id == job_id).count() == 0
            assert db.get(FileRecord, file_record.id) is not None
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()


def test_run_history_actions_are_backend_backed(tmp_path: Path) -> None:
    db = make_session()
    file_record = add_file_with_profile(
        db,
        tmp_path=tmp_path,
        file_id="html-actions",
        filename="actions.html",
        file_type=FileType.HTML,
        content=b"<html><body>Action run</body></html>",
        modalities=[Modality.DOCUMENT, Modality.TEXT],
        has_text_layer=True,
        is_scanned=False,
    )

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = run_job(client, file_record.id)
            assert response.status_code == 201
            job_id = response.json()["job"]["id"]

            export_response = client.get("/api/v1/jobs/export")
            assert export_response.status_code == 200
            assert "text/csv" in export_response.headers["content-type"]
            assert "actions.html" in export_response.text

            review_response = client.post(f"/api/v1/jobs/{job_id}/send-to-review")
            assert review_response.status_code == 200
            assert review_response.json()["status"] == JobStatus.REVIEW_REQUIRED.value
            review_item = (
                db.query(ReviewItem)
                .filter(ReviewItem.job_id == job_id, ReviewItem.status == ReviewStatus.OPEN.value)
                .one_or_none()
            )
            assert review_item is not None

            retry_response = client.post(f"/api/v1/jobs/{job_id}/retry")
            assert retry_response.status_code == 201
            retried_job_id = retry_response.json()["id"]
            assert retried_job_id != job_id
            assert db.get(ParseJob, retried_job_id) is not None
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()
