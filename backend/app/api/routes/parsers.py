from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.models.domain import ParserDefinition
from backend.app.schemas.domain import ParserDefinitionRead

router = APIRouter(prefix="/parser-registry")


@router.get("", response_model=list[ParserDefinitionRead])
def list_parsers(db: Session = Depends(get_db)) -> list[ParserDefinitionRead]:
    return db.query(ParserDefinition).order_by(ParserDefinition.name.asc()).all()


@router.get("/{parser_id}", response_model=ParserDefinitionRead)
def get_parser(parser_id: str, db: Session = Depends(get_db)) -> ParserDefinitionRead:
    parser = db.get(ParserDefinition, parser_id)
    if parser is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parser not found")
    return parser
