from datetime import datetime

from pydantic import Field

from backend.app.domain.enums import (
    AgentArtifactKind,
    AgentMessageRole,
    AgentStepKind,
    AgentTaskStatus,
    CostProfile,
    LatencyProfile,
    QualityTarget,
)
from backend.app.schemas.common import APIModel


class AgentEndpointMap(APIModel):
    create_task: str
    create_task_from_upload: str
    get_task: str
    list_tasks: str
    cancel_task: str
    messages: str
    artifacts: str
    events: str
    event_stream: str


class AgentCard(APIModel):
    name: str
    display_name: str
    description: str
    version: str
    provider: dict[str, str]
    capabilities: list[str]
    supported_modalities: list[str]
    input_modes: list[str]
    output_modes: list[str]
    skills: list[str]
    tools: list[str]
    streaming: dict[str, object]
    auth: dict[str, object]
    endpoints: AgentEndpointMap


class AgentTaskCreate(APIModel):
    file_id: str | None = None
    file_ids: list[str] = Field(default_factory=list)
    asset_id: str | None = None
    url: str | None = None
    text_payload: str | None = None
    requested_output_contract: dict[str, object] = Field(default_factory=dict)
    governance_constraints: dict[str, object] = Field(default_factory=dict)
    quality_target: QualityTarget = QualityTarget.BALANCED
    cost_profile: CostProfile = CostProfile.BALANCED
    latency_profile: LatencyProfile = LatencyProfile.INTERACTIVE
    title: str | None = None


class AgentTaskRead(APIModel):
    id: str
    status: AgentTaskStatus
    title: str
    summary: str | None
    file_id: str | None
    job_id: str | None
    requested_output_contract: dict[str, object]
    governance_constraints: dict[str, object]
    quality_target: str
    cost_profile: str
    latency_profile: str
    input_payload: dict[str, object]
    worker_id: str | None
    attempt_count: int
    max_attempts: int
    locked_at: datetime | None
    lock_expires_at: datetime | None
    heartbeat_at: datetime | None
    next_attempt_at: datetime | None
    error_code: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class AgentMessageRead(APIModel):
    id: str
    task_id: str
    role: AgentMessageRole
    sequence: int
    title: str | None
    summary: str
    payload: dict[str, object]
    created_at: datetime


class AgentArtifactRead(APIModel):
    id: str
    task_id: str
    kind: AgentArtifactKind
    sequence: int
    title: str
    summary: str
    payload: dict[str, object]
    storage_uri: str | None
    created_at: datetime


class AgentPlanRead(APIModel):
    id: str
    task_id: str
    job_id: str | None
    status: str
    title: str
    summary: str
    selected_parser_id: str | None
    fallback_parser_id: str | None
    selected_skill_id: str | None
    quality_threshold: float | None
    payload: dict[str, object]
    created_at: datetime
    updated_at: datetime


class AgentStepRead(APIModel):
    id: str
    task_id: str
    kind: AgentStepKind
    status: str
    sequence: int
    title: str
    summary: str
    payload: dict[str, object]
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime


class AgentDecisionRead(APIModel):
    id: str
    task_id: str
    decision_type: str
    sequence: int
    title: str
    summary: str
    selected_option: str | None
    alternatives: list[dict[str, object]]
    score_breakdown: dict[str, object]
    payload: dict[str, object]
    created_at: datetime


class AgentToolCallRead(APIModel):
    id: str
    task_id: str
    tool_id: str
    status: str
    sequence: int
    input_summary: str | None
    output_summary: str | None
    request_payload: dict[str, object]
    response_payload: dict[str, object]
    duration_ms: int | None
    error_message: str | None
    created_at: datetime


class AgentSkillInvocationRead(APIModel):
    id: str
    task_id: str
    skill_id: str
    status: str
    sequence: int
    input_summary: str | None
    output_summary: str | None
    validation_result: dict[str, object]
    payload: dict[str, object]
    created_at: datetime


class AgentSubtaskRead(APIModel):
    id: str
    task_id: str
    subagent_id: str
    status: str
    sequence: int
    title: str
    summary: str
    payload: dict[str, object]
    error_message: str | None
    created_at: datetime


class AgentQualityJudgementRead(APIModel):
    id: str
    task_id: str
    quality_report_id: str | None
    status: str
    summary: str
    dimensions: dict[str, object]
    thresholds: dict[str, object]
    review_rationale: str | None
    payload: dict[str, object]
    created_at: datetime


class AgentLineageRead(APIModel):
    id: str
    task_id: str
    source_file_id: str | None
    job_id: str | None
    asset_id: str | None
    summary: str
    payload: dict[str, object]
    created_at: datetime


class AgentTaskDetail(AgentTaskRead):
    messages: list[AgentMessageRead]
    artifacts: list[AgentArtifactRead]
    plan: AgentPlanRead | None
    steps: list[AgentStepRead]
    decisions: list[AgentDecisionRead]
    tool_calls: list[AgentToolCallRead]
    skill_invocations: list[AgentSkillInvocationRead]
    subtasks: list[AgentSubtaskRead]
    quality_judgement: AgentQualityJudgementRead | None
    lineage: AgentLineageRead | None


class AgentTaskCreateResponse(APIModel):
    task: AgentTaskDetail


class AgentEventRead(APIModel):
    id: str
    task_id: str
    event_type: str
    sequence: int
    title: str | None
    summary: str
    payload: dict[str, object]
    created_at: datetime
