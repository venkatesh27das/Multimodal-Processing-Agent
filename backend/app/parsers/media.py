from backend.app.domain.enums import CostLevel, FileType, LatencyLevel, Modality
from backend.app.parsers.base import BaseParser, ParseRequest, ParseResult, ParserMetadata


class ImageOcrParser(BaseParser):
    metadata = ParserMetadata(
        parser_id="image_ocr",
        name="Image OCR Parser",
        supported_file_types=[FileType.IMAGE],
        supported_modalities=[Modality.IMAGE, Modality.TEXT],
        cost_level=CostLevel.MEDIUM,
        latency_level=LatencyLevel.MEDIUM,
        expected_quality=0.62,
        version="0.1.0",
        enabled=True,
    )

    def parse(self, request: ParseRequest) -> ParseResult:
        return ParseResult(
            parser_id=self.parser_id,
            parsed_text=f"Mock OCR text extracted from image {request.filename}.",
            structured_data={"source": "image_ocr", "file_id": request.file_id},
            confidence_score=0.45,
            warnings=["Mock OCR used; no OCR engine configured."],
        )


class AudioParser(BaseParser):
    metadata = ParserMetadata(
        parser_id="audio_transcription",
        name="Audio Parser",
        supported_file_types=[FileType.AUDIO],
        supported_modalities=[Modality.AUDIO, Modality.TEXT],
        cost_level=CostLevel.MEDIUM,
        latency_level=LatencyLevel.HIGH,
        expected_quality=0.58,
        version="0.1.0",
        enabled=True,
    )

    def parse(self, request: ParseRequest) -> ParseResult:
        return ParseResult(
            parser_id=self.parser_id,
            parsed_text=f"Mock transcript generated for audio file {request.filename}.",
            structured_data={"source": "audio_transcription", "file_id": request.file_id},
            confidence_score=0.4,
            warnings=["Mock audio transcription used; speech dependency not configured."],
        )


class VideoParser(BaseParser):
    metadata = ParserMetadata(
        parser_id="video_parser",
        name="Video Parser",
        supported_file_types=[FileType.VIDEO],
        supported_modalities=[Modality.VIDEO, Modality.AUDIO, Modality.IMAGE],
        cost_level=CostLevel.HIGH,
        latency_level=LatencyLevel.HIGH,
        expected_quality=0.52,
        version="0.1.0",
        enabled=True,
    )

    def parse(self, request: ParseRequest) -> ParseResult:
        return ParseResult(
            parser_id=self.parser_id,
            parsed_text=f"Mock video summary generated for {request.filename}.",
            structured_data={
                "source": "video_parser",
                "file_id": request.file_id,
                "segments": [],
            },
            confidence_score=0.35,
            warnings=["Mock video parsing used; media pipeline not configured."],
        )

