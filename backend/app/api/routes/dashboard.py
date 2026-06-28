from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.models.job import ParseJob
from backend.app.schemas.common import APIModel
from backend.app.services.observability import observability_service

router = APIRouter(prefix="/dashboard")
review_router = APIRouter(prefix="/review")


class DashboardSummaryResponse(APIModel):
    jobs_today: int
    success_rate: float
    review_required: int
    avg_quality: float | None


class ReviewSummaryResponse(APIModel):
    pending_review: int
    review_required: int
    count: int


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)) -> DashboardSummaryResponse:
    summary = observability_service.summary(db)
    quality = observability_service.quality(db)
    today = datetime.now(UTC).date()
    jobs_today = sum(1 for job in db.query(ParseJob).all() if job.created_at.date() == today)
    return DashboardSummaryResponse(
        jobs_today=jobs_today,
        success_rate=summary.jobs.success_rate,
        review_required=summary.jobs.review_required_jobs,
        avg_quality=quality.average_quality,
    )


@review_router.get("/summary", response_model=ReviewSummaryResponse)
def get_review_summary(db: Session = Depends(get_db)) -> ReviewSummaryResponse:
    summary = observability_service.summary(db)
    return ReviewSummaryResponse(
        pending_review=summary.review.count,
        review_required=summary.jobs.review_required_jobs,
        count=summary.review.count,
    )
