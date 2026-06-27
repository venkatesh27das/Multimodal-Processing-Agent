from datetime import datetime

from backend.app.schemas.common import APIModel
from backend.app.schemas.domain import AuditEventRead


class JobMetrics(APIModel):
    total_jobs: int
    completed_jobs: int
    failed_jobs: int
    review_required_jobs: int
    success_rate: float


class FrequencyMetrics(APIModel):
    count: int
    rate: float


class LatencyMetrics(APIModel):
    average_ms: float
    p50_ms: float
    p95_ms: float
    max_ms: int


class CostMetrics(APIModel):
    estimated_cost: float
    currency: str


class ErrorLogEntry(APIModel):
    execution_result_id: str | None = None
    job_id: str | None = None
    parser_id: str | None = None
    message: str
    created_at: datetime


class ObservabilitySummary(APIModel):
    jobs: JobMetrics
    fallback: FrequencyMetrics
    review: FrequencyMetrics
    latency: LatencyMetrics
    cost: CostMetrics
    error_logs: list[ErrorLogEntry]


class ParserUsageMetric(APIModel):
    parser_id: str
    execution_count: int
    job_count: int
    success_count: int
    error_count: int
    fallback_asset_count: int
    average_confidence: float | None
    average_latency_ms: float | None
    estimated_cost: float


class QualityBucket(APIModel):
    label: str
    min_score: float
    max_score: float
    count: int


class QualityMetrics(APIModel):
    average_quality: float | None
    passed: int
    review_required: int
    failed: int
    not_evaluated: int
    buckets: list[QualityBucket]


class AuditEventsResponse(APIModel):
    events: list[AuditEventRead]
