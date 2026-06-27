from pathlib import Path

from backend.app.domain.enums import FileType, Modality
from backend.app.models.domain import FileProfile, FileRecord


class FileProfiler:
    def profile(self, file_record: FileRecord) -> FileProfile:
        file_type = FileType(file_record.file_type)
        path = Path(file_record.storage_path)

        if file_type == FileType.PDF:
            return self._profile_pdf(file_record, path)
        if file_type == FileType.DOCX:
            return self._profile_docx(file_record, path)
        if file_type == FileType.HTML:
            return self._profile_html(file_record, path)
        if file_type == FileType.IMAGE:
            return self._basic_profile(
                file_record,
                modalities=[Modality.IMAGE],
                has_text_layer=False,
                is_scanned=True,
                image_likelihood=0.95,
                layout_complexity="medium",
                strategy="Use OCR or vision parser; escalate to VLM for complex layouts.",
            )
        if file_type == FileType.AUDIO:
            return self._basic_profile(
                file_record,
                modalities=[Modality.AUDIO],
                has_text_layer=False,
                is_scanned=None,
                image_likelihood=0.0,
                layout_complexity="none",
                strategy="Use audio transcription parser.",
            )
        if file_type == FileType.VIDEO:
            return self._basic_profile(
                file_record,
                modalities=[Modality.VIDEO, Modality.AUDIO, Modality.IMAGE],
                has_text_layer=False,
                is_scanned=None,
                image_likelihood=0.8,
                layout_complexity="high",
                strategy="Use video parser with audio transcription and visual sampling.",
            )

        return self._basic_profile(
            file_record,
            modalities=[],
            has_text_layer=None,
            is_scanned=None,
            image_likelihood=None,
            layout_complexity="unknown",
            strategy="File type unknown; route to manual review or generic parser.",
        )

    def _profile_pdf(self, file_record: FileRecord, path: Path) -> FileProfile:
        page_count: int | None = None
        text_length = 0
        used_pymupdf = False

        try:
            import fitz  # type: ignore[import-not-found]

            used_pymupdf = True
            with fitz.open(path) as document:
                page_count = document.page_count
                for page in document:
                    text_length += len(page.get_text("text").strip())
        except Exception:
            page_count = None
            text_length = 0

        has_text_layer = text_length > 20 if used_pymupdf else None
        is_scanned = not has_text_layer if has_text_layer is not None else None
        layout_complexity = self._estimate_layout_complexity(
            page_count=page_count,
            table_likelihood=0.35,
            image_likelihood=0.45 if is_scanned else 0.25,
        )
        strategy = (
            "Use PDF native text parser first; fallback to OCR/VLM if quality is low."
            if has_text_layer
            else "Use OCR or document intelligence parser; native text layer was not detected."
        )
        if has_text_layer is None:
            strategy = "PyMuPDF unavailable or unreadable PDF; use conservative OCR-capable parser."

        return FileProfile(
            file_id=file_record.id,
            file_type=file_record.file_type,
            modalities=[Modality.DOCUMENT.value, Modality.TEXT.value],
            has_text_layer=has_text_layer,
            is_scanned=is_scanned,
            page_count=page_count,
            table_likelihood=0.35,
            image_likelihood=0.45 if is_scanned else 0.25,
            layout_complexity=layout_complexity,
            estimated_cost_class="medium" if is_scanned else "low",
            recommended_parsing_strategy=strategy,
        )

    def _profile_docx(self, file_record: FileRecord, path: Path) -> FileProfile:
        table_count = 0

        try:
            from docx import Document  # type: ignore[import-not-found]

            document = Document(path)
            table_count = len(document.tables)
        except Exception:
            table_count = 0

        table_likelihood = min(1.0, 0.2 + (table_count * 0.25))
        return FileProfile(
            file_id=file_record.id,
            file_type=file_record.file_type,
            modalities=[Modality.DOCUMENT.value, Modality.TEXT.value],
            has_text_layer=True,
            is_scanned=False,
            page_count=None,
            table_likelihood=table_likelihood,
            image_likelihood=0.2,
            layout_complexity="medium" if table_count else "low",
            estimated_cost_class="low",
            recommended_parsing_strategy=(
                "Use DOCX parser; apply table normalization skill when tables are detected."
                if table_count
                else "Use DOCX parser for structured text extraction."
            ),
            language=None,
        )

    def _profile_html(self, file_record: FileRecord, path: Path) -> FileProfile:
        text_length = 0
        table_count = 0
        image_count = 0

        raw_html = path.read_text(encoding="utf-8", errors="ignore") if path.exists() else ""
        try:
            from bs4 import BeautifulSoup  # type: ignore[import-not-found]

            soup = BeautifulSoup(raw_html, "html.parser")
            text_length = len(soup.get_text(" ", strip=True))
            table_count = len(soup.find_all("table"))
            image_count = len(soup.find_all("img"))
        except ImportError:
            text_length = len(raw_html)
            table_count = raw_html.lower().count("<table")
            image_count = raw_html.lower().count("<img")

        table_likelihood = min(1.0, 0.15 + (table_count * 0.35))
        image_likelihood = min(1.0, 0.1 + (image_count * 0.2))
        return FileProfile(
            file_id=file_record.id,
            file_type=file_record.file_type,
            modalities=[Modality.DOCUMENT.value, Modality.TEXT.value],
            has_text_layer=text_length > 0,
            is_scanned=False,
            page_count=None,
            table_likelihood=table_likelihood,
            image_likelihood=image_likelihood,
            layout_complexity=self._estimate_layout_complexity(
                page_count=None,
                table_likelihood=table_likelihood,
                image_likelihood=image_likelihood,
            ),
            estimated_cost_class="low",
            recommended_parsing_strategy="Use HTML parser; apply table normalization if needed.",
        )

    def _basic_profile(
        self,
        file_record: FileRecord,
        *,
        modalities: list[Modality],
        has_text_layer: bool | None,
        is_scanned: bool | None,
        image_likelihood: float | None,
        layout_complexity: str,
        strategy: str,
    ) -> FileProfile:
        return FileProfile(
            file_id=file_record.id,
            file_type=file_record.file_type,
            modalities=[modality.value for modality in modalities],
            has_text_layer=has_text_layer,
            is_scanned=is_scanned,
            page_count=None,
            table_likelihood=0.0,
            image_likelihood=image_likelihood,
            layout_complexity=layout_complexity,
            estimated_cost_class="low" if layout_complexity in {"none", "low"} else "medium",
            recommended_parsing_strategy=strategy,
        )

    def _estimate_layout_complexity(
        self,
        *,
        page_count: int | None,
        table_likelihood: float,
        image_likelihood: float,
    ) -> str:
        if (page_count or 0) > 20 or table_likelihood > 0.7 or image_likelihood > 0.7:
            return "high"
        if (page_count or 0) > 5 or table_likelihood > 0.35 or image_likelihood > 0.35:
            return "medium"
        return "low"


file_profiler = FileProfiler()
