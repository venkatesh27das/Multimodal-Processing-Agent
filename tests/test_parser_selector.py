from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db.base import Base
from backend.app.db.seed import seed_registry_data
from backend.app.domain.enums import (
    CostProfile,
    FileType,
    JobStatus,
    LatencyProfile,
    Modality,
    QualityTarget,
)
from backend.app.models.domain import FileProfile, FileRecord
from backend.app.services.parser_selector import parser_selector


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


def make_profile(
    *,
    file_type: FileType,
    modalities: list[Modality],
    has_text_layer: bool | None = None,
    is_scanned: bool | None = None,
) -> FileProfile:
    return FileProfile(
        file_id=f"{file_type.value}-file",
        file_type=file_type.value,
        modalities=[modality.value for modality in modalities],
        has_text_layer=has_text_layer,
        is_scanned=is_scanned,
        table_likelihood=0.2,
        image_likelihood=0.2,
        layout_complexity="low",
        recommended_parsing_strategy="test",
    )


def select_for_profile(
    db,
    profile: FileProfile,
    *,
    quality_target: QualityTarget = QualityTarget.BALANCED,
    requested_output_contract: dict[str, object] | None = None,
):
    return parser_selector.plan(
        db,
        file_profile=profile,
        requested_output_contract=requested_output_contract or {},
        quality_target=quality_target,
        cost_profile=CostProfile.BALANCED,
        latency_profile=LatencyProfile.INTERACTIVE,
        governance_constraints={},
    )


def test_clean_digital_pdf_selects_native_with_azure_fallback() -> None:
    db = make_session()
    profile = make_profile(
        file_type=FileType.PDF,
        modalities=[Modality.DOCUMENT, Modality.TEXT],
        has_text_layer=True,
        is_scanned=False,
    )

    decision = select_for_profile(db, profile)

    assert decision.primary_parser_id == "pdf_native_text"
    assert decision.fallback_parser_id == "azure_document_intelligence"
    assert decision.decision_score > 0
    assert any(score.parser_id == "pdf_native_text" for score in decision.score_breakdown)


def test_scanned_pdf_selects_document_intelligence_with_vlm_fallback_for_high_quality() -> None:
    db = make_session()
    profile = make_profile(
        file_type=FileType.PDF,
        modalities=[Modality.DOCUMENT, Modality.IMAGE],
        has_text_layer=False,
        is_scanned=True,
    )

    decision = select_for_profile(db, profile, quality_target=QualityTarget.HIGH)

    assert decision.primary_parser_id == "azure_document_intelligence"
    assert decision.fallback_parser_id == "mock_vlm"


def test_docx_selects_docx_parser() -> None:
    db = make_session()
    profile = make_profile(
        file_type=FileType.DOCX,
        modalities=[Modality.DOCUMENT, Modality.TEXT],
        has_text_layer=True,
        is_scanned=False,
    )

    decision = select_for_profile(db, profile)

    assert decision.primary_parser_id == "docx_text"
    assert decision.fallback_parser_id is None


def test_html_selects_html_parser() -> None:
    db = make_session()
    profile = make_profile(
        file_type=FileType.HTML,
        modalities=[Modality.DOCUMENT, Modality.TEXT],
        has_text_layer=True,
        is_scanned=False,
    )

    decision = select_for_profile(db, profile)

    assert decision.primary_parser_id == "html_text"


def test_image_selects_ocr_with_vlm_fallback() -> None:
    db = make_session()
    profile = make_profile(
        file_type=FileType.IMAGE,
        modalities=[Modality.IMAGE],
        has_text_layer=False,
        is_scanned=True,
    )

    decision = select_for_profile(db, profile)

    assert decision.primary_parser_id == "image_ocr"
    assert decision.fallback_parser_id == "mock_vlm"


def test_audio_selects_audio_parser_and_meeting_skill() -> None:
    db = make_session()
    profile = make_profile(file_type=FileType.AUDIO, modalities=[Modality.AUDIO])

    decision = select_for_profile(db, profile)

    assert decision.primary_parser_id == "audio_transcription"
    assert decision.selected_skill_id == "audio_meeting_parsing"


def test_video_selects_video_parser() -> None:
    db = make_session()
    profile = make_profile(file_type=FileType.VIDEO, modalities=[Modality.VIDEO, Modality.AUDIO])

    decision = select_for_profile(db, profile)

    assert decision.primary_parser_id == "video_parser"


def test_requested_table_contract_infers_table_skill() -> None:
    db = make_session()
    profile = make_profile(
        file_type=FileType.PDF,
        modalities=[Modality.DOCUMENT, Modality.TEXT],
        has_text_layer=True,
        is_scanned=False,
    )

    decision = select_for_profile(db, profile, requested_output_contract={"tables": True})

    assert decision.selected_skill_id == "table_normalization"


def test_governance_constraints_penalize_external_services() -> None:
    db = make_session()
    profile = make_profile(
        file_type=FileType.PDF,
        modalities=[Modality.DOCUMENT, Modality.IMAGE],
        has_text_layer=False,
        is_scanned=True,
    )

    decision = parser_selector.plan(
        db,
        file_profile=profile,
        requested_output_contract={},
        quality_target=QualityTarget.HIGH,
        cost_profile=CostProfile.BALANCED,
        latency_profile=LatencyProfile.INTERACTIVE,
        governance_constraints={"external_services_allowed": False},
    )

    assert decision.primary_parser_id == "tesseract_ocr"


def test_local_only_pdf_plan_uses_local_fallback() -> None:
    db = make_session()
    profile = make_profile(
        file_type=FileType.PDF,
        modalities=[Modality.DOCUMENT, Modality.TEXT],
        has_text_layer=True,
        is_scanned=False,
    )

    decision = parser_selector.plan(
        db,
        file_profile=profile,
        requested_output_contract={},
        quality_target=QualityTarget.BALANCED,
        cost_profile=CostProfile.BALANCED,
        latency_profile=LatencyProfile.INTERACTIVE,
        governance_constraints={"external_services_allowed": False},
    )

    assert decision.primary_parser_id == "pdf_native_text"
    assert decision.fallback_parser_id in {"tesseract_ocr", "mock_vlm"}


def test_jobs_plan_api_returns_parser_selection() -> None:
    from fastapi.testclient import TestClient

    from backend.app.api.routes.jobs import get_db
    from backend.app.main import app

    db = make_session()
    file_record = FileRecord(
        id="api-file",
        original_filename="api.pdf",
        file_type=FileType.PDF.value,
        mime_type="application/pdf",
        size_bytes=10,
        checksum_sha256="b" * 64,
        source="test",
        storage_path="/tmp/api.pdf",
        status=JobStatus.REGISTERED.value,
        created_by="tester",
    )
    profile = make_profile(
        file_type=FileType.PDF,
        modalities=[Modality.DOCUMENT, Modality.TEXT],
        has_text_layer=True,
        is_scanned=False,
    )
    profile.file_id = file_record.id
    db.add_all([file_record, profile])
    db.commit()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/jobs/plan",
                json={
                    "file_id": file_record.id,
                    "requested_output_contract": {},
                    "quality_target": "balanced",
                    "cost_profile": "balanced",
                    "latency_profile": "interactive",
                    "governance_constraints": {},
                },
            )
            assert response.status_code == 200
            assert response.json()["primary_parser_id"] == "pdf_native_text"
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()
