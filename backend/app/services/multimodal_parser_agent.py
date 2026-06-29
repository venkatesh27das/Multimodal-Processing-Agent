import json
from datetime import UTC, datetime
from hashlib import sha256
from html import escape
from uuid import uuid4

from sqlalchemy.orm import Session

from backend.app.agent_adk import multimodal_parser_adk_runtime
from backend.app.core.config import settings
from backend.app.domain.enums import (
    AgentArtifactKind,
    AgentMessageRole,
    AgentStepKind,
    AgentTaskStatus,
    CostProfile,
    FileType,
    JobStatus,
    LatencyProfile,
    QualityStatus,
    QualityTarget,
)
from backend.app.models.domain import (
    AgentArtifact,
    AgentDecision,
    AgentLineage,
    AgentMessage,
    AgentPlan,
    AgentQualityJudgement,
    AgentSkillInvocation,
    AgentStep,
    AgentSubtask,
    AgentTask,
    AgentToolCall,
    AuditEvent,
    FileProfile,
    FileRecord,
    ParsedAsset,
    ParserExecutionResult,
    ParsingPlan,
    QualityReport,
    ReviewItem,
    SkillDefinition,
)
from backend.app.schemas.agent import AgentCard, AgentEndpointMap, AgentTaskCreate, AgentTaskDetail
from backend.app.schemas.domain import ParserSelectionRequest
from backend.app.services.file_profiling import file_profiler


