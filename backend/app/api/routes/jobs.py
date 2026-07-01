import csv
from datetime import UTC, datetime, timedelta
from io import StringIO

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.domain.enums import CostProfile, JobStatus, LatencyProfile, QualityStatus, QualityTarget, ReviewStatus
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
    ParsedAsset,
    ParserExecutionResult,
    ParsingPlan,
    QualityReport,
    ReviewItem,
)
from backend.app.models.file import FileRecord
from backend.app.models.job import ParseJob
from backend.app.schemas.common import APIModel
from backend.app.schemas.domain import (
    ParsedAssetRead,
    ParseJobRead,
    ParseJobRunResponse,
    ParserSelectionRequest,
    ParserSelectionResponse,
    ParsingPlanRead,
    QualityReportRead,
)
from backend.app.schemas.agent import AgentTaskCreate
from backend.app.schemas.jobs import ParseJobCreate, ParseJobResponse
from backend.app.services.agent_task_worker import agent_task_worker
from backend.app.services.audit_logger import audit_logger
from backend.app.services.multimodal_parser_agent import multimodal_parser_agent
from backend.app.services.observability import observability_service
from backend.app.services.orchestration_engine import orchestration_engine
from backend.app.services.parser_selector import parser_selector

router = APIRouter(prefix="/parse-jobs")
planning_router = APIRouter(prefix="/jobs")


class JobsMetricsResponse(APIModel):
    jobs_today: int
    failed_jobs: int
    success_rate: float


class JobsPageResponse(APIModel):
    jobs: list[ParseJobRead]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.post("", response_model=ParseJobResponse, status_code=status.HTTP_202_ACCEPTED)
