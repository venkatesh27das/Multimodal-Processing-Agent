from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.domain.enums import JobStatus, QualityStatus
from backend.app.models.domain import FileProfile, ParsedAsset, ParsingPlan, QualityReport
from backend.app.models.file import FileRecord
from backend.app.models.job import ParseJob
from backend.app.schemas.domain import (
    ParsedAssetRead,
    ParseJobRead,
    ParseJobRunResponse,
    ParserSelectionRequest,
    ParserSelectionResponse,
    ParsingPlanRead,
    QualityReportRead,
)
from backend.app.schemas.jobs import ParseJobCreate, ParseJobResponse
from backend.app.services.orchestration_engine import orchestration_engine
from backend.app.services.parser_selector import parser_selector

router = APIRouter(prefix="/parse-jobs")
planning_router = APIRouter(prefix="/jobs")


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


@planning_router.get("", response_model=list[ParseJobRead])
def list_jobs(db: Session = Depends(get_db)) -> list[ParseJobRead]:
    return db.query(ParseJob).order_by(ParseJob.created_at.desc()).all()


@planning_router.get("/{job_id}", response_model=ParseJobRead)
def get_job(job_id: str, db: Session = Depends(get_db)) -> ParseJobRead:
    job = db.get(ParseJob, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


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
