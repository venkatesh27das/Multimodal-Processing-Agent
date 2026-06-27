from pathlib import Path

from backend.app.core.config import settings
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
        if request.storage_path:
            path = Path(request.storage_path)
            try:
                import pytesseract  # type: ignore[import-not-found]
                from PIL import Image

                if settings.tesseract_cmd:
                    pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

                with Image.open(path) as image:
                    text = pytesseract.image_to_string(image).strip()
                    width, height = image.size

                return ParseResult(
                    parser_id=self.parser_id,
                    parsed_text=text,
                    image_descriptions=[
                        {
                            "image_id": "image-0",
                            "width": width,
                            "height": height,
                            "description": "OCR was run against the uploaded image.",
                        }
                    ],
                    structured_data={
                        "source": "image_ocr",
                        "file_id": request.file_id,
                        "engine": "tesseract",
                        "width": width,
                        "height": height,
                    },
                    confidence_score=0.72 if text else 0.28,
                    warnings=[] if text else ["Tesseract OCR returned no text."],
                )
            except ImportError:
                try:
                    from PIL import Image

                    with Image.open(path) as image:
                        width, height = image.size
                    metadata = {"width": width, "height": height}
                except Exception:
                    metadata = {}

                return ParseResult(
                    parser_id=self.parser_id,
                    parsed_text=None,
                    image_descriptions=[
                        {
                            "image_id": "image-0",
                            **metadata,
                            "description": "Image metadata detected; OCR dependency is missing.",
                        }
                    ],
                    structured_data={
                        "source": "image_ocr",
                        "file_id": request.file_id,
                        "engine": "metadata_only",
                        **metadata,
                    },
                    confidence_score=0.22,
                    warnings=["pytesseract is not installed; real image OCR was skipped."],
                )
            except Exception as exc:
                return ParseResult(
                    parser_id=self.parser_id,
                    parsed_text=None,
                    structured_data={"source": "image_ocr", "file_id": request.file_id},
                    confidence_score=0.0,
                    warnings=[f"Image OCR failed: {exc}"],
                )

        return ParseResult(
            parser_id=self.parser_id,
            parsed_text=None,
            structured_data={"source": "image_ocr", "file_id": request.file_id},
            confidence_score=0.2,
            warnings=["No storage path was provided for image OCR."],
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
