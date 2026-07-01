from sqlalchemy.orm import Session

from backend.app.domain.enums import JobStatus, QualityStatus, ReviewStatus
from backend.app.models.domain import (
    FileProfile,
    FileRecord,
    ParsedAsset,
    ParseJob,
    ParsingPlan,
    QualityReport,
    ReviewItem,
)
from backend.app.schemas.domain import ParserSelectionRequest
from backend.app.services.asset_publisher import asset_publisher
from backend.app.services.audit_logger import audit_logger
from backend.app.services.execution_engine import execution_engine
from backend.app.services.fallback_manager import fallback_manager
from backend.app.services.parsing_planner import parsing_planner
from backend.app.services.quality_evaluator import quality_evaluator


class OrchestrationEngine:
    def run(
        self,
        db: Session,
        *,
        file_record: FileRecord,
        file_profile: FileProfile,
        request: ParserSelectionRequest,
    ) -> tuple[ParseJob, ParsingPlan, QualityReport, ParsedAsset, ReviewItem | None]:
        job, plan, _ = parsing_planner.create_plan(
            db,
            file_record=file_record,
            file_profile=file_profile,
            request=request,
        )
        job.status = JobStatus.RUNNING.value
        db.flush()

        primary_result = execution_engine.execute_parser(
            db,
            job_id=job.id,
            file_record=file_record,
            parser_id=plan.selected_parser_id,
        )
        quality_evaluator.evaluate(
            db,
            job_id=job.id,
            execution_result=primary_result,
            threshold=plan.quality_threshold,
        )

        results = [primary_result]
        fallback_used = False
        if fallback_manager.should_fallback(
            quality_threshold=plan.quality_threshold,
            result=primary_result,
            fallback_parser_id=plan.fallback_parser_id,
            fallback_policy=str(plan.human_review_policy.get("fallback_policy") or ""),
            max_fallback_attempts=int(plan.human_review_policy.get("max_fallback_attempts", 1)),
        ):
            audit_logger.log(
                db,
                actor="system",
                action="fallback_triggered",
                entity_type="parse_job",
                entity_id=job.id,
                metadata={
                    "primary_parser_id": plan.selected_parser_id,
                    "fallback_parser_id": plan.fallback_parser_id,
                    "confidence_score": primary_result.confidence_score,
                    "quality_threshold": plan.quality_threshold,
                },
            )
            fallback_result = execution_engine.execute_parser(
                db,
                job_id=job.id,
                file_record=file_record,
                parser_id=plan.fallback_parser_id or "",
            )
            results.append(fallback_result)
            fallback_used = True

        best_result = fallback_manager.choose_best_result(results)
        final_quality = quality_evaluator.evaluate(
            db,
            job_id=job.id,
            execution_result=best_result,
            threshold=plan.quality_threshold,
            final=True,
            route_to_review=bool(
                plan.human_review_policy.get("create_review_item_below_threshold", True)
            ),
        )
        asset = asset_publisher.publish(
            db,
            job_id=job.id,
            file_record=file_record,
            execution_result=best_result,
            quality_report=final_quality,
            plan=plan,
            fallback_used=fallback_used and best_result.id != primary_result.id,
        )

        review_item = None
        if final_quality.human_review_required:
            review_item = ReviewItem(
                job_id=job.id,
                file_id=file_record.id,
                quality_report_id=final_quality.id,
                status=ReviewStatus.OPEN.value,
                reason=final_quality.quality_explanation,
            )
            db.add(review_item)
            db.flush()
            audit_logger.log(
                db,
                actor="system",
                action="review_item_created",
                entity_type="review_item",
                entity_id=review_item.id,
                metadata={"job_id": job.id, "quality_report_id": final_quality.id},
            )

        job.parser_id = best_result.parser_id
        job.quality_status = final_quality.quality_status
        job.status = (
            JobStatus.REVIEW_REQUIRED.value
            if final_quality.quality_status == QualityStatus.REVIEW_REQUIRED.value
            else JobStatus.COMPLETE.value
        )
        audit_logger.log(
            db,
            actor="system",
            action="job_completed",
            entity_type="parse_job",
            entity_id=job.id,
            metadata={
                "status": job.status,
                "quality_status": job.quality_status,
                "selected_result_id": best_result.id,
                "asset_id": asset.id,
            },
        )
        db.commit()
        db.refresh(job)
        db.refresh(plan)
        db.refresh(final_quality)
        db.refresh(asset)
        if review_item is not None:
            db.refresh(review_item)
        return job, plan, final_quality, asset, review_item


orchestration_engine = OrchestrationEngine()
