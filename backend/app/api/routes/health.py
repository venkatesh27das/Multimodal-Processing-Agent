from datetime import UTC, datetime

from fastapi import APIRouter
from pydantic import BaseModel

from backend.app.core.config import settings

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    app_name: str
    version: str
    environment: str
    timestamp: datetime


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        app_name=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
        timestamp=datetime.now(UTC),
    )

