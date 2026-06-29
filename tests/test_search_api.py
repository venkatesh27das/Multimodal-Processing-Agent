from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db.base import Base
from backend.app.db.seed import seed_registry_data
from backend.app.db.session import get_db
from backend.app.domain.enums import FileType, JobStatus, Modality, QualityStatus, ReviewStatus
from backend.app.main import app
from backend.app.models.domain import (
    AgentTask,
    FileProfile,
    FileRecord,
    ParsedAsset,
    ParseJob,
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


def seed_search_fixture(db, tmp_path: Path) -> None:
    storage_path = tmp_path / "acme-invoice.html"
    storage_path.write_text("<html><body>ACME invoice total due</body></html>")
    file_record = FileRecord(
        id="search-file-acme",
        original_filename="acme-invoice.html",
        file_type=FileType.HTML.value,
        mime_type="text/html",
        size_bytes=storage_path.stat().st_size,
        checksum_sha256="a" * 64,
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
        recommended_parsing_strategy="Search ACME invoice locally.",
    )
    job = ParseJob(
        id="search-job-acme",
        file_id=file_record.id,
        status=JobStatus.COMPLETE.value,
        parser_id="html_text",
        skill_id="invoice_extraction",
        quality_status=QualityStatus.PASSED.value,
    )
    asset = ParsedAsset(
        id="search-asset-acme",
        job_id=job.id,
        file_id=file_record.id,
        asset_type="document",
        parsed_text="ACME invoice structured asset",
        parser_used="html_text",
        skill_used="invoice_extraction",
        structured_data={"vendor": "ACME", "kind": "invoice"},
    )
    review = ReviewItem(
        id="search-review-acme",
        job_id=job.id,
        file_id=file_record.id,
        status=ReviewStatus.OPEN.value,
        reason="ACME invoice confidence review",
    )
    task = AgentTask(
        id="search-task-acme",
        status="completed",
        title="Parse ACME invoice",
        summary="Completed ACME parser-agent task.",
        file_id=file_record.id,
        job_id=job.id,
        requested_output_contract={"kind": "invoice"},
        governance_constraints={},
        input_payload={"materialized_file_ids": [file_record.id], "vendor": "ACME"},
    )
    db.add_all([file_record, profile, job, asset, review, task])
    db.commit()


def test_global_search_returns_cross_workspace_results(tmp_path: Path) -> None:
    db = make_session()
    seed_search_fixture(db, tmp_path)

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/search", params={"q": "acme", "limit": 20})
            assert response.status_code == 200
            payload = response.json()
            assert payload["query"] == "acme"
            result_types = {result["type"] for result in payload["results"]}
            assert {
                "agent_task",
                "file",
                "job",
                "asset",
                "review_item",
            }.issubset(result_types)

            file_result = next(result for result in payload["results"] if result["type"] == "file")
            assert file_result["href"] == "/assets?file_id=search-file-acme"
            task_result = next(
                result for result in payload["results"] if result["type"] == "agent_task"
            )
            assert task_result["href"] == "/jobs/search-job-acme"

            parser_response = client.get("/api/v1/search", params={"q": "html", "limit": 20})
            assert parser_response.status_code == 200
            assert any(
                result["type"] == "parser" and result["id"] == "html_text"
                for result in parser_response.json()["results"]
            )

            skill_response = client.get("/api/v1/search", params={"q": "invoice", "limit": 20})
            assert skill_response.status_code == 200
            assert any(
                result["type"] == "skill" and result["id"] == "invoice_extraction"
                for result in skill_response.json()["results"]
            )
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()


def test_global_search_can_filter_result_types(tmp_path: Path) -> None:
    db = make_session()
    seed_search_fixture(db, tmp_path)

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.get(
                "/api/v1/search",
                params=[("q", "acme"), ("types", "asset"), ("limit", "10")],
            )
            assert response.status_code == 200
            payload = response.json()
            assert payload["results"]
            assert {result["type"] for result in payload["results"]} == {"asset"}
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()
