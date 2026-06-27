from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from backend.app.domain.enums import (
    CostProfile,
    JobStatus,
    LatencyProfile,
    QualityTarget,
    ReviewStatus,
)
from backend.app.models.domain import (
    FileProfile,
    FileRecord,
    ParsedAsset,
    ParseJob,
    ParserExecutionResult,
    QualityReport,
    ReviewItem,
)
from backend.app.schemas.domain import ParserSelectionRequest
from backend.app.services.audit_logger import audit_logger
from backend.app.services.execution_engine import execution_engine
from backend.app.services.orchestration_engine import orchestration_engine

ToolCallable = Callable[[Session, dict[str, Any]], dict[str, Any]]


@dataclass(frozen=True)
class MCPTool:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: ToolCallable

    def metadata(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema,
        }


class MCPServer:
    def __init__(self) -> None:
        self._tools: dict[str, MCPTool] = {
            "parse_document": MCPTool(
                name="parse_document",
                description="Run the parsing orchestration flow for one registered file.",
                input_schema={
                    "type": "object",
                    "required": ["file_id"],
                    "properties": self._strategy_properties(),
                },
                handler=self.parse_document,
            ),
            "parse_batch": MCPTool(
                name="parse_batch",
                description="Run parsing orchestration for multiple registered files.",
                input_schema={
                    "type": "object",
                    "required": ["file_ids"],
                    "properties": {
                        "file_ids": {"type": "array", "items": {"type": "string"}},
                        **self._strategy_properties(),
                    },
                },
                handler=self.parse_batch,
            ),
            "get_parse_status": MCPTool(
                name="get_parse_status",
                description="Return status and parser metadata for a parse job.",
                input_schema=self._job_id_schema(),
                handler=self.get_parse_status,
            ),
            "get_document_assets": MCPTool(
                name="get_document_assets",
                description="Return unified parsed assets for a file.",
                input_schema={
                    "type": "object",
                    "required": ["file_id"],
                    "properties": {"file_id": {"type": "string"}},
                },
                handler=self.get_document_assets,
            ),
            "get_quality_report": MCPTool(
                name="get_quality_report",
                description="Return the latest quality report for a parse job.",
                input_schema=self._job_id_schema(),
                handler=self.get_quality_report,
            ),
            "compare_parser_outputs": MCPTool(
                name="compare_parser_outputs",
                description="Execute selected parsers for a file and compare confidence scores.",
                input_schema={
                    "type": "object",
                    "required": ["file_id", "parser_ids"],
                    "properties": {
                        "file_id": {"type": "string"},
                        "parser_ids": {"type": "array", "items": {"type": "string"}},
                    },
                },
                handler=self.compare_parser_outputs,
            ),
            "reprocess_with_strategy": MCPTool(
                name="reprocess_with_strategy",
                description="Re-run parsing for a file with an explicit strategy profile.",
                input_schema={
                    "type": "object",
                    "required": ["file_id", "strategy"],
                    "properties": {
                        "file_id": {"type": "string"},
                        "strategy": {
                            "type": "object",
                            "properties": self._strategy_properties(),
                        },
                    },
                },
                handler=self.reprocess_with_strategy,
            ),
            "submit_human_review": MCPTool(
                name="submit_human_review",
                description="Create a human review item for an existing parse job.",
                input_schema={
                    "type": "object",
                    "required": ["job_id", "reason"],
                    "properties": {
                        "job_id": {"type": "string"},
                        "reason": {"type": "string"},
                        "assigned_to": {"type": "string"},
                    },
                },
                handler=self.submit_human_review,
            ),
        }

    def list_tools(self) -> list[dict[str, Any]]:
        return [tool.metadata() for tool in self._tools.values()]

    def get_tool(self, name: str) -> MCPTool | None:
        return self._tools.get(name)

    def call_tool(self, db: Session, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        tool = self.get_tool(name)
        if tool is None:
            raise KeyError(f"MCP tool not found: {name}")
        return tool.handler(db, arguments)

    def parse_document(self, db: Session, arguments: dict[str, Any]) -> dict[str, Any]:
        file_record, file_profile = self._load_file_and_profile(
            db,
            self._string(arguments, "file_id"),
        )
        request = self._selection_request(file_record.id, arguments)
        job, plan, quality, asset, review_item = orchestration_engine.run(
            db,
            file_record=file_record,
            file_profile=file_profile,
            request=request,
        )
        return {
            "job": self._job_payload(job),
            "plan_id": plan.id,
            "quality": self._quality_payload(quality),
            "assets": [self._asset_payload(asset)],
            "review_item_id": review_item.id if review_item else None,
        }

    def parse_batch(self, db: Session, arguments: dict[str, Any]) -> dict[str, Any]:
        file_ids = arguments.get("file_ids")
        if not isinstance(file_ids, list):
            raise ValueError("file_ids must be a list")

        results = []
        for file_id in file_ids:
            batch_args = {**arguments, "file_id": file_id}
            results.append(self.parse_document(db, batch_args))
        return {"results": results}

    def get_parse_status(self, db: Session, arguments: dict[str, Any]) -> dict[str, Any]:
        job = self._load_job(db, self._string(arguments, "job_id"))
        return self._job_payload(job)

    def get_document_assets(self, db: Session, arguments: dict[str, Any]) -> dict[str, Any]:
        file_id = self._string(arguments, "file_id")
        assets = db.query(ParsedAsset).filter(ParsedAsset.file_id == file_id).all()
        return {"file_id": file_id, "assets": [self._asset_payload(asset) for asset in assets]}

    def get_quality_report(self, db: Session, arguments: dict[str, Any]) -> dict[str, Any]:
        job_id = self._string(arguments, "job_id")
        report = (
            db.query(QualityReport)
            .filter(QualityReport.job_id == job_id)
            .order_by(QualityReport.created_at.desc())
            .first()
        )
        if report is None:
            raise LookupError(f"Quality report not found for job: {job_id}")
        return self._quality_payload(report)

    def compare_parser_outputs(self, db: Session, arguments: dict[str, Any]) -> dict[str, Any]:
        file_record, _ = self._load_file_and_profile(db, self._string(arguments, "file_id"))
        parser_ids = arguments.get("parser_ids")
        if not isinstance(parser_ids, list) or not parser_ids:
            raise ValueError("parser_ids must be a non-empty list")

        job = ParseJob(
            file_id=file_record.id,
            status=JobStatus.RUNNING.value,
            quality_status="not_evaluated",
        )
        db.add(job)
        db.flush()

        results = [
            execution_engine.execute_parser(
                db,
                job_id=job.id,
                file_record=file_record,
                parser_id=str(parser_id),
            )
            for parser_id in parser_ids
        ]
        best = max(results, key=lambda result: result.confidence_score or 0.0)
        job.status = JobStatus.COMPLETE.value
        job.parser_id = best.parser_id
        audit_logger.log(
            db,
            actor="mcp",
            action="parser_outputs_compared",
            entity_type="parse_job",
            entity_id=job.id,
            metadata={"parser_ids": parser_ids, "best_parser_id": best.parser_id},
        )
        db.commit()
        return {
            "job_id": job.id,
            "best_parser_id": best.parser_id,
            "results": [self._execution_payload(result) for result in results],
        }

    def reprocess_with_strategy(self, db: Session, arguments: dict[str, Any]) -> dict[str, Any]:
        strategy = arguments.get("strategy")
        if not isinstance(strategy, dict):
            raise ValueError("strategy must be an object")
        return self.parse_document(db, {**strategy, "file_id": self._string(arguments, "file_id")})

    def submit_human_review(self, db: Session, arguments: dict[str, Any]) -> dict[str, Any]:
        job = self._load_job(db, self._string(arguments, "job_id"))
        reason = self._string(arguments, "reason")
        assigned_to = arguments.get("assigned_to")
        review_item = ReviewItem(
            job_id=job.id,
            file_id=job.file_id,
            status=ReviewStatus.OPEN.value,
            reason=reason,
            assigned_to=assigned_to if isinstance(assigned_to, str) else None,
        )
        db.add(review_item)
        db.flush()
        audit_logger.log(
            db,
            actor="mcp",
            action="human_review_submitted",
            entity_type="review_item",
            entity_id=review_item.id,
            metadata={"job_id": job.id, "reason": reason},
        )
        db.commit()
        db.refresh(review_item)
        return {
            "review_item_id": review_item.id,
            "job_id": job.id,
            "status": review_item.status,
            "reason": review_item.reason,
        }

    def _selection_request(self, file_id: str, arguments: dict[str, Any]) -> ParserSelectionRequest:
        return ParserSelectionRequest(
            file_id=file_id,
            requested_output_contract=self._dict(arguments, "requested_output_contract"),
            quality_target=QualityTarget(arguments.get("quality_target", QualityTarget.BALANCED)),
            cost_profile=CostProfile(arguments.get("cost_profile", CostProfile.BALANCED)),
            latency_profile=LatencyProfile(
                arguments.get("latency_profile", LatencyProfile.INTERACTIVE)
            ),
            governance_constraints=self._dict(arguments, "governance_constraints"),
        )

    def _load_file_and_profile(self, db: Session, file_id: str) -> tuple[FileRecord, FileProfile]:
        file_record = db.get(FileRecord, file_id)
        if file_record is None:
            raise LookupError(f"File not found: {file_id}")
        file_profile = db.query(FileProfile).filter(FileProfile.file_id == file_id).one_or_none()
        if file_profile is None:
            raise LookupError(f"File profile not found: {file_id}")
        return file_record, file_profile

    def _load_job(self, db: Session, job_id: str) -> ParseJob:
        job = db.get(ParseJob, job_id)
        if job is None:
            raise LookupError(f"Job not found: {job_id}")
        return job

    def _strategy_properties(self) -> dict[str, Any]:
        return {
            "file_id": {"type": "string"},
            "requested_output_contract": {"type": "object"},
            "quality_target": {"type": "string", "enum": ["low", "balanced", "high"]},
            "cost_profile": {"type": "string", "enum": ["low_cost", "balanced", "premium"]},
            "latency_profile": {"type": "string", "enum": ["batch", "interactive", "real_time"]},
            "governance_constraints": {"type": "object"},
        }

    def _job_id_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "required": ["job_id"],
            "properties": {"job_id": {"type": "string"}},
        }

    def _string(self, arguments: dict[str, Any], key: str) -> str:
        value = arguments.get(key)
        if not isinstance(value, str) or not value:
            raise ValueError(f"{key} must be a non-empty string")
        return value

    def _dict(self, arguments: dict[str, Any], key: str) -> dict[str, Any]:
        value = arguments.get(key, {})
        return value if isinstance(value, dict) else {}

    def _job_payload(self, job: ParseJob) -> dict[str, Any]:
        return {
            "job_id": job.id,
            "file_id": job.file_id,
            "status": job.status,
            "parser_id": job.parser_id,
            "skill_id": job.skill_id,
            "quality_status": job.quality_status,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "updated_at": job.updated_at.isoformat() if job.updated_at else None,
        }

    def _quality_payload(self, report: QualityReport) -> dict[str, Any]:
        return {
            "quality_report_id": report.id,
            "job_id": report.job_id,
            "execution_result_id": report.execution_result_id,
            "quality_status": report.quality_status,
            "parser_confidence": report.parser_confidence,
            "human_review_required": report.human_review_required,
            "quality_explanation": report.quality_explanation,
        }

    def _asset_payload(self, asset: ParsedAsset) -> dict[str, Any]:
        return {
            "asset_id": asset.id,
            "file_id": asset.file_id,
            "job_id": asset.job_id,
            "parser_used": asset.parser_used,
            "fallback_used": asset.fallback_used,
            "skill_used": asset.skill_used,
            "parsed_text": asset.parsed_text,
            "quality_report": asset.quality_report,
            "lineage": asset.lineage,
        }

    def _execution_payload(self, result: ParserExecutionResult) -> dict[str, Any]:
        return {
            "execution_result_id": result.id,
            "parser_id": result.parser_id,
            "status": result.status,
            "confidence_score": result.confidence_score,
            "duration_ms": result.duration_ms,
            "error_message": result.error_message,
        }


mcp_server = MCPServer()
