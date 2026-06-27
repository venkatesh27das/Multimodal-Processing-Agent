from sqlalchemy.orm import Session

from backend.app.domain.enums import DeploymentMode, FileType, Modality, ParserType
from backend.app.models.domain import FileProfile, ParserDefinition
from backend.app.parsers import (
    AudioParser,
    AzureDocumentIntelligenceAdapter,
    BaseParser,
    DocxParser,
    HtmlParser,
    ImageOcrParser,
    MockVlmParser,
    PdfNativeParser,
    TesseractAdapter,
    VideoParser,
)
from backend.app.parsers.base import ParserMetadata

PARSER_DESCRIPTORS: dict[str, dict[str, object]] = {
    "pdf_native_text": {
        "parser_type": ParserType.DETERMINISTIC,
        "deployment_mode": DeploymentMode.LOCAL,
        "quality_level": "high",
        "strengths": ["Fast local extraction for PDFs with native text layers via PyMuPDF"],
        "weaknesses": ["Poor fit for scanned PDFs without OCR/VLM fallback"],
    },
    "docx_text": {
        "parser_type": ParserType.DETERMINISTIC,
        "deployment_mode": DeploymentMode.LOCAL,
        "quality_level": "high",
        "strengths": ["Local DOCX paragraph and table extraction via python-docx"],
        "weaknesses": ["Legacy .doc and complex embedded media support pending"],
    },
    "html_text": {
        "parser_type": ParserType.DETERMINISTIC,
        "deployment_mode": DeploymentMode.LOCAL,
        "quality_level": "high",
        "strengths": ["Local clean text, table, and image metadata extraction via BeautifulSoup"],
        "weaknesses": ["Advanced readability and boilerplate scoring are not wired yet"],
    },
    "image_ocr": {
        "parser_type": ParserType.OCR,
        "deployment_mode": DeploymentMode.LOCAL,
        "quality_level": "medium",
        "strengths": ["Local image OCR via pytesseract when Tesseract is installed"],
        "weaknesses": ["Requires the system tesseract binary for real OCR"],
    },
    "audio_transcription": {
        "parser_type": ParserType.SPEECH,
        "deployment_mode": DeploymentMode.LOCAL,
        "quality_level": "placeholder",
        "strengths": ["Audio transcription placeholder"],
        "weaknesses": ["No speech model configured yet"],
    },
    "video_parser": {
        "parser_type": ParserType.VIDEO,
        "deployment_mode": DeploymentMode.LOCAL,
        "quality_level": "placeholder",
        "strengths": ["Video parsing placeholder for audio and visual tracks"],
        "weaknesses": ["No media pipeline configured yet"],
    },
    "azure_document_intelligence": {
        "parser_type": ParserType.EXTERNAL,
        "deployment_mode": DeploymentMode.EXTERNAL,
        "quality_level": "high",
        "strengths": ["Managed layout, OCR, and table extraction"],
        "weaknesses": ["Requires external credentials and managed service cost"],
    },
    "tesseract_ocr": {
        "parser_type": ParserType.OCR,
        "deployment_mode": DeploymentMode.LOCAL,
        "quality_level": "medium",
        "strengths": ["Local OCR for images and rendered PDF pages"],
        "weaknesses": ["Requires PyMuPDF for PDF rendering and Tesseract for OCR"],
    },
    "mock_vlm": {
        "parser_type": ParserType.VLM,
        "deployment_mode": DeploymentMode.LOCAL,
        "quality_level": "medium",
        "strengths": ["Calls a local LM Studio OpenAI-compatible VLM endpoint"],
        "weaknesses": ["Requires LM Studio VLM server and image-capable model"],
    },
}


def parser_definition_payload(metadata: ParserMetadata) -> dict[str, object]:
    descriptor = PARSER_DESCRIPTORS[metadata.parser_id]
    return {
        "parser_id": metadata.parser_id,
        "name": metadata.name,
        "parser_type": descriptor["parser_type"].value,
        "supported_file_types": [file_type.value for file_type in metadata.supported_file_types],
        "supported_modalities": [modality.value for modality in metadata.supported_modalities],
        "strengths": descriptor["strengths"],
        "weaknesses": descriptor["weaknesses"],
        "cost_level": metadata.cost_level.value,
        "latency_level": metadata.latency_level.value,
        "expected_quality": metadata.expected_quality,
        "quality_level": descriptor["quality_level"],
        "deployment_mode": descriptor["deployment_mode"].value,
        "enabled": metadata.enabled,
        "version": metadata.version,
    }


class ParserRegistry:
    def __init__(self, parsers: list[BaseParser] | None = None) -> None:
        parser_instances = parsers or [
            PdfNativeParser(),
            DocxParser(),
            HtmlParser(),
            ImageOcrParser(),
            AudioParser(),
            VideoParser(),
            AzureDocumentIntelligenceAdapter(),
            TesseractAdapter(),
            MockVlmParser(),
        ]
        self._parsers = {parser.parser_id: parser for parser in parser_instances}

    def metadata_payloads(self) -> list[dict[str, object]]:
        return [parser_definition_payload(parser.metadata) for parser in self._parsers.values()]

    def list_parsers(self, db: Session, *, include_disabled: bool = True) -> list[ParserDefinition]:
        query = db.query(ParserDefinition).order_by(ParserDefinition.name.asc())
        if not include_disabled:
            query = query.filter(ParserDefinition.enabled.is_(True))
        return query.all()

    def get_parser(self, db: Session, parser_id: str) -> ParserDefinition | None:
        return db.get(ParserDefinition, parser_id)

    def get_parser_instance(self, parser_id: str) -> BaseParser | None:
        return self._parsers.get(parser_id)

    def find_candidate_parsers(
        self,
        db: Session,
        file_profile: FileProfile,
    ) -> list[ParserDefinition]:
        file_type = FileType(file_profile.file_type)
        modalities = [Modality(modality) for modality in file_profile.modalities]
        parser_ids = [
            parser.parser_id
            for parser in self._parsers.values()
            if parser.supports(file_type=file_type, modalities=modalities)
        ]
        if not parser_ids:
            return []

        return (
            db.query(ParserDefinition)
            .filter(ParserDefinition.parser_id.in_(parser_ids))
            .filter(ParserDefinition.enabled.is_(True))
            .order_by(ParserDefinition.expected_quality.desc(), ParserDefinition.name.asc())
            .all()
        )

    def enable_parser(self, db: Session, parser_id: str) -> ParserDefinition | None:
        parser = db.get(ParserDefinition, parser_id)
        if parser is None:
            return None

        parser.enabled = True
        db.commit()
        db.refresh(parser)
        return parser

    def disable_parser(self, db: Session, parser_id: str) -> ParserDefinition | None:
        parser = db.get(ParserDefinition, parser_id)
        if parser is None:
            return None

        parser.enabled = False
        db.commit()
        db.refresh(parser)
        return parser


parser_registry = ParserRegistry()
