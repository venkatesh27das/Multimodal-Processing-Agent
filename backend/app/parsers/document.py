from backend.app.domain.enums import CostLevel, FileType, LatencyLevel, Modality
from backend.app.parsers.base import BaseParser, ParseRequest, ParseResult, ParserMetadata


class PdfNativeParser(BaseParser):
    metadata = ParserMetadata(
        parser_id="pdf_native_text",
        name="PDF Native Text Parser",
        supported_file_types=[FileType.PDF],
        supported_modalities=[Modality.DOCUMENT, Modality.TEXT],
        cost_level=CostLevel.LOW,
        latency_level=LatencyLevel.LOW,
        expected_quality=0.78,
        version="0.1.0",
        enabled=True,
    )

    def parse(self, request: ParseRequest) -> ParseResult:
        preview = self._read_text_preview(request)
        return ParseResult(
            parser_id=self.parser_id,
            parsed_text=preview or f"Mock PDF native text extracted from {request.filename}.",
            structured_data={"source": "pdf_native_text", "file_id": request.file_id},
            confidence_score=0.72 if preview else 0.55,
            warnings=[]
            if preview
            else ["Mock PDF extraction used; no real PDF dependency configured."],
        )


class DocxParser(BaseParser):
    metadata = ParserMetadata(
        parser_id="docx_text",
        name="DOCX Parser",
        supported_file_types=[FileType.DOCX],
        supported_modalities=[Modality.DOCUMENT, Modality.TEXT],
        cost_level=CostLevel.LOW,
        latency_level=LatencyLevel.LOW,
        expected_quality=0.76,
        version="0.1.0",
        enabled=True,
    )

    def parse(self, request: ParseRequest) -> ParseResult:
        preview = self._read_text_preview(request)
        return ParseResult(
            parser_id=self.parser_id,
            parsed_text=preview or f"Mock DOCX text extracted from {request.filename}.",
            structured_data={"source": "docx_text", "file_id": request.file_id},
            confidence_score=0.7 if preview else 0.55,
            warnings=[] if preview else ["Mock DOCX extraction used; python-docx not wired yet."],
        )


class HtmlParser(BaseParser):
    metadata = ParserMetadata(
        parser_id="html_text",
        name="HTML Parser",
        supported_file_types=[FileType.HTML],
        supported_modalities=[Modality.DOCUMENT, Modality.TEXT],
        cost_level=CostLevel.LOW,
        latency_level=LatencyLevel.LOW,
        expected_quality=0.74,
        version="0.1.0",
        enabled=True,
    )

    def parse(self, request: ParseRequest) -> ParseResult:
        preview = self._read_text_preview(request)
        stripped = preview.replace("<", " <").replace(">", "> ")
        return ParseResult(
            parser_id=self.parser_id,
            parsed_text=stripped or f"Mock HTML text extracted from {request.filename}.",
            structured_data={"source": "html_text", "file_id": request.file_id},
            confidence_score=0.68 if preview else 0.5,
            warnings=[]
            if preview
            else ["Mock HTML extraction used; readability parser not wired yet."],
        )
