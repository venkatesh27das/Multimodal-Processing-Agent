from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base
from backend.app.domain.enums import (
    CostLevel,
    DeploymentMode,
    FileType,
    JobStatus,
    LatencyLevel,
    ParserType,
    QualityStatus,
    ReviewStatus,
)


def new_uuid() -> str:
    return str(uuid4())


def utc_now() -> datetime:
    return datetime.now(UTC)


class FileRecord(Base):
    __tablename__ = "file_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    file_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default=FileType.UNKNOWN.value,
    )
    mime_type: Mapped[str] = mapped_column(String(255), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    checksum_sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(64), nullable=False, default="ui")
    storage_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    status: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default=JobStatus.REGISTERED.value,
    )
    created_by: Mapped[str] = mapped_column(String(255), nullable=False, default="local-user")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)


class FileProfile(Base):
    __tablename__ = "file_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    file_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("file_records.id"),
        nullable=False,
        unique=True,
    )
    file_type: Mapped[str] = mapped_column(String(64), nullable=False)
    modalities: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    has_text_layer: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    is_scanned: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    table_likelihood: Mapped[float | None] = mapped_column(Float, nullable=True)
    image_likelihood: Mapped[float | None] = mapped_column(Float, nullable=True)
    language: Mapped[str | None] = mapped_column(String(32), nullable=True)
    layout_complexity: Mapped[str | None] = mapped_column(String(64), nullable=True)
    estimated_cost_class: Mapped[str | None] = mapped_column(String(64), nullable=True)
    recommended_parsing_strategy: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)


class ParserDefinition(Base):
    __tablename__ = "parser_definitions"

    parser_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    parser_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default=ParserType.DETERMINISTIC.value,
    )
    supported_file_types: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    supported_modalities: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    strengths: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    weaknesses: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    cost_level: Mapped[str] = mapped_column(String(64), nullable=False, default=CostLevel.LOW.value)
    latency_level: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default=LatencyLevel.LOW.value,
    )
    expected_quality: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    quality_level: Mapped[str] = mapped_column(String(64), nullable=False, default="medium")
    deployment_mode: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default=DeploymentMode.LOCAL.value,
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    version: Mapped[str] = mapped_column(String(64), nullable=False, default="0.1.0")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )


class SkillDefinition(Base):
    __tablename__ = "skill_definitions"

    skill_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    supported_document_types: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    extraction_schema: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    validation_rules: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    examples: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False, default=list)
    post_processing_hook: Mapped[str | None] = mapped_column(String(255), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    version: Mapped[str] = mapped_column(String(64), nullable=False, default="0.1.0")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )


class ParseJob(Base):
    __tablename__ = "parse_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    file_id: Mapped[str] = mapped_column(String(36), ForeignKey("file_records.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(64), nullable=False, default=JobStatus.QUEUED.value)
    parser_id: Mapped[str | None] = mapped_column(
        String(128),
        ForeignKey("parser_definitions.parser_id"),
        nullable=True,
    )
    skill_id: Mapped[str | None] = mapped_column(
        String(128),
        ForeignKey("skill_definitions.skill_id"),
        nullable=True,
    )
    quality_status: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default=QualityStatus.NOT_EVALUATED.value,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )


class ParsingPlan(Base):
    __tablename__ = "parsing_plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("parse_jobs.id"), nullable=False)
    file_id: Mapped[str] = mapped_column(String(36), ForeignKey("file_records.id"), nullable=False)
    selected_parser_id: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("parser_definitions.parser_id"),
        nullable=False,
    )
    fallback_parser_id: Mapped[str | None] = mapped_column(
        String(128),
        ForeignKey("parser_definitions.parser_id"),
        nullable=True,
    )
    selected_skill_id: Mapped[str | None] = mapped_column(
        String(128),
        ForeignKey("skill_definitions.skill_id"),
        nullable=True,
    )
    output_contract: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    expected_assets: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    quality_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=0.8)
    cost_profile: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    human_review_policy: Mapped[dict[str, object]] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
    )
    decision_reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)


class ParserExecutionResult(Base):
    __tablename__ = "parser_execution_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("parse_jobs.id"), nullable=False)
    parser_id: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("parser_definitions.parser_id"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default=JobStatus.COMPLETE.value,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    output_payload: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)


class QualityReport(Base):
    __tablename__ = "quality_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("parse_jobs.id"), nullable=False)
    execution_result_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("parser_execution_results.id"),
        nullable=True,
    )
    quality_status: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default=QualityStatus.NOT_EVALUATED.value,
    )
    parser_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    extraction_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    schema_validation_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    completeness_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    consistency_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    human_review_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    quality_explanation: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)


class ParsedAsset(Base):
    __tablename__ = "parsed_assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("parse_jobs.id"), nullable=False)
    file_id: Mapped[str] = mapped_column(String(36), ForeignKey("file_records.id"), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(64), nullable=False)
    document_metadata: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    parsed_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    layout_blocks: Mapped[list[dict[str, object]]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
    tables: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False, default=list)
    image_descriptions: Mapped[list[dict[str, object]]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
    audio_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    chunks: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False, default=list)
    embeddings: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False, default=list)
    entities: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False, default=list)
    relationships: Mapped[list[dict[str, object]]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
    evidence_spans: Mapped[list[dict[str, object]]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
    quality_report: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    lineage: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    parser_used: Mapped[str] = mapped_column(String(128), nullable=False, default="unknown")
    fallback_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    skill_used: Mapped[str | None] = mapped_column(String(128), nullable=True)
    cost_estimate: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    audit_trail: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False, default=list)
    structured_data: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    storage_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)


class ReviewItem(Base):
    __tablename__ = "review_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("parse_jobs.id"), nullable=False)
    file_id: Mapped[str] = mapped_column(String(36), ForeignKey("file_records.id"), nullable=False)
    quality_report_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("quality_reports.id"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(64), nullable=False, default=ReviewStatus.OPEN.value)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    assigned_to: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    actor: Mapped[str] = mapped_column(String(255), nullable=False)
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(128), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(128), nullable=False)
    event_metadata: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)