class MultimodalParserAgent:
    def agent_card(self, db: Session) -> AgentCard:
        skills = [
            skill.skill_id
            for skill in db.query(SkillDefinition)
            .filter(SkillDefinition.enabled.is_(True))
            .order_by(SkillDefinition.skill_id.asc())
            .all()
        ]
        return AgentCard(
            name="multimodal-parser-agent",
            display_name="Multimodal Parser Agent",
            description=(
                "Governed multimodal file parsing, extraction, validation, fallback, "
                "review, and asset publishing."
            ),
            version=settings.app_version,
            provider={"name": "local", "environment": settings.environment},
            capabilities=[
                "google_adk_runtime",
                "file_profiling",
                "parser_selection",
                "parsing",
                "ocr",
                "vlm_fallback",
                "skill_invocation",
                "quality_evaluation",
                "review_routing",
                "asset_publishing",
            ],
            supported_modalities=["pdf", "docx", "html", "image", "audio", "video"],
            input_modes=["uploaded_file", "file_id", "asset_id", "url_placeholder", "text_payload"],
            output_modes=[
                "parsed_text",
                "tables",
                "entities",
                "relationships",
                "chunks",
                "metadata",
                "transcript",
                "embeddings_placeholder",
                "review_request",
                "lineage",
            ],
            skills=skills,
            tools=[
                "google_adk_function_tools",
                "local_parser_registry",
                "ocr",
                "vlm_parsing",
                "schema_validation",
                "table_normalization",
                "policy_checks",
            ],
            streaming={
                "supported": True,
                "transport": "pollable_events_and_sse",
                "execution": "in_process_background_task",
            },
            auth={
                "mode": "local",
                "future_modes": ["api_key", "oauth2", "tenant_policy"],
                "runtime": multimodal_parser_adk_runtime.framework_metadata,
            },
            endpoints=AgentEndpointMap(
                create_task="/api/v1/agent/tasks",
                create_task_from_upload="/api/v1/agent/tasks/upload",
                get_task="/api/v1/agent/tasks/{task_id}",
                list_tasks="/api/v1/agent/tasks",
                cancel_task="/api/v1/agent/tasks/{task_id}/cancel",
                messages="/api/v1/agent/tasks/{task_id}/messages",
                artifacts="/api/v1/agent/tasks/{task_id}/artifacts",
                events="/api/v1/agent/tasks/{task_id}/events",
                event_stream="/api/v1/agent/tasks/{task_id}/events/stream",
            ),
        )

    def create_task(self, db: Session, payload: AgentTaskCreate) -> AgentTask:
        file_records = self._materialize_input_files(db, payload)
        if not file_records:
            raise ValueError(
                "Agent task requires file_id, file_ids, text_payload, asset_id, or url."
            )

        file_id = file_records[0].id
        input_payload = {
            **payload.model_dump(mode="json"),
            "materialized_file_ids": [file_record.id for file_record in file_records],
            "input_count": len(file_records),
        }

        task = AgentTask(
            status=AgentTaskStatus.SUBMITTED.value,
            title=payload.title or self._task_title(file_records),
            summary="Parser-agent task submitted.",
            file_id=file_id,
            requested_output_contract=payload.requested_output_contract,
            governance_constraints=payload.governance_constraints,
            quality_target=payload.quality_target.value,
            cost_profile=payload.cost_profile.value,
            latency_profile=payload.latency_profile.value,
            input_payload=input_payload,
        )
        db.add(task)
        db.flush()

        self._message(
            db,
            task.id,
            1,
            AgentMessageRole.USER.value,
            "Task request",
            "Transform the supplied input into trusted structured assets.",
            input_payload,
        )
        self._message(
            db,
            task.id,
            2,
            AgentMessageRole.AGENT.value,
            "Task accepted",
            "The Multimodal Parser Agent accepted the request and started the agent loop.",
            {"lifecycle": "observe_plan_act_evaluate_repair_publish"},
        )
        task.status = AgentTaskStatus.ACCEPTED.value
        task.summary = "Parser-agent task accepted and queued for background execution."
        db.commit()
        db.refresh(task)
        return task

    def execute_task(self, db: Session, task_id: str) -> AgentTask:
        task = db.get(AgentTask, task_id)
        if task is None:
            raise LookupError("Agent task not found")
        if task.status == AgentTaskStatus.CANCELLED.value:
            return task
        file_ids = self._task_file_ids(task)
        if not file_ids:
            raise ValueError("Agent task has no materialized input files")

        try:
            self._record_runtime_event(
                db,
                task,
                {
                    "step": "accepted",
                    "summary": "Background ADK worker started this parser-agent task.",
                    "tool": "background_worker",
                    "file_ids": file_ids,
                },
            )
            job_ids: list[str] = []
            asset_ids: list[str] = []
            review_required = False
            for index, file_id in enumerate(file_ids, start=1):
                if self._is_cancelled(db, task):
                    raise RuntimeError("Agent task was cancelled")
                file_record, file_profile = self._load_profiled_file(db, file_id)
                file_sequence = index
                current_file_id = file_id

                def make_emit_file_event(
                    bound_file_sequence: int,
                    bound_file_id: str,
                ):
                    def emit_file_event(event: dict[str, object]) -> None:
                        self._record_runtime_event(
                            db,
                            task,
                            {
                                **event,
                                "file_sequence": bound_file_sequence,
                                "file_id": bound_file_id,
                                "input_count": len(file_ids),
                            },
                        )

                    return emit_file_event

                request = ParserSelectionRequest(
                    file_id=file_id,
                    requested_output_contract=task.requested_output_contract,
                    quality_target=QualityTarget(task.quality_target),
                    cost_profile=CostProfile(task.cost_profile),
                    latency_profile=LatencyProfile(task.latency_profile),
                    governance_constraints=task.governance_constraints,
                )
                run_result = multimodal_parser_adk_runtime.run(
                    db,
                    file_record=file_record,
                    file_profile=file_profile,
                    request=request,
                    emit_event=make_emit_file_event(file_sequence, current_file_id),
                    should_cancel=lambda: self._is_cancelled(db, task),
                )
                job = run_result.job
                plan = run_result.plan
                quality = run_result.quality
                asset = run_result.asset
                review_item = run_result.review_item
                self._persist_trace(
                    db,
                    task=task,
                    file_record=file_record,
                    file_profile=file_profile,
                    job_id=job.id,
                    plan=plan,
                    quality=quality,
                    asset=asset,
                    review_item=review_item,
                    adk_events=run_result.events,
                    file_sequence=index,
                )
                job_ids.append(job.id)
                asset_ids.append(asset.id)
                review_required = review_required or job.status == JobStatus.REVIEW_REQUIRED.value

            task.job_id = job_ids[0] if job_ids else None
            task.status = (
                AgentTaskStatus.AWAITING_REVIEW.value
                if review_required
                else AgentTaskStatus.COMPLETED.value
            )
            task.input_payload = {
                **task.input_payload,
                "processed_file_ids": file_ids,
                "job_ids": job_ids,
                "asset_ids": asset_ids,
            }
            task.summary = self._multi_task_summary(asset_ids, review_required)
            db.commit()
        except RuntimeError as exc:
            if "cancelled" not in str(exc).lower():
                raise
            task.status = AgentTaskStatus.CANCELLED.value
            task.summary = "Parser-agent task was cancelled during background execution."
            self._message(
                db,
                task.id,
                self._next_message_sequence(db, task.id),
                AgentMessageRole.AGENT.value,
                "Task cancelled",
                "The background ADK worker observed cancellation and stopped execution.",
                {"error_type": exc.__class__.__name__},
            )
            db.commit()
        except Exception as exc:
            task.status = AgentTaskStatus.FAILED.value
            task.error_code = exc.__class__.__name__
            task.error_message = str(exc)
            task.summary = "Parser-agent task failed before publishing an asset."
            self._step(
                db,
                task.id,
                AgentStepKind.ACT.value,
                99,
                "failed",
                "Task failed",
                str(exc),
                {"error_type": exc.__class__.__name__},
                error_message=str(exc),
            )
            self._message(
                db,
                task.id,
                99,
                AgentMessageRole.AGENT.value,
                "Task failed",
                str(exc),
                {"error_type": exc.__class__.__name__},
            )
            db.commit()

        db.refresh(task)
        return task

    def _record_runtime_event(
        self,
        db: Session,
        task: AgentTask,
        event: dict[str, object],
    ) -> None:
        step = str(event.get("step", "executing"))
        task.status = self._status_for_runtime_step(step)
        task.summary = str(event.get("summary", "Agent task is running."))
        self._message(
            db,
            task.id,
            self._next_message_sequence(db, task.id),
            AgentMessageRole.AGENT.value,
            f"ADK {step}",
            task.summary,
            event,
        )
        db.commit()
        db.refresh(task)

    def _status_for_runtime_step(self, step: str) -> str:
        if step.startswith("observe"):
            return AgentTaskStatus.OBSERVING.value
        if step.startswith("plan"):
            return AgentTaskStatus.PLANNING.value
        if step.startswith("act"):
            return AgentTaskStatus.EXECUTING.value
        if step.startswith("evaluate"):
            return AgentTaskStatus.EVALUATING.value
        if step.startswith("repair"):
            return AgentTaskStatus.REPAIRING.value
        if step.startswith("publish"):
            return AgentTaskStatus.PUBLISHING.value
        if step.startswith("cancel"):
            return AgentTaskStatus.CANCELLED.value
        return AgentTaskStatus.EXECUTING.value

    def _is_cancelled(self, db: Session, task: AgentTask) -> bool:
        db.refresh(task)
        return task.status == AgentTaskStatus.CANCELLED.value

    def cancel_task(self, db: Session, task: AgentTask) -> AgentTask:
        if task.status in {
            AgentTaskStatus.COMPLETED.value,
            AgentTaskStatus.FAILED.value,
            AgentTaskStatus.CANCELLED.value,
            AgentTaskStatus.AWAITING_REVIEW.value,
        }:
            return task
        task.status = AgentTaskStatus.CANCELLED.value
        task.summary = "Parser-agent task was cancelled before completion."
        self._message(
            db,
            task.id,
            self._next_message_sequence(db, task.id),
            AgentMessageRole.AGENT.value,
            "Task cancelled",
            "Cancellation was recorded for the task.",
            {},
        )
        db.commit()
        db.refresh(task)
        return task

    def detail(self, db: Session, task: AgentTask) -> AgentTaskDetail:
        return AgentTaskDetail.model_validate(
            {
                **task.__dict__,
                "messages": self._messages(db, task.id),
                "artifacts": self._artifacts(db, task.id),
                "plan": db.query(AgentPlan)
                .filter(AgentPlan.task_id == task.id)
                .order_by(AgentPlan.created_at.asc())
                .first(),
                "steps": self._steps(db, task.id),
                "decisions": self._decisions(db, task.id),
                "tool_calls": self._tool_calls(db, task.id),
                "skill_invocations": self._skill_invocations(db, task.id),
                "subtasks": self._subtasks(db, task.id),
                "quality_judgement": db.query(AgentQualityJudgement)
                .filter(AgentQualityJudgement.task_id == task.id)
                .order_by(AgentQualityJudgement.created_at.asc())
                .first(),
                "lineage": db.query(AgentLineage)
                .filter(AgentLineage.task_id == task.id)
                .order_by(AgentLineage.created_at.asc())
                .first(),
            }
        )

    def _materialize_input_files(
        self,
        db: Session,
        payload: AgentTaskCreate,
    ) -> list[FileRecord]:
        file_records: list[FileRecord] = []
        seen_file_ids: set[str] = set()
        for file_id in [payload.file_id, *payload.file_ids]:
            if not file_id or file_id in seen_file_ids:
                continue
            file_record, _ = self._load_profiled_file(db, file_id)
            file_records.append(file_record)
            seen_file_ids.add(file_id)

        if payload.asset_id:
            file_records.append(self._materialize_asset_reference(db, payload.asset_id))
        if payload.url:
            file_records.append(self._materialize_url_placeholder(db, payload.url))
        if payload.text_payload:
            file_records.append(self._materialize_text_payload(db, payload.text_payload))
        return file_records

    def _load_profiled_file(self, db: Session, file_id: str) -> tuple[FileRecord, FileProfile]:
        file_record = db.get(FileRecord, file_id)
        if file_record is None:
            raise LookupError("File not found")
        file_profile = db.query(FileProfile).filter(FileProfile.file_id == file_id).one_or_none()
        if file_profile is None:
            raise LookupError("File profile not found")
        return file_record, file_profile

    def _materialize_text_payload(self, db: Session, text_payload: str) -> FileRecord:
        html = self._html_document(
            "Text payload",
            f"<pre>{escape(text_payload)}</pre>",
            {"input_mode": "text_payload"},
        )
        return self._create_synthetic_html_file(
            db,
            original_filename="agent-text-payload.html",
            source="agent-text",
            html=html,
        )

    def _materialize_url_placeholder(self, db: Session, url: str) -> FileRecord:
        html = self._html_document(
            "URL placeholder",
            (
                f"<p>Referenced URL: <a href=\"{escape(url)}\">{escape(url)}</a></p>"
                "<p>This local runtime records URL intent without fetching remote content.</p>"
            ),
            {"input_mode": "url_placeholder", "url": url},
        )
        return self._create_synthetic_html_file(
            db,
            original_filename="agent-url-placeholder.html",
            source="agent-url",
            html=html,
        )

    def _materialize_asset_reference(self, db: Session, asset_id: str) -> FileRecord:
        asset = db.get(ParsedAsset, asset_id)
        if asset is None:
            raise LookupError("Asset not found")
        text = asset.parsed_text or json.dumps(asset.structured_data, indent=2, sort_keys=True)
        html = self._html_document(
            "Parsed asset reference",
            (
                f"<p>Referenced parsed asset: {escape(asset.id)}</p>"
                f"<pre>{escape(text or '')}</pre>"
            ),
            {"input_mode": "asset_id", "asset_id": asset.id, "source_file_id": asset.file_id},
        )
        return self._create_synthetic_html_file(
            db,
            original_filename=f"asset-{asset.id}.html",
            source="agent-asset",
            html=html,
        )

    def _create_synthetic_html_file(
        self,
        db: Session,
        *,
        original_filename: str,
        source: str,
        html: str,
    ) -> FileRecord:
        settings.storage_dir.mkdir(parents=True, exist_ok=True)
        content = html.encode("utf-8")
        storage_path = settings.storage_dir / f"{uuid4()}.html"
        storage_path.write_bytes(content)
        file_record = FileRecord(
            original_filename=original_filename,
            file_type=FileType.HTML.value,
            mime_type="text/html",
            size_bytes=len(content),
            checksum_sha256=sha256(content).hexdigest(),
            source=source,
            storage_path=str(storage_path),
            status=JobStatus.REGISTERED.value,
            created_by="agent",
        )
        db.add(file_record)
        db.flush()
        db.add(file_profiler.profile(file_record))
        db.flush()
        return file_record

    def _html_document(
        self,
        title: str,
        body: str,
        metadata: dict[str, object],
    ) -> str:
        return (
            "<!doctype html><html><head>"
            f"<meta charset=\"utf-8\"><title>{escape(title)}</title>"
            f"<script type=\"application/json\" id=\"agent-input-metadata\">"
            f"{escape(json.dumps(metadata, sort_keys=True))}</script>"
            "</head><body>"
            f"<h1>{escape(title)}</h1>{body}"
            "</body></html>"
        )

    def _task_file_ids(self, task: AgentTask) -> list[str]:
        materialized = task.input_payload.get("materialized_file_ids", [])
        if isinstance(materialized, list):
            return [str(file_id) for file_id in materialized if file_id]
        return [task.file_id] if task.file_id else []

    def _task_title(self, file_records: list[FileRecord]) -> str:
        if len(file_records) == 1:
            return f"Parse {file_records[0].original_filename}"
        return f"Parse {len(file_records)} inputs"

    def _persist_trace(
        self,
        db: Session,
        *,
        task: AgentTask,
        file_record: FileRecord,
        file_profile: FileProfile,
        job_id: str,
        plan: ParsingPlan,
        quality: QualityReport,
        asset: ParsedAsset,
        review_item: ReviewItem | None,
        adk_events: list[dict[str, object]] | None = None,
        file_sequence: int = 1,
    ) -> None:
        sequence_base = (file_sequence - 1) * 100
        executions = (
            db.query(ParserExecutionResult)
            .filter(ParserExecutionResult.job_id == job_id)
            .order_by(ParserExecutionResult.created_at.asc())
            .all()
        )
        fallback_used = len(executions) > 1 or bool(asset.fallback_used)

        self._subtask(
            db,
            task.id,
            sequence_base + 1,
            "FileProfilerAgent",
            "File profile observed",
            (
                f"Detected {file_profile.file_type} with modalities "
                f"{', '.join(file_profile.modalities)}."
            ),
            self._file_profile_payload(file_record, file_profile),
        )
        self._subtask(
            db,
            task.id,
            sequence_base + 2,
            "ParserStrategyAgent",
            "Parser strategy selected",
            plan.decision_reason,
            self._plan_payload(plan),
        )

        self._step(
            db,
            task.id,
            AgentStepKind.OBSERVE.value,
            sequence_base + 1,
            "completed",
            "Observe",
            "Profiled file signals, modalities, layout risk, and parsing constraints.",
            self._file_profile_payload(file_record, file_profile),
        )
        self._step(
            db,
            task.id,
            AgentStepKind.PLAN.value,
            sequence_base + 2,
            "completed",
            "Plan",
            plan.decision_reason,
            self._plan_payload(plan),
        )
        self._step(
            db,
            task.id,
            AgentStepKind.ACT.value,
            sequence_base + 3,
            "completed",
            "Act",
            f"Executed {len(executions)} parser adapter(s).",
            {"parser_execution_result_ids": [execution.id for execution in executions]},
        )
        self._step(
            db,
            task.id,
            AgentStepKind.EVALUATE.value,
            sequence_base + 4,
            "completed",
            "Evaluate",
            quality.quality_explanation,
            self._quality_payload(quality),
        )
        self._step(
            db,
            task.id,
            AgentStepKind.REPAIR.value,
            sequence_base + 5,
            "completed" if fallback_used else "skipped",
            "Repair",
            "Fallback parser was used." if fallback_used else "No fallback was required.",
            {"fallback_used": fallback_used, "fallback_parser_id": plan.fallback_parser_id},
        )
        self._step(
            db,
            task.id,
            AgentStepKind.PUBLISH.value,
            sequence_base + 6,
            "completed",
            "Publish",
            f"Published parsed asset {asset.id}.",
            self._asset_payload(asset),
        )

        self._agent_plan(db, task.id, job_id, plan)
        self._decision(db, task.id, plan, executions)
        self._quality_judgement(db, task.id, plan, quality)
        self._lineage(db, task.id, file_record.id, job_id, asset)
        self._parser_tool_calls(db, task.id, executions)
        self._skill_invocation(db, task.id, plan, asset)
        self._subtask(
            db,
            task.id,
            sequence_base + 3,
            "QualityAgent",
            "Quality judged",
            quality.quality_explanation,
            self._quality_payload(quality),
        )
        self._subtask(
            db,
            task.id,
            sequence_base + 4,
            "PublisherAgent",
            "Asset published",
            f"Created governed parsed asset {asset.id}.",
            self._asset_payload(asset),
        )

        self._artifact(
            db,
            task.id,
            AgentArtifactKind.FILE_PROFILE.value,
            sequence_base + 1,
            "File profile",
            "Observed file signals used by the agent planner.",
            self._file_profile_payload(file_record, file_profile),
        )
        self._artifact(
            db,
            task.id,
            AgentArtifactKind.PARSING_PLAN.value,
            sequence_base + 2,
            "Parsing plan",
            plan.decision_reason,
            self._plan_payload(plan),
        )
        for offset, execution in enumerate(executions, start=sequence_base + 3):
            self._artifact(
                db,
                task.id,
                AgentArtifactKind.PARSER_OUTPUT.value,
                offset,
                f"Parser output: {execution.parser_id}",
                execution.error_message or "Parser adapter completed.",
                self._execution_payload(execution),
            )
        self._artifact(
            db,
            task.id,
            AgentArtifactKind.QUALITY_REPORT.value,
            sequence_base + 10,
            "Quality report",
            quality.quality_explanation,
            self._quality_payload(quality),
        )
        if fallback_used:
            self._artifact(
                db,
                task.id,
                AgentArtifactKind.FALLBACK_REPORT.value,
                sequence_base + 11,
                "Fallback report",
                "Fallback or repair path was used during parsing.",
                {"fallback_parser_id": plan.fallback_parser_id, "executions": len(executions)},
            )
        self._skill_artifact(db, task.id, asset, sequence=sequence_base + 12)
        if review_item is not None:
            self._artifact(
                db,
                task.id,
                AgentArtifactKind.REVIEW_REQUEST.value,
                sequence_base + 13,
                "Review request",
                review_item.reason,
                {
                    "review_item_id": review_item.id,
                    "status": review_item.status,
                    "quality_report_id": review_item.quality_report_id,
                },
            )
        self._artifact(
            db,
            task.id,
            AgentArtifactKind.PARSED_ASSET.value,
            sequence_base + 14,
            "Parsed asset",
            f"Published governed parsed asset {asset.id}.",
            self._asset_payload(asset),
        )
        self._artifact(
            db,
            task.id,
            AgentArtifactKind.LINEAGE_REPORT.value,
            sequence_base + 15,
            "Lineage report",
            "Source file, parser, fallback, skill, quality, and asset lineage.",
            asset.lineage,
        )
        self._artifact(
            db,
            task.id,
            AgentArtifactKind.AGENT_REASONING.value,
            sequence_base + 16,
            "Agent reasoning",
            (
                "Explainable summary of observed signals, parser choice, quality, "
                "and publish decision."
            ),
            {
                "observed_file_signals": self._file_profile_payload(file_record, file_profile),
                "file_sequence": file_sequence,
                "agent_framework": multimodal_parser_adk_runtime.framework_metadata,
                "adk_events": adk_events or [],
                "selected_parser": plan.selected_parser_id,
                "fallback_parser": plan.fallback_parser_id,
                "selected_skill": plan.selected_skill_id,
                "decision_reason": plan.decision_reason,
                "quality": self._quality_payload(quality),
                "publish_decision": "awaiting_review"
                if quality.human_review_required
                else "published",
            },
        )
        self._audit_artifact(db, task.id, job_id, sequence=sequence_base + 17)
        self._adk_runtime_artifact(db, task.id, adk_events or [], sequence=sequence_base + 18)

        self._message(
            db,
            task.id,
            sequence_base + 3,
            AgentMessageRole.AGENT.value,
            "Task completed" if review_item is None else "Review requested",
            "Published parsed asset and recorded the full agent trace."
            if review_item is None
            else "Published parsed asset and routed uncertain output to review.",
            {"asset_id": asset.id, "review_item_id": review_item.id if review_item else None},
        )

    def _adk_runtime_artifact(
        self,
        db: Session,
        task_id: str,
        adk_events: list[dict[str, object]],
        *,
        sequence: int,
    ) -> None:
        self._artifact(
            db,
            task_id,
            AgentArtifactKind.AGENT_REASONING.value,
            sequence,
            "Google ADK runtime trace",
            "ADK agent metadata and tool-level runtime events for this parser task.",
            {
                "framework": multimodal_parser_adk_runtime.framework_metadata,
                "events": adk_events,
            },
        )

    def _agent_plan(self, db: Session, task_id: str, job_id: str, plan: ParsingPlan) -> None:
        db.add(
            AgentPlan(
                task_id=task_id,
                job_id=job_id,
                status="completed",
                title="Parser-agent plan",
                summary=plan.decision_reason,
                selected_parser_id=plan.selected_parser_id,
                fallback_parser_id=plan.fallback_parser_id,
                selected_skill_id=plan.selected_skill_id,
                quality_threshold=plan.quality_threshold,
                payload=self._plan_payload(plan),
            )
        )

    def _decision(
        self,
        db: Session,
        task_id: str,
        plan: ParsingPlan,
        executions: list[ParserExecutionResult],
    ) -> None:
        db.add(
            AgentDecision(
                task_id=task_id,
                decision_type="parser_strategy",
                sequence=1,
                title="Parser strategy decision",
                summary=plan.decision_reason,
                selected_option=plan.selected_parser_id,
                alternatives=[
                    {"parser_id": plan.fallback_parser_id, "role": "fallback"}
                    for _ in [plan.fallback_parser_id]
                    if plan.fallback_parser_id
                ],
                score_breakdown={
                    "quality_threshold": plan.quality_threshold,
                    "execution_confidences": [
                        {
                            "parser_id": execution.parser_id,
                            "confidence": execution.confidence_score,
                        }
                        for execution in executions
                    ],
                },
                payload=self._plan_payload(plan),
            )
        )

    def _quality_judgement(
        self,
        db: Session,
        task_id: str,
        plan: ParsingPlan,
        quality: QualityReport,
    ) -> None:
        db.add(
            AgentQualityJudgement(
                task_id=task_id,
                quality_report_id=quality.id,
                status=quality.quality_status,
                summary=quality.quality_explanation,
                dimensions={
                    "parser_confidence": quality.parser_confidence,
                    "extraction_confidence": quality.extraction_confidence,
                    "schema_validation_score": quality.schema_validation_score,
                    "completeness_score": quality.completeness_score,
                    "consistency_score": quality.consistency_score,
                },
                thresholds={"quality_threshold": plan.quality_threshold},
                review_rationale=quality.quality_explanation
                if quality.human_review_required
                else None,
                payload=self._quality_payload(quality),
            )
        )

    def _lineage(
        self,
        db: Session,
        task_id: str,
        file_id: str,
        job_id: str,
        asset: ParsedAsset,
    ) -> None:
        db.add(
            AgentLineage(
                task_id=task_id,
                source_file_id=file_id,
                job_id=job_id,
                asset_id=asset.id,
                summary=(
                    "Agent lineage connects the source file, parse job, asset, "
                    "and audit trace."
                ),
                payload=asset.lineage,
            )
        )

    def _parser_tool_calls(
        self,
        db: Session,
        task_id: str,
        executions: list[ParserExecutionResult],
    ) -> None:
        for index, execution in enumerate(executions, start=1):
            db.add(
                AgentToolCall(
                    task_id=task_id,
                    tool_id=f"parser:{execution.parser_id}",
                    status=execution.status,
                    sequence=index,
                    input_summary=f"Run parser adapter {execution.parser_id}.",
                    output_summary=execution.error_message
                    or f"Confidence {execution.confidence_score}.",
                    request_payload={"parser_id": execution.parser_id, "job_id": execution.job_id},
                    response_payload=self._execution_payload(execution),
                    duration_ms=execution.duration_ms,
                    error_message=execution.error_message,
                )
            )

    def _skill_invocation(
        self,
        db: Session,
        task_id: str,
        plan: ParsingPlan,
        asset: ParsedAsset,
    ) -> None:
        skill_output = self._skill_output(asset)
        if plan.selected_skill_id is None and skill_output is None:
            return
        db.add(
            AgentSkillInvocation(
                task_id=task_id,
                skill_id=plan.selected_skill_id or str(skill_output.get("skill_id")),
                status="completed" if skill_output and skill_output.get("valid") else "skipped",
                sequence=1,
                input_summary="Skill selected by parser strategy."
                if plan.selected_skill_id
                else "No planner-selected skill.",
                output_summary="Skill output validated."
                if skill_output and skill_output.get("valid")
                else "Skill validation did not pass or no skill output was produced.",
                validation_result={
                    "valid": skill_output.get("valid") if skill_output else False,
                    "validation_errors": skill_output.get("validation_errors")
                    if skill_output
                    else [],
                },
                payload=skill_output or {},
            )
        )

    def _skill_artifact(
        self,
        db: Session,
        task_id: str,
        asset: ParsedAsset,
        *,
        sequence: int,
    ) -> None:
        skill_output = self._skill_output(asset)
        if not skill_output:
            return
        self._artifact(
            db,
            task_id,
            AgentArtifactKind.SKILL_OUTPUT.value,
            sequence,
            "Skill output",
            f"Skill {skill_output.get('skill_id')} produced structured output.",
            skill_output,
        )

    def _audit_artifact(
        self,
        db: Session,
        task_id: str,
        job_id: str,
        *,
        sequence: int,
    ) -> None:
        audit_events = (
            db.query(AuditEvent)
            .filter(AuditEvent.entity_id == job_id)
            .order_by(AuditEvent.created_at.asc())
            .all()
        )
        self._artifact(
            db,
            task_id,
            AgentArtifactKind.AUDIT_SUMMARY.value,
            sequence,
            "Audit summary",
            f"Captured {len(audit_events)} audit events for the task job.",
            {
                "events": [
                    {
                        "id": event.id,
                        "action": event.action,
                        "entity_type": event.entity_type,
                        "entity_id": event.entity_id,
                        "metadata": event.event_metadata,
                        "created_at": event.created_at.isoformat(),
                    }
                    for event in audit_events
                ]
            },
        )

    def _message(
        self,
        db: Session,
        task_id: str,
        sequence: int,
        role: str,
        title: str,
        summary: str,
        payload: dict[str, object],
    ) -> None:
        db.add(
            AgentMessage(
                task_id=task_id,
                role=role,
                sequence=sequence,
                title=title,
                summary=summary,
                payload=payload,
            )
        )

    def _artifact(
        self,
        db: Session,
        task_id: str,
        kind: str,
        sequence: int,
        title: str,
        summary: str,
        payload: dict[str, object],
    ) -> None:
        db.add(
            AgentArtifact(
                task_id=task_id,
                kind=kind,
                sequence=sequence,
                title=title,
                summary=summary,
                payload=payload,
            )
        )

    def _step(
        self,
        db: Session,
        task_id: str,
        kind: str,
        sequence: int,
        status: str,
        title: str,
        summary: str,
        payload: dict[str, object],
        *,
        error_message: str | None = None,
    ) -> None:
        now = datetime.now(UTC)
        db.add(
            AgentStep(
                task_id=task_id,
                kind=kind,
                sequence=sequence,
                status=status,
                title=title,
                summary=summary,
                payload=payload,
                error_message=error_message,
                started_at=now,
                completed_at=now,
            )
        )

    def _subtask(
        self,
        db: Session,
        task_id: str,
        sequence: int,
        subagent_id: str,
        title: str,
        summary: str,
        payload: dict[str, object],
    ) -> None:
        db.add(
            AgentSubtask(
                task_id=task_id,
                subagent_id=subagent_id,
                sequence=sequence,
                title=title,
                summary=summary,
                payload=payload,
            )
        )

    def _file_profile_payload(
        self,
        file_record: FileRecord,
        file_profile: FileProfile,
    ) -> dict[str, object]:
        return {
            "file": {
                "id": file_record.id,
                "filename": file_record.original_filename,
                "file_type": file_record.file_type,
                "mime_type": file_record.mime_type,
                "size_bytes": file_record.size_bytes,
                "checksum_sha256": file_record.checksum_sha256,
                "source": file_record.source,
            },
            "profile": {
                "id": file_profile.id,
                "file_type": file_profile.file_type,
                "modalities": file_profile.modalities,
                "has_text_layer": file_profile.has_text_layer,
                "is_scanned": file_profile.is_scanned,
                "page_count": file_profile.page_count,
                "table_likelihood": file_profile.table_likelihood,
                "image_likelihood": file_profile.image_likelihood,
                "language": file_profile.language,
                "layout_complexity": file_profile.layout_complexity,
                "estimated_cost_class": file_profile.estimated_cost_class,
                "recommended_parsing_strategy": file_profile.recommended_parsing_strategy,
            },
        }

    def _plan_payload(self, plan: ParsingPlan) -> dict[str, object]:
        return {
            "id": plan.id,
            "job_id": plan.job_id,
            "file_id": plan.file_id,
            "selected_parser_id": plan.selected_parser_id,
            "fallback_parser_id": plan.fallback_parser_id,
            "selected_skill_id": plan.selected_skill_id,
            "output_contract": plan.output_contract,
            "expected_assets": plan.expected_assets,
            "quality_threshold": plan.quality_threshold,
            "cost_profile": plan.cost_profile,
            "human_review_policy": plan.human_review_policy,
            "decision_reason": plan.decision_reason,
        }

    def _execution_payload(self, execution: ParserExecutionResult) -> dict[str, object]:
        return {
            "id": execution.id,
            "job_id": execution.job_id,
            "parser_id": execution.parser_id,
            "status": execution.status,
            "duration_ms": execution.duration_ms,
            "confidence_score": execution.confidence_score,
            "output_payload": execution.output_payload,
            "error_message": execution.error_message,
        }

    def _quality_payload(self, quality: QualityReport) -> dict[str, object]:
        return {
            "id": quality.id,
            "job_id": quality.job_id,
            "execution_result_id": quality.execution_result_id,
            "quality_status": quality.quality_status,
            "parser_confidence": quality.parser_confidence,
            "extraction_confidence": quality.extraction_confidence,
            "schema_validation_score": quality.schema_validation_score,
            "completeness_score": quality.completeness_score,
            "consistency_score": quality.consistency_score,
            "human_review_required": quality.human_review_required,
            "quality_explanation": quality.quality_explanation,
        }

    def _asset_payload(self, asset: ParsedAsset) -> dict[str, object]:
        return {
            "id": asset.id,
            "job_id": asset.job_id,
            "file_id": asset.file_id,
            "asset_type": asset.asset_type,
            "parser_used": asset.parser_used,
            "fallback_used": asset.fallback_used,
            "skill_used": asset.skill_used,
            "latency_ms": asset.latency_ms,
            "quality_report": asset.quality_report,
            "lineage": asset.lineage,
            "structured_data": asset.structured_data,
        }

    def _skill_output(self, asset: ParsedAsset) -> dict[str, object] | None:
        skill_output = asset.structured_data.get("skill_output")
        return skill_output if isinstance(skill_output, dict) else None

    def _task_summary(self, job_status: str, quality_status: str, asset_id: str) -> str:
        if quality_status == QualityStatus.REVIEW_REQUIRED.value:
            return f"Asset {asset_id} was published and routed to human review."
        return f"Asset {asset_id} was published with job status {job_status}."

    def _multi_task_summary(self, asset_ids: list[str], review_required: bool) -> str:
        if not asset_ids:
            return "Parser-agent task finished without publishing an asset."
        if len(asset_ids) == 1:
            return (
                f"Asset {asset_ids[0]} was published and routed to human review."
                if review_required
                else f"Asset {asset_ids[0]} was published."
            )
        review_note = " At least one output was routed to human review." if review_required else ""
        return f"Published {len(asset_ids)} parsed assets.{review_note}"

    def _messages(self, db: Session, task_id: str) -> list[AgentMessage]:
        return (
            db.query(AgentMessage)
            .filter(AgentMessage.task_id == task_id)
            .order_by(AgentMessage.sequence.asc(), AgentMessage.created_at.asc())
            .all()
        )

    def _artifacts(self, db: Session, task_id: str) -> list[AgentArtifact]:
        return (
            db.query(AgentArtifact)
            .filter(AgentArtifact.task_id == task_id)
            .order_by(AgentArtifact.sequence.asc(), AgentArtifact.created_at.asc())
            .all()
        )

    def _steps(self, db: Session, task_id: str) -> list[AgentStep]:
        return (
            db.query(AgentStep)
            .filter(AgentStep.task_id == task_id)
            .order_by(AgentStep.sequence.asc(), AgentStep.created_at.asc())
            .all()
        )

    def _decisions(self, db: Session, task_id: str) -> list[AgentDecision]:
        return (
            db.query(AgentDecision)
            .filter(AgentDecision.task_id == task_id)
            .order_by(AgentDecision.sequence.asc(), AgentDecision.created_at.asc())
            .all()
        )

    def _tool_calls(self, db: Session, task_id: str) -> list[AgentToolCall]:
        return (
            db.query(AgentToolCall)
            .filter(AgentToolCall.task_id == task_id)
            .order_by(AgentToolCall.sequence.asc(), AgentToolCall.created_at.asc())
            .all()
        )

    def _skill_invocations(self, db: Session, task_id: str) -> list[AgentSkillInvocation]:
        return (
            db.query(AgentSkillInvocation)
            .filter(AgentSkillInvocation.task_id == task_id)
            .order_by(AgentSkillInvocation.sequence.asc(), AgentSkillInvocation.created_at.asc())
            .all()
        )

    def _subtasks(self, db: Session, task_id: str) -> list[AgentSubtask]:
        return (
            db.query(AgentSubtask)
            .filter(AgentSubtask.task_id == task_id)
            .order_by(AgentSubtask.sequence.asc(), AgentSubtask.created_at.asc())
            .all()
        )

    def _next_message_sequence(self, db: Session, task_id: str) -> int:
        current = db.query(AgentMessage).filter(AgentMessage.task_id == task_id).count()
        return current + 1


multimodal_parser_agent = MultimodalParserAgent()
