from datetime import datetime

from backend.app.schemas.common import APIModel


class SearchResult(APIModel):
    id: str
    type: str
    title: str
    subtitle: str | None = None
    status: str | None = None
    href: str
    score: float
    metadata: dict[str, object]
    created_at: datetime | None = None


class SearchResponse(APIModel):
    query: str
    total: int
    results: list[SearchResult]
