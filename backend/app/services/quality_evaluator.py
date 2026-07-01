from sqlalchemy.orm import Session

from backend.app.domain.enums import JobStatus, QualityStatus
from backend.app.models.domain import ParserExecutionResult, QualityReport


class QualityEvaluator:
    def evaluate(
        self,
        db: Session,
        *,
        job_id: str,
        execution_result: ParserExecutionResult,
        threshold: float,
        final: bool = False,
        route_to_review: bool = True,
    ) -> QualityReport:
        confidence = execution_result.confidence_score or 0.0
        failed = execution_result.status == JobStatus.FAILED.value
        passed = confidence >= threshold and not failed
        quality_status = QualityStatus.PASSED if passed else QualityStatus.FALLBACK_REQUIRED
        if final and not passed and (route_to_review or failed):
            quality_status = QualityStatus.REVIEW_REQUIRED

        report = QualityReport(
            job_id=job_id,
            execution_result_id=execution_result.id,
            quality_status=quality_status.value,
            parser_confidence=confidence,
            extraction_confidence=confidence,
            schema_validation_score=1.0 if execution_result.output_payload else 0.0,
            completeness_score=min(1.0, confidence + 0.1),
            consistency_score=confidence,
            human_review_required=quality_status == QualityStatus.REVIEW_REQUIRED,
            quality_explanation=(
                f"Confidence {confidence:.2f} compared with threshold {threshold:.2f}."
            ),
        )
        db.add(report)
        db.flush()
        return report


quality_evaluator = QualityEvaluator()