def create_parse_job(payload: ParseJobCreate, db: Session = Depends(get_db)) -> ParseJobResponse:
    file_record = db.get(FileRecord, payload.file_id)
    if file_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    job = ParseJob(
        file_id=payload.file_id,
        status=JobStatus.QUEUED.value,
        parser_id=payload.parser_id,
        skill_id=payload.skill_id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return ParseJobResponse(
        job_id=job.id,
        file_id=job.file_id,
        status=JobStatus(job.status),
        parser_id=job.parser_id,
        skill_id=job.skill_id,
        quality_status=QualityStatus(job.quality_status),
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


@router.get("", response_model=list[ParseJobResponse])
def list_parse_jobs(db: Session = Depends(get_db)) -> list[ParseJobResponse]:
    jobs = db.query(ParseJob).order_by(ParseJob.created_at.desc()).all()
    return [
        ParseJobResponse(
            job_id=job.id,
            file_id=job.file_id,
            status=JobStatus(job.status),
            parser_id=job.parser_id,
            skill_id=job.skill_id,
            quality_status=QualityStatus(job.quality_status),
            created_at=job.created_at,
            updated_at=job.updated_at,
        )
        for job in jobs
    ]


@planning_router.post("/plan", response_model=ParserSelectionResponse)
def plan_parse_job(
    payload: ParserSelectionRequest,
    db: Session = Depends(get_db),
) -> ParserSelectionResponse:
    file_record = db.get(FileRecord, payload.file_id)
    if file_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    file_profile = (
        db.query(FileProfile)
        .filter(FileProfile.file_id == payload.file_id)
        .one_or_none()
    )
    if file_profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File profile not found")

    try:
        return parser_selector.plan(
            db,
            file_profile=file_profile,
            requested_output_contract=payload.requested_output_contract,
            quality_target=payload.quality_target,
            cost_profile=payload.cost_profile,
            latency_profile=payload.latency_profile,
            governance_constraints=payload.governance_constraints,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@planning_router.post("", response_model=ParseJobRunResponse, status_code=status.HTTP_201_CREATED)
def run_parse_job(
    payload: ParserSelectionRequest,
    db: Session = Depends(get_db),
) -> ParseJobRunResponse:
    file_record, file_profile = _load_file_and_profile(db, payload.file_id)
    try:
        job, plan, quality, asset, review_item = orchestration_engine.run(
            db,
            file_record=file_record,
            file_profile=file_profile,
            request=payload,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return ParseJobRunResponse(
        job=job,
        plan=plan,
        quality=quality,
        assets=[asset],
        review_item=review_item,
    )


@planning_router.get("", response_model=JobsPageResponse)
def list_jobs(
    search: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    file_type: str | None = None,
    parser: str | None = None,
    date_range: str | None = None,
    review_required: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=250),
    db: Session = Depends(get_db),
) -> JobsPageResponse:
    query = _filtered_jobs_query(
        db,
        search=search,
        status_filter=status_filter,
        file_type=file_type,
        parser=parser,
        date_range=date_range,
        review_required=review_required,
    )
    total = query.count()
    total_pages = max(1, (total + page_size - 1) // page_size)
    current_page = min(page, total_pages)
    jobs = (
        query.order_by(ParseJob.created_at.desc())
        .offset((current_page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return JobsPageResponse(
        jobs=jobs,
        total=total,
        page=current_page,
        page_size=page_size,
        total_pages=total_pages,
    )


@planning_router.get("/metrics", response_model=JobsMetricsResponse)
def get_jobs_metrics(db: Session = Depends(get_db)) -> JobsMetricsResponse:
    jobs = db.query(ParseJob).all()
    today = datetime.now(UTC).date()
    jobs_today = sum(1 for job in jobs if job.created_at.date() == today)
    summary = observability_service.summary(db)
    return JobsMetricsResponse(
        jobs_today=jobs_today,
        failed_jobs=summary.jobs.failed_jobs,
        success_rate=summary.jobs.success_rate,
    )


@planning_router.get("/export")
def export_jobs(
    search: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    file_type: str | None = None,
    parser: str | None = None,
    date_range: str | None = None,
    review_required: bool = False,
    db: Session = Depends(get_db),
) -> Response:
    jobs = (
        _filtered_jobs_query(
            db,
            search=search,
            status_filter=status_filter,
            file_type=file_type,
            parser=parser,
            date_range=date_range,
            review_required=review_required,
        )
        .order_by(ParseJob.created_at.desc())
        .all()
    )
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "run_id",
            "file_id",
            "filename",
            "file_type",
            "status",
            "parser",
            "fallback_parser",
            "skill",
            "quality_status",
            "quality_score",
            "human_review_required",
            "fallback_used",
            "duration_ms",
            "created_at",
            "updated_at",
        ]
    )
    for job in jobs:
        file_record = db.get(FileRecord, job.file_id)
        plan = (
            db.query(ParsingPlan)
            .filter(ParsingPlan.job_id == job.id)
            .order_by(ParsingPlan.created_at.desc())
            .first()
        )
        quality = _latest_quality(db, job.id)
        asset = (
            db.query(ParsedAsset)
            .filter(ParsedAsset.job_id == job.id)
            .order_by(ParsedAsset.created_at.desc())
            .first()
        )
        quality_score = (
            quality.extraction_confidence
            if quality and quality.extraction_confidence is not None
            else quality.parser_confidence
            if quality
            else None
        )
        writer.writerow(
            [
                job.id,
                job.file_id,
                file_record.original_filename if file_record else "",
                file_record.file_type if file_record else "",
                job.status,
                job.parser_id or asset.parser_used if asset else job.parser_id,
                plan.fallback_parser_id if plan else "",
                job.skill_id or asset.skill_used if asset else job.skill_id,
                quality.quality_status if quality else job.quality_status,
                quality_score if quality_score is not None else "",
                quality.human_review_required if quality else "",
                asset.fallback_used if asset else "",
                asset.latency_ms if asset and asset.latency_ms is not None else "",
                job.created_at.isoformat(),
                job.updated_at.isoformat(),
            ]
        )
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="runs-export.csv"'},
    )


@planning_router.get("/{job_id}", response_model=ParseJobRead)
def get_job(job_id: str, db: Session = Depends(get_db)) -> ParseJobRead:
    job = db.get(ParseJob, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


@planning_router.post("/{job_id}/retry", response_model=ParseJobRead, status_code=status.HTTP_201_CREATED)
def retry_job(job_id: str, db: Session = Depends(get_db)) -> ParseJobRead:
    original_job = db.get(ParseJob, job_id)
    if original_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    previous_plan = (
        db.query(ParsingPlan)
        .filter(ParsingPlan.job_id == job_id)
        .order_by(ParsingPlan.created_at.desc())
        .first()
    )
    payload = AgentTaskCreate(
        file_ids=[original_job.file_id],
        requested_output_contract=previous_plan.output_contract if previous_plan else {},
        quality_target=_quality_target_from_plan(previous_plan),
        cost_profile=_cost_profile_from_plan(previous_plan),
        latency_profile=LatencyProfile.INTERACTIVE,
        governance_constraints={
            **(previous_plan.human_review_policy if previous_plan else {}),
            "retry_of_job_id": job_id,
            "source": "run_history",
        },
        title=f"Retry run {job_id}",
    )
    try:
        task = multimodal_parser_agent.create_task(db, payload)
        task = agent_task_worker.process_task(db, task.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if task is None or task.job_id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Retry agent task did not create a job",
        )
    retried_job = db.get(ParseJob, task.job_id)
    if retried_job is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Retry job was not found after agent execution",
        )

    audit_logger.log(
        db,
        actor="local-user",
        action="job_retried",
        entity_type="parse_job",
        entity_id=retried_job.id,
        metadata={"source_job_id": job_id, "agent_task_id": task.id},
    )
    db.commit()
    db.refresh(retried_job)
    return retried_job


@planning_router.post("/{job_id}/send-to-review", response_model=ParseJobRead)
def send_job_to_review(job_id: str, db: Session = Depends(get_db)) -> ParseJobRead:
    job = db.get(ParseJob, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    quality = _latest_quality(db, job_id)
    review_item = (
        db.query(ReviewItem)
        .filter(
            ReviewItem.job_id == job_id,
            ReviewItem.status.in_([ReviewStatus.OPEN.value, ReviewStatus.ASSIGNED.value]),
        )
        .order_by(ReviewItem.created_at.desc())
        .first()
    )
    if review_item is None:
        review_item = ReviewItem(
            job_id=job.id,
            file_id=job.file_id,
            quality_report_id=quality.id if quality else None,
            status=ReviewStatus.OPEN.value,
            reason=quality.quality_explanation if quality else "Manual review requested from Run History.",
        )
        db.add(review_item)
        db.flush()

    job.status = JobStatus.REVIEW_REQUIRED.value
    job.quality_status = QualityStatus.REVIEW_REQUIRED.value
    if quality is not None:
        quality.human_review_required = True
        quality.quality_status = QualityStatus.REVIEW_REQUIRED.value
    audit_logger.log(
        db,
        actor="local-user",
        action="job_sent_to_review",
        entity_type="parse_job",
        entity_id=job.id,
        metadata={"review_item_id": review_item.id},
    )
    db.commit()
    db.refresh(job)
    return job


@planning_router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(job_id: str, db: Session = Depends(get_db)) -> None:
    job = db.get(ParseJob, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    task_ids = [
        task_id
        for (task_id,) in db.query(AgentTask.id).filter(AgentTask.job_id == job_id).all()
    ]
    asset_ids = [
        asset_id
        for (asset_id,) in db.query(ParsedAsset.id).filter(ParsedAsset.job_id == job_id).all()
    ]

    if task_ids:
        for model in (
            AgentLineage,
            AgentSkillInvocation,
            AgentToolCall,
            AgentDecision,
            AgentStep,
            AgentPlan,
            AgentArtifact,
            AgentMessage,
            AgentSubtask,
            AgentQualityJudgement,
        ):
            db.query(model).filter(model.task_id.in_(task_ids)).delete(synchronize_session=False)
        db.query(AgentTask).filter(AgentTask.id.in_(task_ids)).delete(synchronize_session=False)

    db.query(ReviewItem).filter(ReviewItem.job_id == job_id).delete(synchronize_session=False)
    db.query(ParsedAsset).filter(ParsedAsset.job_id == job_id).delete(synchronize_session=False)
    db.query(QualityReport).filter(QualityReport.job_id == job_id).delete(synchronize_session=False)
    db.query(ParserExecutionResult).filter(ParserExecutionResult.job_id == job_id).delete(
        synchronize_session=False,
    )
    db.query(ParsingPlan).filter(ParsingPlan.job_id == job_id).delete(synchronize_session=False)
    db.query(AuditEvent).filter(AuditEvent.entity_id == job_id).delete(synchronize_session=False)
    if asset_ids:
        db.query(AuditEvent).filter(AuditEvent.entity_id.in_(asset_ids)).delete(
            synchronize_session=False,
        )

    db.delete(job)
    db.commit()


@planning_router.get("/{job_id}/plan", response_model=ParsingPlanRead)
def get_job_plan(job_id: str, db: Session = Depends(get_db)) -> ParsingPlanRead:
    plan = db.query(ParsingPlan).filter(ParsingPlan.job_id == job_id).one_or_none()
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parsing plan not found")
    return plan


@planning_router.get("/{job_id}/quality", response_model=QualityReportRead)
def get_job_quality(job_id: str, db: Session = Depends(get_db)) -> QualityReportRead:
    quality = (
        db.query(QualityReport)
        .filter(QualityReport.job_id == job_id)
        .order_by(QualityReport.created_at.desc())
        .first()
    )
    if quality is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quality report not found",
        )
    return quality


@planning_router.get("/{job_id}/assets", response_model=list[ParsedAssetRead])
def get_job_assets(job_id: str, db: Session = Depends(get_db)) -> list[ParsedAssetRead]:
    return db.query(ParsedAsset).filter(ParsedAsset.job_id == job_id).all()


def _load_file_and_profile(db: Session, file_id: str) -> tuple[FileRecord, FileProfile]:
    file_record = db.get(FileRecord, file_id)
    if file_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    file_profile = db.query(FileProfile).filter(FileProfile.file_id == file_id).one_or_none()
    if file_profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File profile not found")
    return file_record, file_profile


def _filtered_jobs_query(
    db: Session,
    *,
    search: str | None,
    status_filter: str | None,
    file_type: str | None,
    parser: str | None,
    date_range: str | None,
    review_required: bool,
):
    query = (
        db.query(ParseJob)
        .join(FileRecord, FileRecord.id == ParseJob.file_id)
        .outerjoin(ParsingPlan, ParsingPlan.job_id == ParseJob.id)
        .outerjoin(QualityReport, QualityReport.job_id == ParseJob.id)
        .outerjoin(ParsedAsset, ParsedAsset.job_id == ParseJob.id)
        .distinct()
    )
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            ParseJob.id.ilike(term)
            | ParseJob.file_id.ilike(term)
            | FileRecord.original_filename.ilike(term)
            | FileRecord.file_type.ilike(term)
            | ParseJob.status.ilike(term)
            | ParseJob.parser_id.ilike(term)
            | ParsingPlan.selected_parser_id.ilike(term)
            | ParsedAsset.parser_used.ilike(term)
        )
    if status_filter and status_filter != "all":
        if status_filter == "completed":
            query = query.filter(ParseJob.status == JobStatus.COMPLETE.value)
        elif status_filter == "review_required":
            query = query.filter(ParseJob.status == JobStatus.REVIEW_REQUIRED.value)
        elif status_filter == "running":
            query = query.filter(ParseJob.status.in_([JobStatus.RUNNING.value, JobStatus.PLANNING.value]))
        elif status_filter == "queued":
            query = query.filter(ParseJob.status.in_([JobStatus.QUEUED.value, JobStatus.REGISTERED.value]))
        else:
            query = query.filter(ParseJob.status == status_filter)
    if file_type and file_type != "all":
        query = query.filter(FileRecord.file_type == file_type)
    if parser and parser != "all":
        query = query.filter(
            (ParseJob.parser_id == parser)
            | (ParsingPlan.selected_parser_id == parser)
            | (ParsedAsset.parser_used == parser)
        )
    if review_required:
        query = query.filter(
            (ParseJob.status == JobStatus.REVIEW_REQUIRED.value)
            | (QualityReport.human_review_required.is_(True))
        )
    if date_range and date_range != "all":
        now = datetime.now(UTC)
        if date_range == "today":
            since = datetime.combine(now.date(), datetime.min.time(), tzinfo=UTC)
        elif date_range == "7d":
            since = now - timedelta(days=7)
        elif date_range == "30d":
            since = now - timedelta(days=30)
        else:
            since = None
        if since is not None:
            query = query.filter(ParseJob.created_at >= since)
    return query


def _latest_quality(db: Session, job_id: str) -> QualityReport | None:
    return (
        db.query(QualityReport)
        .filter(QualityReport.job_id == job_id)
        .order_by(QualityReport.created_at.desc())
        .first()
    )


def _quality_target_from_plan(plan: ParsingPlan | None) -> QualityTarget:
    raw = plan.human_review_policy.get("quality_target") if plan else None
    try:
        return QualityTarget(str(raw))
    except ValueError:
        return QualityTarget.BALANCED


def _cost_profile_from_plan(plan: ParsingPlan | None) -> CostProfile:
    raw = plan.cost_profile.get("profile") if plan else None
    try:
        return CostProfile(str(raw))
    except ValueError:
        return CostProfile.BALANCED
