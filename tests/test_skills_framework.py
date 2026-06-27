from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.routes.jobs import get_db
from backend.app.db.base import Base
from backend.app.db.seed import seed_registry_data
from backend.app.domain.enums import FileType, JobStatus, Modality
from backend.app.main import app
from backend.app.models.domain import FileProfile, FileRecord, ParsedAsset
from backend.app.services.skills_framework import (
    SkillExecutionRequest,
    SkillLoader,
    skill_executor,
    skill_registry,
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


def test_skill_loader_loads_initial_skills() -> None:
    skills = SkillLoader().load_all()

    assert {skill.skill_id for skill in skills} == {
        "audio_meeting_parsing",
        "contract_parsing",
        "invoice_extraction",
        "knowledge_graph_preparation",
        "research_paper_parsing",
        "table_normalization",
    }
    invoice = next(skill for skill in skills if skill.skill_id == "invoice_extraction")
    assert invoice.schema["required"] == ["invoice_number", "vendor_name", "total_amount"]
    assert FileType.PDF in invoice.supported_document_types


def test_skill_registry_and_executor_mock_invoice_extraction() -> None:
    skill_registry.refresh()
    skill = skill_registry.get_skill("invoice_extraction")
    assert skill is not None

    result = skill_executor.execute(
        "invoice_extraction",
        SkillExecutionRequest(parsed_text="Acme Corp invoice INV-123 total $42.50"),
    )

    assert result.valid is True
    assert result.output["invoice_number"] == "INV-123"
    assert result.output["vendor_name"] == "Acme"
    assert result.output["total_amount"] == 42.5


def test_skills_api_list_get_and_test() -> None:
    with TestClient(app) as client:
        list_response = client.get("/api/v1/skills")
        assert list_response.status_code == 200
        assert len(list_response.json()) == 6

        get_response = client.get("/api/v1/skills/table_normalization")
        assert get_response.status_code == 200
        assert get_response.json()["skill_id"] == "table_normalization"

        test_response = client.post(
            "/api/v1/skills/invoice_extraction/test",
            json={"parsed_text": "Globex invoice INV-900 total 19.99"},
        )
        assert test_response.status_code == 200
        payload = test_response.json()
        assert payload["valid"] is True
        assert payload["output"]["invoice_number"] == "INV-900"


def test_selected_skill_output_is_attached_to_parsed_asset(tmp_path: Path) -> None:
    db = make_session()
    storage_path = tmp_path / "invoice.html"
    storage_path.write_text("Acme Corp invoice INV-777 total 88.00")
    file_record = FileRecord(
        id="skill-file",
        original_filename="invoice.html",
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
        table_likelihood=0.0,
        image_likelihood=0.0,
        layout_complexity="low",
        recommended_parsing_strategy="test",
    )
    db.add_all([file_record, profile])
    db.commit()

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/jobs",
                json={
                    "file_id": file_record.id,
                    "requested_output_contract": {"skill_id": "invoice_extraction"},
                    "quality_target": "balanced",
                    "cost_profile": "balanced",
                    "latency_profile": "interactive",
                    "governance_constraints": {},
                },
            )
            assert response.status_code == 201
            job_id = response.json()["job"]["id"]
            asset = db.query(ParsedAsset).filter(ParsedAsset.job_id == job_id).one()
            skill_output = asset.structured_data["skill_output"]
            assert skill_output["skill_id"] == "invoice_extraction"
            assert skill_output["valid"] is True
            assert skill_output["output"]["invoice_number"] == "INV-777"
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()

