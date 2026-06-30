import base64
import mimetypes
from pathlib import Path

from backend.app.core.config import settings
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
        version="0.2.0",
        enabled=True,
    )

    def parse(self, request: ParseRequest) -> ParseResult:
        if not request.storage_path:
            return ParseResult(
                parser_id=self.parser_id,
                parsed_text=None,
                structured_data={"source": "tesseract_ocr", "file_id": request.file_id},
                confidence_score=0.2,
                warnings=["No storage path was provided for Tesseract OCR."],
            )

        try:
            import pytesseract  # type: ignore[import-not-found]
            from PIL import Image

            if settings.tesseract_cmd:
                pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

            path = Path(request.storage_path)
            page_texts: list[str] = []
            image_descriptions: list[dict[str, object]] = []

            if request.file_type == FileType.PDF:
                try:
                    import fitz  # type: ignore[import-not-found]

                    with fitz.open(path) as document:
                        for page_index, page in enumerate(document):
                            pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                            image = Image.frombytes(
                                "RGB",
                                [pixmap.width, pixmap.height],
                                pixmap.samples,
                            )
                            text = pytesseract.image_to_string(image).strip()
                            if text:
                                page_texts.append(text)
                            image_descriptions.append(
                                {
                                    "image_id": f"page-{page_index + 1}",
                                    "page": page_index + 1,
                                    "width": pixmap.width,
                                    "height": pixmap.height,
                                    "description": "Rendered PDF page processed by Tesseract.",
                                }
                            )
                except ImportError:
                    return ParseResult(
                        parser_id=self.parser_id,
                        parsed_text=None,
                        structured_data={"source": "tesseract_ocr", "file_id": request.file_id},
                        confidence_score=0.18,
                        warnings=["PyMuPDF is required for PDF OCR rendering."],
                    )
            else:
                with Image.open(path) as image:
                    text = pytesseract.image_to_string(image).strip()
                    if text:
                        page_texts.append(text)
                    width, height = image.size
                    image_descriptions.append(
                        {
                            "image_id": "image-0",
                            "width": width,
                            "height": height,
                            "description": "Image processed by Tesseract.",
                        }
                    )

            parsed_text = "\n\n".join(page_texts).strip()
            return ParseResult(
                parser_id=self.parser_id,
                parsed_text=parsed_text,
                image_descriptions=image_descriptions,
                structured_data={
                    "source": "tesseract_ocr",
                    "file_id": request.file_id,
                    "engine": "tesseract",
                    "page_count": len(image_descriptions),
                },
                confidence_score=0.7 if parsed_text else 0.28,
                warnings=[] if parsed_text else ["Tesseract OCR returned no text."],
            )
        except ImportError:
            return ParseResult(
                parser_id=self.parser_id,
                parsed_text=None,
                structured_data={"source": "tesseract_ocr", "file_id": request.file_id},
                confidence_score=0.18,
                warnings=["pytesseract and Pillow are required for local OCR."],
            )
        except Exception as exc:
            return ParseResult(
                parser_id=self.parser_id,
                parsed_text=None,
                structured_data={"source": "tesseract_ocr", "file_id": request.file_id},
                confidence_score=0.0,
                warnings=[f"Tesseract OCR failed: {exc}"],
            )


