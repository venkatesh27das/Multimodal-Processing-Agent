from datetime import UTC, datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.db.base import Base
from backend.app.db.seed import seed_registry_data
from backend.app.domain.enums import (
    FileType,
    JobStatus,
    Modality,
    QualityStatus,
    ReviewStatus,
)
from backend.app.models import (
    AuditEvent,
    FileProfile,
    FileRecord,
    ParsedAsset,
    ParseJob,
    ParserDefinition,
    ParserExecutionResult,
    ParsingPlan,
    QualityReport,
    ReviewItem,
    SkillDefinition,
)
from backend.app.schemas.domain import (
    AuditEventRead,
    FileProfileRead,
    FileRecordRead,
    ParsedAssetRead,
    ParseJobRead,
    ParserDefinitionRead,
    ParserExecutionResultRead,
    ParsingPlanRead,
    QualityReportRead,
    ReviewItemRead,
    SkillDefinitionRead,
)


def make_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return TestingSessionLocal()


def test_registry_seed_data_is_created() -> None:
    db = make_session()

    seed_registry_data(db)

    parsers = db.query(ParserDefinition).all()
    skills = db.query(SkillDefinition).all()
    assert {parser.parser_id for parser in parsers} >= {"pdf_native_text", "docx_text", "mock_vlm"}
    assert {skill.skill_id for skill in skills} >= {
        "invoice_extraction",
        "contract_parsing",
        "research_paper_parsing",
        "audio_meeting_parsing",
        "table_normalization",
        "knowledge_graph_preparation",
    }


def test_domain_model_creation_and_pydantic_serialization() -> None:
    db = make_session()
    seed_registry_data(db)

    file_record = FileRecord(
        id="file-1",
        original_filename="invoice.pdf",
        file_type=FileType.PDF.value,
        mime_type="application/pdf",
        size_bytes=128,
        checksum_sha256="a" * 64,
        source="test",
        storage_path="/tmp/invoice.pdf",
        status=JobStatus.REGISTERED.value,
        created_by="tester",
    )
    db.add(file_record)
    db.flush()

    file_profile = FileProfile(
        file_id=file_record.id,
        file_type=FileType.PDF.value,
        modalities=[Modality.DOCUMENT.value, Modality.TEXT.value],
        has_text_layer=True,
        is_scanned=False,
        page_count=2,
        table_likelihood=0.2,
        image_likelihood=0.1,
        language="en",
        layout_complexity="low",
        estimated_cost_class="low",
        recommended_parsing_strategy="Use native text extraction.",
    )
    parse_job = ParseJob(
        id="job-1",
        file_id=file_record.id,
        status=JobStatus.QUEUED.value,
        parser_id="pdf_native_text",
        skill_id="invoice_extraction",
        quality_status=QualityStatus.NOT_EVALUATED.value,
    )
    db.add_all([file_profile, parse_job])
    db.flush()

    parsing_plan = ParsingPlan(
        id="plan-1",
        job_id=parse_job.id,
        file_id=file_record.id,
        selected_parser_id="pdf_native_text",
        fallback_parser_id="mock_vlm",
        selected_skill_id="invoice_extraction",
        output_contract={"version": "0.1.0"},
        expected_assets=["parsed_text", "tables"],
        quality_threshold=0.85,
        cost_profile={"level": "low"},
        human_review_policy={"threshold": 0.85},
        decision_reason="Native text parser is suitable for text-layer PDF.",
    )
    execution_result = ParserExecutionResult(
        id="result-1",
        job_id=parse_job.id,
        parser_id="pdf_native_text",
        status=JobStatus.COMPLETE.value,
        started_at=datetime.now(UTC),
        completed_at=datetime.now(UTC),
        duration_ms=25,
        confidence_score=0.91,
        output_payload={"text": "Invoice total 10.00"},
    )
    db.add_all([parsing_plan, execution_result])
    db.flush()

    quality_report = QualityReport(
        id="quality-1",
        job_id=parse_job.id,
        execution_result_id=execution_result.id,
        quality_status=QualityStatus.PASSED.value,
        parser_confidence=0.91,
        extraction_confidence=0.88,
        schema_validation_score=0.9,
        completeness_score=0.87,
        consistency_score=0.93,
        human_review_required=False,
        quality_explanation="Meets MVP threshold.",
    )
    parsed_asset = ParsedAsset(
        id="asset-1",
        job_id=parse_job.id,
        file_id=file_record.id,
        asset_type="unified_parsed_asset",
        document_metadata={"filename": "invoice.pdf"},
        parsed_text="Invoice total 10.00",
        layout_blocks=[],
        tables=[],
        image_descriptions=[],
        structured_data={"total": 10.0},
        storage_path=None,
    )
    db.add_all([quality_report, parsed_asset])
    db.flush()

    review_item = ReviewItem(
        id="review-1",
        job_id=parse_job.id,
        file_id=file_record.id,
        quality_report_id=quality_report.id,
        status=ReviewStatus.OPEN.value,
        reason="Manual review test fixture.",
    )
    audit_event = AuditEvent(
        id="audit-1",
        actor="tester",
        action="created",
        entity_type="parse_job",
        entity_id=parse_job.id,
        event_metadata={"source": "unit-test"},
    )
    db.add_all([review_item, audit_event])
    db.commit()

    parser = db.get(ParserDefinition, "pdf_native_text")
    skill = db.get(SkillDefinition, "invoice_extraction")
    assert parser is not None
    assert skill is not None

    serialized = {
        "file_record": FileRecordRead.model_validate(file_record).model_dump(mode="json"),
        "file_profile": FileProfileRead.model_validate(file_profile).model_dump(mode="json"),
        "parser": ParserDefinitionRead.model_validate(parser).model_dump(mode="json"),
        "skill": SkillDefinitionRead.model_validate(skill).model_dump(mode="json"),
        "parse_job": ParseJobRead.model_validate(parse_job).model_dump(mode="json"),
        "parsing_plan": ParsingPlanRead.model_validate(parsing_plan).model_dump(mode="json"),
        "execution_result": ParserExecutionResultRead.model_validate(execution_result).model_dump(
            mode="json"
        ),
        "quality_report": QualityReportRead.model_validate(quality_report).model_dump(mode="json"),
        "parsed_asset": ParsedAssetRead.model_validate(parsed_asset).model_dump(mode="json"),
        "review_item": ReviewItemRead.model_validate(review_item).model_dump(mode="json"),
        "audit_event": AuditEventRead.model_validate(audit_event).model_dump(mode="json"),
    }

    assert serialized["file_record"]["file_type"] == "pdf"
    assert serialized["file_profile"]["modalities"] == ["document", "text"]
    assert serialized["parser"]["parser_type"] == "deterministic"
    assert serialized["skill"]["supported_document_types"][0] == "pdf"
    assert serialized["parse_job"]["quality_status"] == "not_evaluated"
    assert serialized["quality_report"]["quality_status"] == "passed"
    assert serialized["review_item"]["status"] == "open"
    assert serialized["audit_event"]["event_metadata"] == {"source": "unit-test"}

