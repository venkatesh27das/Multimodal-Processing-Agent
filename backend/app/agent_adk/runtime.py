from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from google.adk.agents import BaseAgent, SequentialAgent
from google.adk.tools import FunctionTool
from pydantic import ConfigDict, Field
from sqlalchemy.orm import Session

from backend.app.domain.enums import JobStatus, QualityStatus, ReviewStatus
from backend.app.models.domain import (
    FileProfile,
    FileRecord,
    ParsedAsset,
    ParseJob,
    ParserExecutionResult,
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


@dataclass(frozen=True)
class AdkParserRunResult:
    job: ParseJob
    plan: ParsingPlan
    quality: QualityReport
    asset: ParsedAsset
    review_item: ReviewItem | None
    events: list[dict[str, object]] = field(default_factory=list)


class AgentTaskCancelled(RuntimeError):
    """Raised when durable task cancellation is observed by the ADK runtime."""


class ParserPhaseAdkAgent(BaseAgent):
    """Named ADK phase agent used to declare the parser-agent workflow graph."""

    model_config = ConfigDict(arbitrary_types_allowed=True, extra="forbid")

    phase: str

    async def _run_async_impl(self, ctx):  # type: ignore[no-untyped-def]
        yield self._create_agent_state_event(ctx)


def observe_file_profile_tool(
    file_id: str,
    file_type: str,
    modalities: list[str],
) -> dict[str, Any]:
    return {
        "file_id": file_id,
        "file_type": file_type,
        "modalities": modalities,
        "observation": "File profile loaded from deterministic platform storage.",
    }


def plan_parser_strategy_tool(
    file_id: str,
    quality_target: str,
    cost_profile: str,
    latency_profile: str,
) -> dict[str, Any]:
    return {
        "file_id": file_id,
        "quality_target": quality_target,
        "cost_profile": cost_profile,
        "latency_profile": latency_profile,
        "strategy": "Delegate parser selection to the governed parser selector service.",
    }


def execute_parser_plan_tool(file_id: str) -> dict[str, Any]:
    return {
        "file_id": file_id,
        "execution": "Run parser adapters, fallback, quality evaluation, and publishing.",
    }


def evaluate_quality_tool(file_id: str) -> dict[str, Any]:
    return {
        "file_id": file_id,
        "evaluation": "Persist parser confidence, completeness, consistency, and review need.",
    }


def publish_asset_tool(file_id: str) -> dict[str, Any]:
    return {
        "file_id": file_id,
        "publishing": "Publish governed parsed assets with lineage and audit context.",
    }


class DeterministicMultimodalParserAdkAgent(BaseAgent):
    """Google ADK agent shell for the deterministic parser-agent workflow."""

    model_config = ConfigDict(arbitrary_types_allowed=True, extra="forbid")

    tools: list[FunctionTool] = Field(default_factory=list)
    workflow: SequentialAgent

    def run_parser_task(
        self,
        db: Session,
        *,
        file_record: FileRecord,
        file_profile: FileProfile,
        request: ParserSelectionRequest,
        emit_event: Callable[[dict[str, object]], None] | None = None,
        should_cancel: Callable[[], bool] | None = None,
    ) -> AdkParserRunResult:
        events: list[dict[str, object]] = []

        def emit(step: str, tool: str, summary: str, **payload: object) -> None:
            event = {
                "runtime": "google_adk",
                "agent": self.name,
                "workflow": self.workflow.name,
                "step": step,
                "tool": tool,
                "summary": summary,
                **payload,
            }
            events.append(event)
            if emit_event is not None:
                emit_event(event)

        def checkpoint() -> None:
            if should_cancel is not None and should_cancel():
                emit(
                    "cancelled",
                    "durable_task_cancellation",
                    "Cancellation was requested before the next parser-agent phase.",
                )
                raise AgentTaskCancelled("Agent task was cancelled")

        emit(
            "observe",
            "observe_file_profile_tool",
            "Observed persisted file profile.",
            file_id=file_record.id,
            file_type=file_profile.file_type,
            modalities=file_profile.modalities,
        )
        checkpoint()

        emit(
            "plan",
            "plan_parser_strategy_tool",
            "Selecting parser strategy with governed planner services.",
        )
        job, plan, selection = parsing_planner.create_plan(
            db,
            file_record=file_record,
            file_profile=file_profile,
            request=request,
        )
        job.status = JobStatus.RUNNING.value
        db.flush()
        emit(
            "plan.completed",
            "plan_parser_strategy_tool",
            plan.decision_reason,
            job_id=job.id,
            primary_parser_id=selection.primary_parser_id,
            fallback_parser_id=selection.fallback_parser_id,
            selected_skill_id=selection.selected_skill_id,
        )
        checkpoint()

        emit(
            "act",
            "execute_parser_plan_tool",
            f"Executing primary parser {plan.selected_parser_id}.",
            job_id=job.id,
            parser_id=plan.selected_parser_id,
        )
        primary_result = execution_engine.execute_parser(
            db,
            job_id=job.id,
            file_record=file_record,
            parser_id=plan.selected_parser_id,
        )
        checkpoint()

        emit(
            "evaluate",
            "evaluate_quality_tool",
            "Evaluating primary parser output quality.",
            parser_id=primary_result.parser_id,
            confidence_score=primary_result.confidence_score,
        )
        quality_evaluator.evaluate(
            db,
            job_id=job.id,
            execution_result=primary_result,
            threshold=plan.quality_threshold,
        )
        checkpoint()

        results = [primary_result]
        fallback_used = self._maybe_run_fallback(
            db,
            file_record=file_record,
            job=job,
            plan=plan,
            primary_result=primary_result,
            results=results,
            emit=emit,
        )
        checkpoint()

        best_result = fallback_manager.choose_best_result(results)
        emit(
            "evaluate.final",
            "evaluate_quality_tool",
            f"Evaluating selected parser result {best_result.parser_id}.",
            parser_id=best_result.parser_id,
            confidence_score=best_result.confidence_score,
        )
        final_quality = quality_evaluator.evaluate(
            db,
            job_id=job.id,
            execution_result=best_result,
            threshold=plan.quality_threshold,
            final=True,
        )
        checkpoint()

        emit(
            "publish",
            "publish_asset_tool",
            "Publishing governed parsed asset.",
            parser_id=best_result.parser_id,
            quality_status=final_quality.quality_status,
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
        review_item = self._maybe_create_review_item(db, job, file_record, final_quality)
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
        events.append(
            {
                "runtime": "google_adk",
                "agent": self.name,
                "workflow": self.workflow.name,
                "step": "completed",
                "tool": "publish_asset_tool",
                "summary": f"Published asset {asset.id}.",
                "job_id": job.id,
                "asset_id": asset.id,
            }
        )
        return AdkParserRunResult(
            job=job,
            plan=plan,
            quality=final_quality,
            asset=asset,
            review_item=review_item,
            events=events,
        )

    def _maybe_run_fallback(
        self,
        db: Session,
        *,
        file_record: FileRecord,
        job: ParseJob,
        plan: ParsingPlan,
        primary_result: ParserExecutionResult,
        results: list[ParserExecutionResult],
        emit: Callable[..., None],
    ) -> bool:
        if not fallback_manager.should_fallback(
            quality_threshold=plan.quality_threshold,
            result=primary_result,
            fallback_parser_id=plan.fallback_parser_id,
        ):
            emit(
                "repair.skipped",
                "execute_parser_plan_tool",
                "Fallback was not required.",
                parser_id=primary_result.parser_id,
                confidence_score=primary_result.confidence_score,
            )
            return False

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
        emit(
            "repair",
            "execute_parser_plan_tool",
            f"Executing fallback parser {plan.fallback_parser_id}.",
            primary_parser_id=plan.selected_parser_id,
            fallback_parser_id=plan.fallback_parser_id,
        )
        fallback_result = execution_engine.execute_parser(
            db,
            job_id=job.id,
            file_record=file_record,
            parser_id=plan.fallback_parser_id or "",
        )
        results.append(fallback_result)
        return True

    def _maybe_create_review_item(
        self,
        db: Session,
        job: ParseJob,
        file_record: FileRecord,
        final_quality: QualityReport,
    ) -> ReviewItem | None:
        if not final_quality.human_review_required:
            return None

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
        return review_item


class MultimodalParserAdkRuntime:
    """ADK-backed runtime adapter used behind the public FastAPI agent API."""

    def __init__(self) -> None:
        workflow = SequentialAgent(
            name="multimodal_parser_workflow",
            description="Observe, plan, act, evaluate, repair, and publish parser-agent workflow.",
            sub_agents=[
                ParserPhaseAdkAgent(name="observe_phase", phase="observe"),
                ParserPhaseAdkAgent(name="plan_phase", phase="plan"),
                ParserPhaseAdkAgent(name="act_phase", phase="act"),
                ParserPhaseAdkAgent(name="evaluate_phase", phase="evaluate"),
                ParserPhaseAdkAgent(name="repair_phase", phase="repair"),
                ParserPhaseAdkAgent(name="publish_phase", phase="publish"),
            ],
        )
        self.tools = [
            FunctionTool(observe_file_profile_tool),
            FunctionTool(plan_parser_strategy_tool),
            FunctionTool(execute_parser_plan_tool),
            FunctionTool(evaluate_quality_tool),
            FunctionTool(publish_asset_tool),
        ]
        self.agent = DeterministicMultimodalParserAdkAgent(
            name="multimodal_parser_agent",
            description=(
                "Governed multimodal parser agent that transforms files into "
                "structured assets with quality, review, audit, and lineage."
            ),
            tools=self.tools,
            workflow=workflow,
        )

    @property
    def framework_metadata(self) -> dict[str, object]:
        return {
            "framework": "google_adk",
            "agent_class": self.agent.__class__.__name__,
            "agent_name": self.agent.name,
            "workflow_agent": self.agent.workflow.__class__.__name__,
            "workflow_name": self.agent.workflow.name,
            "workflow_phases": [agent.name for agent in self.agent.workflow.sub_agents],
            "tools": [tool.name for tool in self.tools],
            "execution_mode": "background_adk_workflow_adapter",
        }

    def run(
        self,
        db: Session,
        *,
        file_record: FileRecord,
        file_profile: FileProfile,
        request: ParserSelectionRequest,
        emit_event: Callable[[dict[str, object]], None] | None = None,
        should_cancel: Callable[[], bool] | None = None,
    ) -> AdkParserRunResult:
        return self.agent.run_parser_task(
            db,
            file_record=file_record,
            file_profile=file_profile,
            request=request,
            emit_event=emit_event,
            should_cancel=should_cancel,
        )


multimodal_parser_adk_runtime = MultimodalParserAdkRuntime()
