from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.models.domain import AuditEvent
from backend.app.schemas.domain import AuditEventRead
from backend.app.schemas.observability import (
    AuditEventsResponse,
    ObservabilitySummary,
    ParserUsageMetric,
    QualityMetrics,
)
from backend.app.services.observability import observability_service

observability_router = APIRouter(prefix="/observability")
audit_router = APIRouter(prefix="/audit")


@observability_router.get("/summary", response_model=ObservabilitySummary)
def get_observability_summary(db: Session = Depends(get_db)) -> ObservabilitySummary:
    return observability_service.summary(db)


@observability_router.get("/parser-usage", response_model=list[ParserUsageMetric])
def get_parser_usage(db: Session = Depends(get_db)) -> list[ParserUsageMetric]:
    return observability_service.parser_usage(db)


@observability_router.get("/quality", response_model=QualityMetrics)
def get_quality_metrics(db: Session = Depends(get_db)) -> QualityMetrics:
    return observability_service.quality(db)


@audit_router.get("/events", response_model=AuditEventsResponse)
def get_audit_events(
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=250),
) -> AuditEventsResponse:
    events = (
        db.query(AuditEvent)
        .order_by(AuditEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    return AuditEventsResponse(
        events=[AuditEventRead.model_validate(event) for event in events]
    )
