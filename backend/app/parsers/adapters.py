from backend.app.domain.enums import CostLevel, FileType, LatencyLevel, Modality
from backend.app.parsers.base import BaseParser, ParseRequest, ParseResult, ParserMetadata


class AzureDocumentIntelligenceAdapter(BaseParser):
    metadata = ParserMetadata(
        parser_id="azure_document_intelligence",
        name="Azure Document Intelligence Adapter",
        supported_file_types=[FileType.PDF, FileType.IMAGE],
        supported_modalities=[Modality.DOCUMENT, Modality.TEXT, Modality.IMAGE, Modality.TABLE],
        cost_level=CostLevel.HIGH,
        latency_level=LatencyLevel.MEDIUM,
        expected_quality=0.84,
        version="0.1.0",
        enabled=True,
    )

    def parse(self, request: ParseRequest) -> ParseResult:
        return ParseResult(
            parser_id=self.parser_id,
            parsed_text=f"Mock Azure Document Intelligence output for {request.filename}.",
            structured_data={"source": "azure_document_intelligence", "tables": []},
            confidence_score=0.5,
            warnings=["Mock Azure adapter used; credentials and SDK are not configured."],
        )


class TesseractAdapter(BaseParser):
    metadata = ParserMetadata(
        parser_id="tesseract_ocr",
        name="Tesseract OCR Adapter",
        supported_file_types=[FileType.IMAGE, FileType.PDF],
        supported_modalities=[Modality.IMAGE, Modality.TEXT],
        cost_level=CostLevel.LOW,
        latency_level=LatencyLevel.MEDIUM,
        expected_quality=0.64,
        version="0.1.0",
        enabled=True,
    )

    def parse(self, request: ParseRequest) -> ParseResult:
        return ParseResult(
            parser_id=self.parser_id,
            parsed_text=f"Mock Tesseract OCR output for {request.filename}.",
            structured_data={"source": "tesseract_ocr", "file_id": request.file_id},
            confidence_score=0.42,
            warnings=["Mock Tesseract adapter used; tesseract binary is not configured."],
        )


class MockVlmParser(BaseParser):
    metadata = ParserMetadata(
        parser_id="mock_vlm",
        name="Mock VLM Parser",
        supported_file_types=[FileType.PDF, FileType.IMAGE, FileType.VIDEO],
        supported_modalities=[Modality.DOCUMENT, Modality.IMAGE, Modality.VIDEO, Modality.TEXT],
        cost_level=CostLevel.HIGH,
        latency_level=LatencyLevel.HIGH,
        expected_quality=0.7,
        version="0.1.0",
        enabled=True,
    )

    def parse(self, request: ParseRequest) -> ParseResult:
        return ParseResult(
            parser_id=self.parser_id,
            parsed_text=f"Mock multimodal reasoning output for {request.filename}.",
            structured_data={
                "source": "mock_vlm",
                "file_id": request.file_id,
                "observations": [],
            },
            confidence_score=0.48,
            warnings=["Mock VLM parser used; no external model call performed."],
        )
