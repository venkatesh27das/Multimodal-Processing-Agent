from dataclasses import dataclass, field
from typing import Any

from google.adk.agents import BaseAgent
from google.adk.tools import FunctionTool
from pydantic import ConfigDict, Field
from sqlalchemy.orm import Session

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
from backend.app.services.orchestration_engine import orchestration_engine


@dataclass(frozen=True)
class AdkParserRunResult:
    job: ParseJob
    plan: ParsingPlan
    quality: QualityReport
    asset: ParsedAsset
    review_item: ReviewItem | None
    events: list[dict[str, object]] = field(default_factory=list)


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

    def run_parser_task(
        self,
        db: Session,
        *,
        file_record: FileRecord,
        file_profile: FileProfile,
        request: ParserSelectionRequest,
    ) -> AdkParserRunResult:
        events = [
            {
                "runtime": "google_adk",
                "agent": self.name,
                "step": "observe",
                "tool": "observe_file_profile_tool",
                "summary": "Observed persisted file profile.",
            },
            {
                "runtime": "google_adk",
                "agent": self.name,
                "step": "plan",
                "tool": "plan_parser_strategy_tool",
                "summary": "Selected parser strategy through existing planner services.",
            },
            {
                "runtime": "google_adk",
                "agent": self.name,
                "step": "act_evaluate_repair_publish",
                "tool": "execute_parser_plan_tool",
                "summary": "Executed parser orchestration and publishing path.",
            },
        ]
        job, plan, quality, asset, review_item = orchestration_engine.run(
            db,
            file_record=file_record,
            file_profile=file_profile,
            request=request,
        )
        events.append(
            {
                "runtime": "google_adk",
                "agent": self.name,
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
            quality=quality,
            asset=asset,
            review_item=review_item,
            events=events,
        )


class MultimodalParserAdkRuntime:
    """ADK-backed runtime adapter used behind the public FastAPI agent API."""

    def __init__(self) -> None:
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
        )

    @property
    def framework_metadata(self) -> dict[str, object]:
        return {
            "framework": "google_adk",
            "agent_class": self.agent.__class__.__name__,
            "agent_name": self.agent.name,
            "tools": [tool.name for tool in self.tools],
            "execution_mode": "deterministic_adk_runtime_adapter",
        }

    def run(
        self,
        db: Session,
        *,
        file_record: FileRecord,
        file_profile: FileProfile,
        request: ParserSelectionRequest,
    ) -> AdkParserRunResult:
        return self.agent.run_parser_task(
            db,
            file_record=file_record,
            file_profile=file_profile,
            request=request,
        )


multimodal_parser_adk_runtime = MultimodalParserAdkRuntime()
