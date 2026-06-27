from datetime import datetime

from pydantic import Field, computed_field

from backend.app.domain.enums import (
    CostLevel,
    CostProfile,
    DeploymentMode,
    FileType,
    JobStatus,
    LatencyLevel,
    LatencyProfile,
    Modality,
    ParserType,
    QualityStatus,
    QualityTarget,
    ReviewStatus,
)
from backend.app.schemas.common import APIModel


class FileRecordRead(APIModel):
    id: str
    original_filename: str
    file_type: FileType
    mime_type: str
    size_bytes: int = Field(ge=0)
    checksum_sha256: str
    source: str
    storage_path: str
    status: JobStatus
    created_by: str
    uploaded_at: datetime


class FileProfileRead(APIModel):
    id: str
    file_id: str
    file_type: FileType
    modalities: list[Modality]
    has_text_layer: bool | None
    is_scanned: bool | None
    page_count: int | None
    table_likelihood: float | None
    image_likelihood: float | None
    language: str | None
    layout_complexity: str | None
    estimated_cost_class: str | None
    recommended_parsing_strategy: str | None
    created_at: datetime


class ParserCandidateRequest(APIModel):
    file_type: FileType
    modalities: list[Modality] = Field(default_factory=list)
    has_text_layer: bool | None = None
    is_scanned: bool | None = None
    page_count: int | None = None
    table_likelihood: float | None = None
    image_likelihood: float | None = None
    language: str | None = None
    layout_complexity: str | None = None


class ParserDefinitionRead(APIModel):
    parser_id: str
    name: str
    parser_type: ParserType
    supported_file_types: list[FileType]
    supported_modalities: list[Modality]
    strengths: list[str]
    weaknesses: list[str]
    cost_level: CostLevel
    latency_level: LatencyLevel
    expected_quality: float = Field(ge=0, le=1)
    quality_level: str
    deployment_mode: DeploymentMode
    enabled: bool
    version: str
    created_at: datetime
    updated_at: datetime


class SkillDefinitionRead(APIModel):
    skill_id: str
    name: str
    description: str
    supported_document_types: list[FileType]
    extraction_schema: dict[str, object]
    validation_rules: dict[str, object]
    examples: list[dict[str, object]]
    post_processing_hook: str | None
    enabled: bool
    version: str
    created_at: datetime
    updated_at: datetime


class SkillRead(APIModel):
    skill_id: str
    name: str
    description: str
    supported_document_types: list[FileType]
    extraction_schema: dict[str, object] = Field(alias="schema")
    validation_rules: dict[str, object]


class SkillTestRequest(APIModel):
    parsed_text: str | None = None
    structured_data: dict[str, object] = Field(default_factory=dict)
    tables: list[dict[str, object]] = Field(default_factory=list)
    entities: list[dict[str, object]] = Field(default_factory=list)
    relationships: list[dict[str, object]] = Field(default_factory=list)
    document_metadata: dict[str, object] = Field(default_factory=dict)


class SkillTestResponse(APIModel):
    skill_id: str
    output: dict[str, object]
    valid: bool
    validation_errors: list[str]


class ParseJobCreate(APIModel):
    file_id: str
    parser_id: str | None = None
    skill_id: str | None = None


class ParserSelectionRequest(APIModel):
    file_id: str
    requested_output_contract: dict[str, object] = Field(default_factory=dict)
    quality_target: QualityTarget = QualityTarget.BALANCED
    cost_profile: CostProfile = CostProfile.BALANCED
    latency_profile: LatencyProfile = LatencyProfile.INTERACTIVE
    governance_constraints: dict[str, object] = Field(default_factory=dict)


class ParserScoreBreakdown(APIModel):
    parser_id: str
    expected_quality_score: float
    cost_penalty: float
    latency_penalty: float
    risk_penalty: float
    historical_success_bonus: float
    total_score: float


class ParserSelectionResponse(APIModel):
    file_id: str
    primary_parser_id: str
    fallback_parser_id: str | None
    secondary_parser_id: str | None
    selected_skill_id: str | None
    decision_score: float
    decision_explanation: str
    score_breakdown: list[ParserScoreBreakdown]


class ParseJobRunResponse(APIModel):
    job: "ParseJobRead"
    plan: "ParsingPlanRead"
    quality: "QualityReportRead"
    assets: list["ParsedAssetRead"]
    review_item: "ReviewItemRead | None" = None


class ParseJobRead(APIModel):
    id: str
    file_id: str
    status: JobStatus
    parser_id: str | None
    skill_id: str | None
    quality_status: QualityStatus
    created_at: datetime
    updated_at: datetime


class ParsingPlanRead(APIModel):
    id: str
    job_id: str
    file_id: str
    selected_parser_id: str
    fallback_parser_id: str | None
    selected_skill_id: str | None
    output_contract: dict[str, object]
    expected_assets: list[str]
    quality_threshold: float
    cost_profile: dict[str, object]
    human_review_policy: dict[str, object]
    decision_reason: str
    created_at: datetime


class ParserExecutionResultRead(APIModel):
    id: str
    job_id: str
    parser_id: str
    status: JobStatus
    started_at: datetime | None
    completed_at: datetime | None
    duration_ms: int | None
    confidence_score: float | None
    output_payload: dict[str, object]
    error_message: str | None
    created_at: datetime


class QualityReportRead(APIModel):
    id: str
    job_id: str
    execution_result_id: str | None
    quality_status: QualityStatus
    parser_confidence: float | None
    extraction_confidence: float | None
    schema_validation_score: float | None
    completeness_score: float | None
    consistency_score: float | None
    human_review_required: bool
    quality_explanation: str
    created_at: datetime


class ParsedAssetRead(APIModel):
    id: str
    job_id: str
    file_id: str
    asset_type: str
    document_metadata: dict[str, object]
    parsed_text: str | None
    layout_blocks: list[dict[str, object]]
    tables: list[dict[str, object]]
    image_descriptions: list[dict[str, object]]
    audio_transcript: str | None
    video_transcript: str | None
    chunks: list[dict[str, object]]
    embeddings: list[dict[str, object]]
    entities: list[dict[str, object]]
    relationships: list[dict[str, object]]
    evidence_spans: list[dict[str, object]]
    quality_report: dict[str, object]
    lineage: dict[str, object]
    parser_used: str
    fallback_used: bool
    skill_used: str | None
    cost_estimate: dict[str, object]
    latency_ms: int | None
    audit_trail: list[dict[str, object]]
    structured_data: dict[str, object]
    storage_path: str | None
    created_at: datetime

    @computed_field
    @property
    def asset_id(self) -> str:
        return self.id


class ReviewItemRead(APIModel):
    id: str
    job_id: str
    file_id: str
    quality_report_id: str | None
    status: ReviewStatus
    reason: str
    assigned_to: str | None
    resolution_notes: str | None
    created_at: datetime
    updated_at: datetime


class AuditEventRead(APIModel):
    id: str
    actor: str
    action: str
    entity_type: str
    entity_id: str
    event_metadata: dict[str, object]
    created_at: datetime
