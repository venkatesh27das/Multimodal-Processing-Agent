from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.schemas.search import SearchResponse
from backend.app.services.search import global_search_service

router = APIRouter(prefix="/search")


@router.get("", response_model=SearchResponse)
def search_workspace(
    q: str = Query(default="", max_length=200),
    types: list[str] | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
) -> SearchResponse:
    return global_search_service.search(db, query=q, types=types, limit=limit)
