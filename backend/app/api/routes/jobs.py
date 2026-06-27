from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.domain.enums import JobStatus, QualityStatus
from backend.app.models.file import FileRecord
from backend.app.models.job import ParseJob
from backend.app.schemas.jobs import ParseJobCreate, ParseJobResponse

router = APIRouter(prefix="/parse-jobs")


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
