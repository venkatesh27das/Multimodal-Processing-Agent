from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.db.base import Base
from backend.app.domain.enums import FileType, JobStatus
from backend.app.models.domain import ParsedAsset, ParserExecutionResult, QualityReport
from backend.app.services.fallback_manager import fallback_manager
from backend.app.services.file_type import infer_file_type
from backend.app.services.observability import observability_service
from backend.app.services.quality_evaluator import quality_evaluator


def make_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return testing_session_local()


def test_file_type_inference_uses_extension_and_mime_type() -> None:
    assert infer_file_type("invoice.pdf", None) == FileType.PDF
    assert infer_file_type("report.bin", "text/html") == FileType.HTML
    assert infer_file_type("scan.png", "application/octet-stream") == FileType.IMAGE
    assert infer_file_type("unknown.bin", "application/octet-stream") == FileType.UNKNOWN


def test_fallback_manager_selects_fallback_only_when_threshold_missed() -> None:
    low_result = ParserExecutionResult(
        job_id="job-1",
        parser_id="primary",
        status=JobStatus.COMPLETE.value,
        confidence_score=0.4,
        output_payload={},
    )
    high_result = ParserExecutionResult(
        job_id="job-1",
        parser_id="fallback",
        status=JobStatus.COMPLETE.value,
        confidence_score=0.9,
        output_payload={},
    )

    assert fallback_manager.should_fallback(
        quality_threshold=0.7,
        result=low_result,
        fallback_parser_id="fallback",
    )
    assert not fallback_manager.should_fallback(
        quality_threshold=0.7,
        result=high_result,
        fallback_parser_id="fallback",
    )
    assert fallback_manager.choose_best_result([low_result, high_result]) is high_result


def test_quality_evaluator_marks_final_low_confidence_for_review() -> None:
    db = make_session()
    try:
        result = ParserExecutionResult(
            id="result-1",
            job_id="job-1",
            parser_id="parser",
            status=JobStatus.COMPLETE.value,
            confidence_score=0.3,
            output_payload={"text": "low confidence"},
        )
        db.add(result)
        db.flush()

        report = quality_evaluator.evaluate(
            db,
            job_id="job-1",
            execution_result=result,
            threshold=0.8,
            final=True,
        )

        assert report.quality_status == "review_required"
        assert report.human_review_required is True
        assert report.schema_validation_score == 1.0
    finally:
        db.close()


def test_observability_latency_and_cost_metrics() -> None:
    db = make_session()
    now = datetime.now(UTC)
    try:
        db.add_all(
            [
                ParserExecutionResult(
                    id="exec-1",
                    job_id="job-1",
                    parser_id="html_text",
                    status=JobStatus.COMPLETE.value,
                    duration_ms=10,
                    confidence_score=0.8,
                    output_payload={"text": "ok"},
                    created_at=now,
                ),
                ParserExecutionResult(
                    id="exec-2",
                    job_id="job-2",
                    parser_id="html_text",
                    status=JobStatus.FAILED.value,
                    duration_ms=30,
                    confidence_score=0.0,
                    output_payload={},
                    error_message="boom",
                    created_at=now + timedelta(seconds=1),
                ),
                ParsedAsset(
                    id="asset-1",
                    job_id="job-1",
                    file_id="file-1",
                    asset_type="unified_parsed_asset",
                    document_metadata={},
                    parser_used="html_text",
                    fallback_used=False,
                    cost_estimate={"estimated_cost": 0.25},
                    latency_ms=20,
                ),
                QualityReport(
                    id="quality-1",
                    job_id="job-1",
                    quality_status="passed",
                    extraction_confidence=0.8,
                    quality_explanation="ok",
                ),
            ]
        )
        db.commit()

        usage = observability_service.parser_usage(db)
        assert usage[0].parser_id == "html_text"
        assert usage[0].execution_count == 2
        assert usage[0].error_count == 1
        assert usage[0].estimated_cost == 0.25

        summary = observability_service.summary(db)
        assert summary.cost.estimated_cost == 0.25
        assert summary.latency.max_ms == 30
        assert summary.error_logs[0].message == "boom"
    finally:
        db.close()
