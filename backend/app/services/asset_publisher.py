from sqlalchemy.orm import Session

from backend.app.models.domain import (
    AuditEvent,
    FileRecord,
    ParsedAsset,
    ParserExecutionResult,
    ParsingPlan,
    QualityReport,
)
from backend.app.services.audit_logger import audit_logger
from backend.app.services.output_contract import output_contract_builder


class AssetPublisher:
    def publish(
        self,
        db: Session,
        *,
        job_id: str,
        file_record: FileRecord,
        execution_result: ParserExecutionResult,
        quality_report: QualityReport,
        plan: ParsingPlan,
        fallback_used: bool,
    ) -> ParsedAsset:
        audit_events = (
            db.query(AuditEvent)
            .filter(AuditEvent.entity_id.in_([job_id, execution_result.id]))
            .order_by(AuditEvent.created_at.asc())
            .all()
        )
        contract = output_contract_builder.build(
            file_record=file_record,
            execution_result=execution_result,
            quality_report=quality_report,
            plan=plan,
            fallback_used=fallback_used,
            audit_events=audit_events,
        )
        asset = ParsedAsset(
            job_id=job_id,
            file_id=file_record.id,
            asset_type=str(contract["asset_type"]),
            document_metadata=contract["document_metadata"],
            parsed_text=contract["parsed_text"],
            layout_blocks=contract["layout_blocks"],
            tables=contract["tables"],
            image_descriptions=contract["image_descriptions"],
            audio_transcript=contract["audio_transcript"],
            video_transcript=contract["video_transcript"],
            chunks=contract["chunks"],
            embeddings=contract["embeddings"],
            entities=contract["entities"],
            relationships=contract["relationships"],
            evidence_spans=contract["evidence_spans"],
            quality_report=contract["quality_report"],
            lineage=contract["lineage"],
            parser_used=str(contract["parser_used"]),
            fallback_used=bool(contract["fallback_used"]),
            skill_used=contract["skill_used"],
            cost_estimate=contract["cost_estimate"],
            latency_ms=contract["latency_ms"],
            audit_trail=contract["audit_trail"],
            structured_data=contract["structured_data"],
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
