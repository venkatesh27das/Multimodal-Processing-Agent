from sqlalchemy.orm import Session

from backend.app.domain.enums import (
    CostLevel,
    DeploymentMode,
    FileType,
    LatencyLevel,
    Modality,
    ParserType,
)
from backend.app.models.domain import ParserDefinition, SkillDefinition

PARSER_SEEDS = [
    {
        "parser_id": "pdf_native_text",
        "name": "PDF Native Text Parser",
        "parser_type": ParserType.DETERMINISTIC.value,
        "supported_file_types": [FileType.PDF.value],
        "supported_modalities": [Modality.DOCUMENT.value, Modality.TEXT.value],
        "strengths": ["Fast deterministic extraction for PDFs with text layers"],
        "weaknesses": ["Poor fit for scanned or image-heavy PDFs"],
        "cost_level": CostLevel.LOW.value,
        "latency_level": LatencyLevel.LOW.value,
        "quality_level": "medium",
        "deployment_mode": DeploymentMode.LOCAL.value,
        "enabled": True,
        "version": "0.1.0",
    },
    {
        "parser_id": "docx_text",
        "name": "DOCX Parser",
        "parser_type": ParserType.DETERMINISTIC.value,
        "supported_file_types": [FileType.DOCX.value],
        "supported_modalities": [Modality.DOCUMENT.value, Modality.TEXT.value],
        "strengths": ["Structured document text extraction"],
        "weaknesses": ["Complex embedded media support pending"],
        "cost_level": CostLevel.LOW.value,
        "latency_level": LatencyLevel.LOW.value,
        "quality_level": "medium",
        "deployment_mode": DeploymentMode.LOCAL.value,
        "enabled": True,
        "version": "0.1.0",
    },
    {
        "parser_id": "mock_vlm",
        "name": "Mock VLM Parser",
        "parser_type": ParserType.VLM.value,
        "supported_file_types": [FileType.PDF.value, FileType.IMAGE.value],
        "supported_modalities": [Modality.DOCUMENT.value, Modality.IMAGE.value],
        "strengths": ["Placeholder for multimodal reasoning workflows"],
        "weaknesses": ["No real parsing implemented yet"],
        "cost_level": CostLevel.HIGH.value,
        "latency_level": LatencyLevel.HIGH.value,
        "quality_level": "placeholder",
        "deployment_mode": DeploymentMode.EXTERNAL.value,
        "enabled": False,
        "version": "0.1.0",
    },
]


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
    for payload in PARSER_SEEDS:
        if db.get(ParserDefinition, payload["parser_id"]) is None:
            db.add(ParserDefinition(**payload))

    for payload in SKILL_SEEDS:
        if db.get(SkillDefinition, payload["skill_id"]) is None:
            db.add(SkillDefinition(**payload))

    db.commit()
