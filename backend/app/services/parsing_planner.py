from sqlalchemy.orm import Session

from backend.app.domain.enums import CostProfile, JobStatus, QualityTarget
from backend.app.models.domain import FileProfile, FileRecord, ParseJob, ParsingPlan
from backend.app.schemas.domain import ParserSelectionRequest, ParserSelectionResponse
from backend.app.services.agent_instruction_interpreter import agent_instruction_interpreter
from backend.app.services.audit_logger import audit_logger
from backend.app.services.governance import policy_checker
from backend.app.services.parser_selector import parser_selector

QUALITY_THRESHOLDS: dict[QualityTarget, float] = {
    QualityTarget.LOW: 0.4,
    QualityTarget.BALANCED: 0.65,
    QualityTarget.HIGH: 0.8,
}


class ParsingPlanner:
    def create_plan(
        self,
        db: Session,
        *,
        file_record: FileRecord,
        file_profile: FileProfile,
        request: ParserSelectionRequest,
    ) -> tuple[ParseJob, ParsingPlan, ParserSelectionResponse]:
        request = self._enrich_request(request)
        governance_report = policy_checker.check(
            file_record=file_record,
            file_profile=file_profile,
            governance_constraints=request.governance_constraints,
            agent_interpretation=self._agent_interpretation(request),
        )
        if not governance_report.allowed:
            audit_logger.log(
                db,
                actor="system",
                action="governance_policy_blocked",
                entity_type="file_record",
                entity_id=file_record.id,
                metadata=governance_report.to_dict(),
            )
            db.flush()
            raise ValueError("Governance policy blocked parsing for this document")

        selection = parser_selector.plan(
            db,
            file_profile=file_profile,
            requested_output_contract=request.requested_output_contract,
            quality_target=request.quality_target,
            cost_profile=request.cost_profile,
            latency_profile=request.latency_profile,
            governance_constraints=request.governance_constraints,
            agent_interpretation=self._agent_interpretation(request),
        )

        job = ParseJob(
            file_id=file_record.id,
            status=JobStatus.PLANNING.value,
            parser_id=selection.primary_parser_id,
            skill_id=selection.selected_skill_id,
        )
        db.add(job)
        db.flush()

        quality_threshold = self._quality_threshold(request)
        plan = ParsingPlan(
            job_id=job.id,
            file_id=file_record.id,
            selected_parser_id=selection.primary_parser_id,
            fallback_parser_id=selection.fallback_parser_id,
            selected_skill_id=selection.selected_skill_id,
            output_contract=request.requested_output_contract,
            expected_assets=["unified_parsed_asset"],
            quality_threshold=quality_threshold,
            cost_profile={
                "profile": request.cost_profile.value,
                "premium_allowed": request.cost_profile == CostProfile.PREMIUM,
                "processing_priority": request.governance_constraints.get(
                    "processing_priority",
                    "normal",
                ),
                "max_processing_time_per_file_minutes": request.governance_constraints.get(
                    "max_processing_time_per_file_minutes",
                    15,
                ),
                "parallel_processing": request.governance_constraints.get(
                    "parallel_processing",
                    True,
                ),
                "max_parallel_files": request.governance_constraints.get("max_parallel_files", 5),
                "concurrency_limit": request.governance_constraints.get(
                    "concurrency_limit",
                    "auto",
                ),
                "retry_failed_files": request.governance_constraints.get(
                    "retry_failed_files",
                    True,
                ),
                "retry_attempts": request.governance_constraints.get("retry_attempts", 2),
            },
            human_review_policy={
                "create_review_item_below_threshold": request.governance_constraints.get(
                    "route_below_threshold_to_review",
                    True,
                ),
                "auto_approve_above_threshold": request.governance_constraints.get(
                    "auto_approve_above_threshold",
                    False,
                ),
                "human_review_queue": request.governance_constraints.get(
                    "human_review_queue",
                    "default",
                ),
                "fallback_policy": request.governance_constraints.get(
                    "fallback_policy",
                    "recommended",
                ),
                "max_fallback_attempts": request.governance_constraints.get(
                    "max_fallback_attempts",
                    1,
                ),
                "quality_target": request.quality_target.value,
                "quality_threshold": quality_threshold,
                "governance": governance_report.to_dict(),
            },
            decision_reason=selection.decision_explanation,
        )
        db.add(plan)
        audit_logger.log(
            db,
            actor="system",
            action="governance_policy_checked",
            entity_type="parse_job",
            entity_id=job.id,
            metadata=governance_report.to_dict(),
        )
        audit_logger.log(
            db,
            actor="system",
            action="plan_created",
            entity_type="parse_job",
            entity_id=job.id,
            metadata={
                "primary_parser_id": selection.primary_parser_id,
                "fallback_parser_id": selection.fallback_parser_id,
                "decision_score": selection.decision_score,
                "agent_interpretation": selection.agent_interpretation,
            },
        )
        return job, plan, selection

    def _enrich_request(self, request: ParserSelectionRequest) -> ParserSelectionRequest:
        contract, governance, interpretation = agent_instruction_interpreter.enrich(
            requested_output_contract=request.requested_output_contract,
            governance_constraints=request.governance_constraints,
            agent_instruction=request.agent_instruction,
        )
        if interpretation is None:
            return request
        return request.model_copy(
            update={
                "agent_instruction": interpretation.instruction,
                "requested_output_contract": contract,
                "governance_constraints": governance,
            },
        )

    def _agent_interpretation(self, request: ParserSelectionRequest) -> dict[str, object]:
        interpretation = request.requested_output_contract.get("agent_instruction_interpretation")
        return interpretation if isinstance(interpretation, dict) else {}

    def _quality_threshold(self, request: ParserSelectionRequest) -> float:
        value = request.requested_output_contract.get("quality_threshold")
        if isinstance(value, int | float):
            return min(1.0, max(0.0, float(value)))
        return QUALITY_THRESHOLDS[request.quality_target]


parsing_planner = ParsingPlanner()
