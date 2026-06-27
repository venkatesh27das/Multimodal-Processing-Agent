from fastapi import APIRouter, HTTPException, status

from backend.app.schemas.parsers import ParserDefinition
from backend.app.services.parser_registry import parser_registry

router = APIRouter(prefix="/parser-registry")


@router.get("", response_model=list[ParserDefinition])
def list_parsers() -> list[ParserDefinition]:
    return parser_registry.list_parsers()


@router.get("/{parser_id}", response_model=ParserDefinition)
def get_parser(parser_id: str) -> ParserDefinition:
    parser = parser_registry.get_parser(parser_id)
    if parser is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parser not found")
    return parser

