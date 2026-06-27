from datetime import UTC, datetime

from sqlalchemy.orm import Session

from backend.app.domain.enums import FileType, JobStatus
from backend.app.models.domain import FileRecord, ParserExecutionResult
from backend.app.parsers.base import ParseRequest
from backend.app.services.audit_logger import audit_logger
from backend.app.services.parser_registry import parser_registry


class ExecutionEngine:
    def execute_parser(
        self,
        db: Session,
        *,
        job_id: str,
        file_record: FileRecord,
        parser_id: str,
    ) -> ParserExecutionResult:
        parser = parser_registry.get_parser_instance(parser_id)
        started_at = datetime.now(UTC)

        if parser is None:
            completed_at = datetime.now(UTC)
            result = ParserExecutionResult(
                job_id=job_id,
                parser_id=parser_id,
                status=JobStatus.FAILED.value,
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=self._duration_ms(started_at, completed_at),
                confidence_score=0.0,
                output_payload={},
                error_message="Parser implementation not found.",
            )
            db.add(result)
            return result

        try:
            parse_result = parser.parse(
                ParseRequest(
                    file_id=file_record.id,
                    filename=file_record.original_filename,
                    file_type=FileType(file_record.file_type),
                    mime_type=file_record.mime_type,
                    storage_path=file_record.storage_path,
                )
            )
            completed_at = datetime.now(UTC)
            result = ParserExecutionResult(
                job_id=job_id,
                parser_id=parser_id,
                status=JobStatus.COMPLETE.value,
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=self._duration_ms(started_at, completed_at),
                confidence_score=parse_result.confidence_score,
                output_payload=parse_result.model_dump(mode="json"),
            )
        except Exception as exc:
            completed_at = datetime.now(UTC)
            result = ParserExecutionResult(
                job_id=job_id,
                parser_id=parser_id,
                status=JobStatus.FAILED.value,
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=self._duration_ms(started_at, completed_at),
                confidence_score=0.0,
                output_payload={},
                error_message=str(exc),
            )

        db.add(result)
        db.flush()
        audit_logger.log(
            db,
            actor="system",
            action="parser_executed",
            entity_type="parser_execution_result",
            entity_id=result.id,
            metadata={
                "job_id": job_id,
                "parser_id": parser_id,
                "confidence_score": result.confidence_score,
                "status": result.status,
            },
        )
        return result

    def _duration_ms(self, started_at: datetime, completed_at: datetime) -> int:
        return int((completed_at - started_at).total_seconds() * 1000)


execution_engine = ExecutionEngine()

