from collections import Counter, defaultdict

from sqlalchemy.orm import Session

from backend.app.domain.enums import JobStatus, QualityStatus
from backend.app.models.domain import (
    AuditEvent,
    ParsedAsset,
    ParseJob,
    ParserExecutionResult,
    QualityReport,
    ReviewItem,
)
from backend.app.schemas.observability import (
    CostMetrics,
    ErrorLogEntry,
    FrequencyMetrics,
    JobMetrics,
    LatencyMetrics,
    ObservabilitySummary,
    ParserUsageMetric,
    QualityBucket,
    QualityMetrics,
)


class ObservabilityService:
    def summary(self, db: Session) -> ObservabilitySummary:
        jobs = db.query(ParseJob).all()
        assets = db.query(ParsedAsset).all()
        reviews = db.query(ReviewItem).all()
        executions = db.query(ParserExecutionResult).all()

        total_jobs = len(jobs)
        completed_jobs = self._count_status(jobs, JobStatus.COMPLETE.value)
        failed_jobs = self._count_status(jobs, JobStatus.FAILED.value)
        review_required_jobs = self._count_status(jobs, JobStatus.REVIEW_REQUIRED.value)
        fallback_count = sum(1 for asset in assets if asset.fallback_used)
        latency_values = [
            value
            for value in [asset.latency_ms for asset in assets]
            + [execution.duration_ms for execution in executions]
            if value is not None
        ]

        return ObservabilitySummary(
            jobs=JobMetrics(
                total_jobs=total_jobs,
                completed_jobs=completed_jobs,
                failed_jobs=failed_jobs,
                review_required_jobs=review_required_jobs,
                success_rate=completed_jobs / total_jobs if total_jobs else 0,
            ),
            fallback=FrequencyMetrics(
                count=fallback_count,
                rate=fallback_count / len(assets) if assets else 0,
            ),
            review=FrequencyMetrics(
                count=len(reviews),
                rate=len(reviews) / total_jobs if total_jobs else 0,
            ),
            latency=self._latency(latency_values),
            cost=CostMetrics(
                estimated_cost=sum(self._asset_cost(asset) for asset in assets),
                currency="USD",
            ),
            error_logs=self.error_logs(db),
        )

    def parser_usage(self, db: Session) -> list[ParserUsageMetric]:
        executions = db.query(ParserExecutionResult).all()
        assets = db.query(ParsedAsset).all()
        executions_by_parser: dict[str, list[ParserExecutionResult]] = defaultdict(list)
        assets_by_parser: dict[str, list[ParsedAsset]] = defaultdict(list)
        job_ids_by_parser: dict[str, set[str]] = defaultdict(set)

        for execution in executions:
            executions_by_parser[execution.parser_id].append(execution)
            job_ids_by_parser[execution.parser_id].add(execution.job_id)
        for asset in assets:
            assets_by_parser[asset.parser_used].append(asset)
            job_ids_by_parser[asset.parser_used].add(asset.job_id)

        parser_ids = sorted(set(executions_by_parser) | set(assets_by_parser))
        return [
            ParserUsageMetric(
                parser_id=parser_id,
                execution_count=len(executions_by_parser[parser_id]),
                job_count=len(job_ids_by_parser[parser_id]),
                success_count=sum(
                    1
                    for execution in executions_by_parser[parser_id]
                    if execution.status == JobStatus.COMPLETE.value
                ),
                error_count=sum(
                    1
                    for execution in executions_by_parser[parser_id]
                    if execution.error_message
                ),
                fallback_asset_count=sum(
                    1 for asset in assets_by_parser[parser_id] if asset.fallback_used
                ),
                average_confidence=self._average(
                    execution.confidence_score
                    for execution in executions_by_parser[parser_id]
                    if execution.confidence_score is not None
                ),
                average_latency_ms=self._average(
                    value
                    for value in [
                        *[asset.latency_ms for asset in assets_by_parser[parser_id]],
                        *[
                            execution.duration_ms
                            for execution in executions_by_parser[parser_id]
                        ],
                    ]
                    if value is not None
                ),
                estimated_cost=sum(
                    self._asset_cost(asset) for asset in assets_by_parser[parser_id]
                ),
            )
            for parser_id in parser_ids
        ]

    def quality(self, db: Session) -> QualityMetrics:
        reports = db.query(QualityReport).all()
        scores = [
            report.extraction_confidence
            for report in reports
            if report.extraction_confidence is not None
        ]
        statuses = Counter(report.quality_status for report in reports)
        buckets = [
            self._bucket("Low", 0.0, 0.5, scores),
            self._bucket("Medium", 0.5, 0.8, scores),
            self._bucket("High", 0.8, 1.0, scores, include_max=True),
        ]
        return QualityMetrics(
            average_quality=self._average(scores),
            passed=statuses[QualityStatus.PASSED.value],
            review_required=statuses[QualityStatus.REVIEW_REQUIRED.value],
            failed=statuses[QualityStatus.FAILED.value],
            not_evaluated=statuses[QualityStatus.NOT_EVALUATED.value],
            buckets=buckets,
        )

    def error_logs(self, db: Session) -> list[ErrorLogEntry]:
        execution_errors = [
            ErrorLogEntry(
                execution_result_id=execution.id,
                job_id=execution.job_id,
                parser_id=execution.parser_id,
                message=execution.error_message or "Parser execution failed.",
                created_at=execution.created_at,
            )
            for execution in db.query(ParserExecutionResult)
            .filter(ParserExecutionResult.error_message.is_not(None))
            .order_by(ParserExecutionResult.created_at.desc())
            .limit(20)
            .all()
        ]
        audit_errors = [
            ErrorLogEntry(
                message=str(event.event_metadata.get("error", event.action)),
                created_at=event.created_at,
            )
            for event in db.query(AuditEvent)
            .filter(AuditEvent.action.like("%error%"))
            .order_by(AuditEvent.created_at.desc())
            .limit(20)
            .all()
        ]
        return sorted(
            [*execution_errors, *audit_errors],
            key=lambda entry: entry.created_at,
            reverse=True,
        )[:20]

    def _latency(self, values: list[int]) -> LatencyMetrics:
        if not values:
            return LatencyMetrics(average_ms=0, p50_ms=0, p95_ms=0, max_ms=0)
        ordered = sorted(values)
        return LatencyMetrics(
            average_ms=sum(ordered) / len(ordered),
            p50_ms=self._percentile(ordered, 0.5),
            p95_ms=self._percentile(ordered, 0.95),
            max_ms=max(ordered),
        )

    def _percentile(self, ordered_values: list[int], percentile: float) -> float:
        if len(ordered_values) == 1:
            return float(ordered_values[0])
        index = min(
            len(ordered_values) - 1,
            max(0, round((len(ordered_values) - 1) * percentile)),
        )
        return float(ordered_values[index])

    def _count_status(self, jobs: list[ParseJob], status: str) -> int:
        return sum(1 for job in jobs if job.status == status)

    def _asset_cost(self, asset: ParsedAsset) -> float:
        raw = asset.cost_estimate.get(
            "estimated_cost_usd",
            asset.cost_estimate.get("estimated_cost", 0),
        )
        return float(raw) if isinstance(raw, int | float) else 0.0

    def _average(self, values: object) -> float | None:
        collected = list(values)
        if not collected:
            return None
        return sum(collected) / len(collected)

    def _bucket(
        self,
        label: str,
        min_score: float,
        max_score: float,
        scores: list[float],
        *,
        include_max: bool = False,
    ) -> QualityBucket:
        if include_max:
            count = sum(1 for score in scores if min_score <= score <= max_score)
        else:
            count = sum(1 for score in scores if min_score <= score < max_score)
        return QualityBucket(label=label, min_score=min_score, max_score=max_score, count=count)


observability_service = ObservabilityService()