class MockVlmParser(BaseParser):
    metadata = ParserMetadata(
        parser_id="mock_vlm",
        name="LM Studio VLM Parser",
        supported_file_types=[FileType.PDF, FileType.IMAGE, FileType.VIDEO],
        supported_modalities=[Modality.DOCUMENT, Modality.IMAGE, Modality.VIDEO, Modality.TEXT],
        cost_level=CostLevel.HIGH,
        latency_level=LatencyLevel.HIGH,
        expected_quality=0.7,
        version="0.2.0",
        enabled=True,
    )

    def parse(self, request: ParseRequest) -> ParseResult:
        if not settings.lm_studio_enabled:
            return ParseResult(
                parser_id=self.parser_id,
                parsed_text=(
                    "Local VLM is disabled; "
                    f"no LM Studio call was made for {request.filename}."
                ),
                structured_data={
                    "source": "lm_studio_vlm",
                    "file_id": request.file_id,
                    "enabled": False,
                },
                confidence_score=0.25,
                warnings=["Set LM_STUDIO_ENABLED=true to call the local VLM endpoint."],
            )

        if not request.storage_path:
            return ParseResult(
                parser_id=self.parser_id,
                parsed_text=None,
                structured_data={"source": "lm_studio_vlm", "file_id": request.file_id},
                confidence_score=0.1,
                warnings=["No storage path was provided for VLM parsing."],
            )

        image_payloads, image_warnings = self._image_payloads(request)
        if not image_payloads:
            return ParseResult(
                parser_id=self.parser_id,
                parsed_text=None,
                structured_data={"source": "lm_studio_vlm", "file_id": request.file_id},
                confidence_score=0.12,
                warnings=image_warnings or ["No image payload could be prepared for VLM parsing."],
            )

        prompt = (
            "You are a local document parsing engine. Extract visible text, key fields, "
            "tables, and layout observations from the supplied file images. Return concise "
            "plain text followed by structured observations when useful."
        )
        content: list[dict[str, object]] = [{"type": "text", "text": prompt}]
        content.extend(image_payloads)
        payload = {
            "model": settings.lm_studio_vlm_model,
            "messages": [{"role": "user", "content": content}],
            "temperature": 0.0,
        }

        try:
            import httpx

            response = httpx.post(
                f"{settings.lm_studio_base_url.rstrip('/')}/chat/completions",
                json=payload,
                timeout=settings.lm_studio_timeout_seconds,
            )
            response.raise_for_status()
            data = response.json()
            parsed_text = (
                data.get("choices", [{}])[0].get("message", {}).get("content")
                if isinstance(data, dict)
                else None
            )
            parsed_text = parsed_text if isinstance(parsed_text, str) else None
            tables = self._markdown_tables(parsed_text)
            return ParseResult(
                parser_id=self.parser_id,
                parsed_text=parsed_text,
                tables=tables,
                image_descriptions=[
                    {
                        "image_id": f"vlm-input-{index}",
                        "description": "Image sent to LM Studio VLM.",
                    }
                    for index in range(len(image_payloads))
                ],
                structured_data={
                    "source": "lm_studio_vlm",
                    "file_id": request.file_id,
                    "model": settings.lm_studio_vlm_model,
                    "image_count": len(image_payloads),
                    "table_count": len(tables),
                },
                confidence_score=0.76 if parsed_text else 0.3,
                warnings=image_warnings + ([] if parsed_text else ["LM Studio returned no text."]),
            )
        except Exception as exc:
            return ParseResult(
                parser_id=self.parser_id,
                parsed_text=None,
                structured_data={
                    "source": "lm_studio_vlm",
                    "file_id": request.file_id,
                    "model": settings.lm_studio_vlm_model,
                },
                confidence_score=0.0,
                warnings=image_warnings + [f"LM Studio VLM call failed: {exc}"],
            )

    def _image_payloads(self, request: ParseRequest) -> tuple[list[dict[str, object]], list[str]]:
        path = Path(request.storage_path or "")
        warnings: list[str] = []
        if not path.exists():
            return [], [f"File not found: {path}"]

        if request.file_type == FileType.IMAGE:
            return [self._image_url_payload(path)], warnings

        if request.file_type == FileType.PDF:
            try:
                import fitz  # type: ignore[import-not-found]

                payloads: list[dict[str, object]] = []
                with fitz.open(path) as document:
                    page_limit = min(document.page_count, settings.lm_studio_max_pdf_pages)
                    for page_index in range(page_limit):
                        page = document[page_index]
                        pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                        payloads.append(self._data_url_payload(pixmap.tobytes("png"), "image/png"))
                    if document.page_count > page_limit:
                        warnings.append(
                            f"Only the first {page_limit} pages were sent to LM Studio."
                        )
                return payloads, warnings
            except ImportError:
                return [], ["PyMuPDF is required to render PDF pages for LM Studio VLM."]
            except Exception as exc:
                return [], [f"PDF rendering for LM Studio failed: {exc}"]

        return [], [f"VLM image preparation is not implemented for {request.file_type}."]

    def _image_url_payload(self, path: Path) -> dict[str, object]:
        mime_type = mimetypes.guess_type(path.name)[0] or "image/png"
        return self._data_url_payload(path.read_bytes(), mime_type)

    def _markdown_tables(self, text: str | None) -> list[dict[str, object]]:
        if not text:
            return []

        tables: list[dict[str, object]] = []
        current: list[str] = []
        for line in text.splitlines():
            stripped = line.strip()
            if stripped.startswith("|") and stripped.endswith("|") and stripped.count("|") >= 2:
                current.append(stripped)
                continue
            if current:
                self._append_markdown_table(tables, current)
                current = []
        if current:
            self._append_markdown_table(tables, current)
        return tables

    def _append_markdown_table(
        self,
        tables: list[dict[str, object]],
        lines: list[str],
    ) -> None:
        rows: list[list[str]] = []
        for line in lines:
            cells = [cell.strip() for cell in line.strip("|").split("|")]
            if not cells or self._is_markdown_separator(cells):
                continue
            rows.append(cells)
        if len(rows) < 2:
            return
        tables.append(
            {
                "table_id": f"vlm-table-{len(tables)}",
                "rows": rows,
                "source": "lm_studio_vlm_markdown",
                "confidence": 0.7,
            }
        )

    def _is_markdown_separator(self, cells: list[str]) -> bool:
        return all(cell and set(cell) <= {"-", ":"} for cell in cells)

    def _data_url_payload(self, data: bytes, mime_type: str) -> dict[str, object]:
        encoded = base64.b64encode(data).decode("ascii")
        return {
            "type": "image_url",
            "image_url": {"url": f"data:{mime_type};base64,{encoded}"},
        }
