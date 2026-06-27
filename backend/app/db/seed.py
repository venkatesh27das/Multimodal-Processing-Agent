from sqlalchemy.orm import Session

from backend.app.domain.enums import (
    FileType,
)
from backend.app.models.domain import ParserDefinition, SkillDefinition
from backend.app.services.parser_registry import parser_registry

SKILL_SEEDS = [
    {
        "skill_id": "invoice_extraction",
        "name": "Invoice Extraction",
        "description": "Extract invoice numbers, vendors, totals, line items, and due dates.",
        "supported_document_types": [FileType.PDF.value, FileType.DOCX.value, FileType.IMAGE.value],
        "extraction_schema": {
            "type": "object",
            "required": ["invoice_number", "vendor_name", "total_amount"],
            "properties": {
                "invoice_number": {"type": "string"},
                "vendor_name": {"type": "string"},
                "total_amount": {"type": "number"},
            },
        },
        "validation_rules": {"total_amount": "must be non-negative"},
        "examples": [{"filename": "sample-invoice.pdf", "fields": ["invoice_number"]}],
        "post_processing_hook": None,
    },
    {
        "skill_id": "contract_parsing",
        "name": "Contract Parsing",
        "description": "Identify parties, effective dates, terms, obligations, and clauses.",
        "supported_document_types": [FileType.PDF.value, FileType.DOCX.value],
        "extraction_schema": {"type": "object", "properties": {"parties": {"type": "array"}}},
        "validation_rules": {"parties": "must include at least one party when detected"},
        "examples": [{"filename": "msa.docx", "fields": ["parties", "effective_date"]}],
        "post_processing_hook": None,
    },
    {
        "skill_id": "research_paper_parsing",
        "name": "Research Paper Parsing",
        "description": (
            "Extract title, authors, abstract, sections, citations, figures, and tables."
        ),
        "supported_document_types": [FileType.PDF.value, FileType.HTML.value],
        "extraction_schema": {"type": "object", "properties": {"abstract": {"type": "string"}}},
        "validation_rules": {"abstract": "recommended when available"},
        "examples": [{"filename": "paper.pdf", "fields": ["title", "abstract"]}],
        "post_processing_hook": None,
    },
    {
        "skill_id": "audio_meeting_parsing",
        "name": "Audio Meeting Parsing",
        "description": "Prepare transcripts for speaker turns, actions, decisions, and summaries.",
        "supported_document_types": [FileType.AUDIO.value, FileType.VIDEO.value],
        "extraction_schema": {"type": "object", "properties": {"action_items": {"type": "array"}}},
        "validation_rules": {"speaker_turns": "recommended for multi-speaker audio"},
        "examples": [{"filename": "meeting.mp3", "fields": ["action_items"]}],
        "post_processing_hook": None,
    },
    {
        "skill_id": "table_normalization",
        "name": "Table Normalization",
        "description": "Normalize extracted tables into typed rows, columns, and units.",
        "supported_document_types": [FileType.PDF.value, FileType.DOCX.value, FileType.HTML.value],
        "extraction_schema": {"type": "object", "properties": {"tables": {"type": "array"}}},
        "validation_rules": {"headers": "should be present for each table"},
        "examples": [{"filename": "report.pdf", "fields": ["tables"]}],
        "post_processing_hook": None,
    },
    {
        "skill_id": "knowledge_graph_preparation",
        "name": "Knowledge Graph Preparation",
        "description": "Prepare entities and relationships for graph-oriented publishing.",
        "supported_document_types": [FileType.PDF.value, FileType.DOCX.value, FileType.HTML.value],
        "extraction_schema": {"type": "object", "properties": {"entities": {"type": "array"}}},
        "validation_rules": {"relationships": "should reference known entities"},
        "examples": [{"filename": "brief.html", "fields": ["entities", "relationships"]}],
        "post_processing_hook": None,
    },
]


def seed_registry_data(db: Session) -> None:
    for payload in parser_registry.metadata_payloads():
        parser = db.get(ParserDefinition, payload["parser_id"])
        if parser is None:
            db.add(ParserDefinition(**payload))
        else:
            for key, value in payload.items():
                if key != "enabled":
                    setattr(parser, key, value)

    for payload in SKILL_SEEDS:
        if db.get(SkillDefinition, payload["skill_id"]) is None:
            db.add(SkillDefinition(**payload))

    db.commit()
