from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.models.domain import FileProfile
from backend.app.schemas.domain import ParserCandidateRequest, ParserDefinitionRead
from backend.app.schemas.observability import ParserUsageMetric
from backend.app.services.observability import observability_service
from backend.app.services.parser_registry import parser_registry

router = APIRouter(prefix="/parser-registry")
metrics_router = APIRouter(prefix="/parsers")


@router.get("", response_model=list[ParserDefinitionRead])
def list_parsers(db: Session = Depends(get_db)) -> list[ParserDefinitionRead]:
    return parser_registry.list_parsers(db)


@metrics_router.get("/metrics", response_model=list[ParserUsageMetric])
def get_parser_metrics(db: Session = Depends(get_db)) -> list[ParserUsageMetric]:
    return observability_service.parser_usage(db)


@router.post("/candidates", response_model=list[ParserDefinitionRead])
def find_candidate_parsers(
    payload: ParserCandidateRequest,
    db: Session = Depends(get_db),
) -> list[ParserDefinitionRead]:
    file_profile = FileProfile(
        file_id="candidate-preview",
        file_type=payload.file_type.value,
        modalities=[modality.value for modality in payload.modalities],
        has_text_layer=payload.has_text_layer,
        is_scanned=payload.is_scanned,
        page_count=payload.page_count,
        table_likelihood=payload.table_likelihood,
        image_likelihood=payload.image_likelihood,
        language=payload.language,
        layout_complexity=payload.layout_complexity,
    )
    return parser_registry.find_candidate_parsers(db, file_profile)


@router.post("/{parser_id}/enable", response_model=ParserDefinitionRead)
def enable_parser(parser_id: str, db: Session = Depends(get_db)) -> ParserDefinitionRead:
    parser = parser_registry.enable_parser(db, parser_id)
    if parser is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parser not found")
    return parser


@router.post("/{parser_id}/disable", response_model=ParserDefinitionRead)
def disable_parser(parser_id: str, db: Session = Depends(get_db)) -> ParserDefinitionRead:
    parser = parser_registry.disable_parser(db, parser_id)
    if parser is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parser not found")
    return parser


@router.get("/{parser_id}", response_model=ParserDefinitionRead)
def get_parser(parser_id: str, db: Session = Depends(get_db)) -> ParserDefinitionRead:
    parser = parser_registry.get_parser(db, parser_id)
    if parser is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parser not found")
    return parser
