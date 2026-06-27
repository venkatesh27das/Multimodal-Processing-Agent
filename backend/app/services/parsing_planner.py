from sqlalchemy.orm import Session

from backend.app.domain.enums import CostProfile, JobStatus, QualityTarget
from backend.app.models.domain import FileProfile, FileRecord, ParseJob, ParsingPlan
from backend.app.schemas.domain import ParserSelectionRequest, ParserSelectionResponse
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
        governance_report = policy_checker.check(
            file_record=file_record,
            file_profile=file_profile,
            governance_constraints=request.governance_constraints,
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
        )

        job = ParseJob(
            file_id=file_record.id,
            status=JobStatus.PLANNING.value,
            parser_id=selection.primary_parser_id,
            skill_id=selection.selected_skill_id,
        )
        db.add(job)
        db.flush()

        plan = ParsingPlan(
            job_id=job.id,
            file_id=file_record.id,
            selected_parser_id=selection.primary_parser_id,
            fallback_parser_id=selection.fallback_parser_id,
            selected_skill_id=selection.selected_skill_id,
            output_contract=request.requested_output_contract,
            expected_assets=["unified_parsed_asset"],
            quality_threshold=QUALITY_THRESHOLDS[request.quality_target],
            cost_profile={
                "profile": request.cost_profile.value,
                "premium_allowed": request.cost_profile == CostProfile.PREMIUM,
            },
            human_review_policy={
                "create_review_item_below_threshold": True,
                "quality_target": request.quality_target.value,
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
            },
        )
        return job, plan, selection


parsing_planner = ParsingPlanner()
