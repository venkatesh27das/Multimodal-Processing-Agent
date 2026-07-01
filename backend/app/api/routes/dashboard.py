from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.domain.enums import ReviewStatus
from backend.app.models.domain import ReviewItem
from backend.app.models.job import ParseJob
from backend.app.schemas.common import APIModel
from backend.app.schemas.domain import ReviewItemRead
from backend.app.services.audit_logger import audit_logger
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


class ReviewDecisionRequest(APIModel):
    resolution_notes: str | None = None
    actor: str = "local-user"


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
    pending = (
        db.query(ReviewItem)
        .filter(ReviewItem.status.in_([ReviewStatus.OPEN.value, ReviewStatus.ASSIGNED.value]))
        .count()
    )
    return ReviewSummaryResponse(
        pending_review=pending,
        review_required=summary.jobs.review_required_jobs,
        count=pending,
    )


@review_router.get("/items", response_model=list[ReviewItemRead])
def list_review_items(
    job_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[ReviewItem]:
    query = db.query(ReviewItem)
    if job_id:
        query = query.filter(ReviewItem.job_id == job_id)
    return query.order_by(ReviewItem.created_at.desc()).all()


@review_router.get("/items/{review_item_id}", response_model=ReviewItemRead)
def get_review_item(review_item_id: str, db: Session = Depends(get_db)) -> ReviewItem:
    return _review_item_or_404(db, review_item_id)


@review_router.post("/items/{review_item_id}/approve", response_model=ReviewItemRead)
def approve_review_item(
    review_item_id: str,
    payload: ReviewDecisionRequest,
    db: Session = Depends(get_db),
) -> ReviewItem:
    return _resolve_review_item(
        db,
        review_item_id,
        status_value=ReviewStatus.RESOLVED.value,
        action="review_item_approved",
        notes=payload.resolution_notes or "Approved by reviewer.",
        actor=payload.actor,
    )


@review_router.post("/items/{review_item_id}/reject", response_model=ReviewItemRead)
def reject_review_item(
    review_item_id: str,
    payload: ReviewDecisionRequest,
    db: Session = Depends(get_db),
) -> ReviewItem:
    return _resolve_review_item(
        db,
        review_item_id,
        status_value=ReviewStatus.DISMISSED.value,
        action="review_item_rejected",
        notes=payload.resolution_notes or "Rejected by reviewer.",
        actor=payload.actor,
    )


def _resolve_review_item(
    db: Session,
    review_item_id: str,
    *,
    status_value: str,
    action: str,
    notes: str,
    actor: str,
) -> ReviewItem:
    review_item = _review_item_or_404(db, review_item_id)
    review_item.status = status_value
    review_item.resolution_notes = notes
    audit_logger.log(
        db,
        actor=actor,
        action=action,
        entity_type="review_item",
        entity_id=review_item.id,
        metadata={
            "job_id": review_item.job_id,
            "file_id": review_item.file_id,
            "quality_report_id": review_item.quality_report_id,
            "resolution_notes": notes,
        },
    )
    db.commit()
    db.refresh(review_item)
    return review_item


def _review_item_or_404(db: Session, review_item_id: str) -> ReviewItem:
    review_item = db.get(ReviewItem, review_item_id)
    if review_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review item not found",
        )
    return review_item
