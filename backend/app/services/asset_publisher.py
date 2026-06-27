from sqlalchemy.orm import Session

from backend.app.models.domain import FileRecord, ParsedAsset, ParserExecutionResult
from backend.app.services.audit_logger import audit_logger


class AssetPublisher:
    def publish(
        self,
        db: Session,
        *,
        job_id: str,
        file_record: FileRecord,
        execution_result: ParserExecutionResult,
    ) -> ParsedAsset:
        payload = execution_result.output_payload or {}
        structured_data = payload.get("structured_data")
        if not isinstance(structured_data, dict):
            structured_data = {}

        parsed_text = payload.get("parsed_text")
        asset = ParsedAsset(
            job_id=job_id,
            file_id=file_record.id,
            asset_type="unified_parsed_asset",
            document_metadata={
                "file_id": file_record.id,
                "original_filename": file_record.original_filename,
                "mime_type": file_record.mime_type,
                "parser_id": execution_result.parser_id,
            },
            parsed_text=parsed_text if isinstance(parsed_text, str) else None,
            layout_blocks=[],
            tables=[],
            image_descriptions=[],
            structured_data=structured_data,
            storage_path=None,
        )
        db.add(asset)
        db.flush()
        audit_logger.log(
            db,
            actor="system",
            action="asset_published",
            entity_type="parsed_asset",
            entity_id=asset.id,
            metadata={"job_id": job_id, "parser_id": execution_result.parser_id},
        )
        return asset


asset_publisher = AssetPublisher()
