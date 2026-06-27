from pathlib import Path

import pytest

from backend.app.core.config import settings
from backend.app.domain.enums import FileType
from backend.app.parsers.adapters import MockVlmParser, TesseractAdapter
from backend.app.parsers.base import ParseRequest
from backend.app.parsers.document import HtmlParser
from backend.app.parsers.media import ImageOcrParser
from backend.app.services.output_contract import embedding_service


def test_html_parser_extracts_clean_text_tables_and_images(tmp_path: Path) -> None:
    html = tmp_path / "invoice.html"
    html.write_text(
        """
        <html>
          <head><script>ignored()</script></head>
          <body>
            <h1>Invoice INV-001</h1>
            <img src="logo.png" alt="Vendor logo" />
            <table>
              <tr><th>Item</th><th>Total</th></tr>
              <tr><td>Parsing</td><td>42.00</td></tr>
            </table>
          </body>
        </html>
        """,
        encoding="utf-8",
    )

    result = HtmlParser().parse(
        ParseRequest(
            file_id="file-html",
            filename=html.name,
            file_type=FileType.HTML,
            storage_path=str(html),
        )
    )

    assert "Invoice INV-001" in (result.parsed_text or "")
    assert result.tables[0]["rows"][1] == ["Parsing", "42.00"]
    assert result.image_descriptions[0]["alt"] == "Vendor logo"
    assert result.confidence_score > 0.8


def test_image_ocr_reports_missing_dependency_without_mocking_success(tmp_path: Path) -> None:
    pytest.importorskip("PIL")
    from PIL import Image

    image_path = tmp_path / "sample.png"
    Image.new("RGB", (20, 20), "white").save(image_path)

    result = ImageOcrParser().parse(
        ParseRequest(
            file_id="file-image",
            filename=image_path.name,
            file_type=FileType.IMAGE,
            storage_path=str(image_path),
        )
    )

    assert result.parser_id == "image_ocr"
    assert result.confidence_score <= 0.72
    assert result.structured_data["file_id"] == "file-image"


def test_tesseract_adapter_gracefully_handles_missing_runtime(tmp_path: Path) -> None:
    image_path = tmp_path / "sample.png"
    image_path.write_bytes(b"not a real image")

    result = TesseractAdapter().parse(
        ParseRequest(
            file_id="file-image",
            filename=image_path.name,
            file_type=FileType.IMAGE,
            storage_path=str(image_path),
        )
    )

    assert result.parser_id == "tesseract_ocr"
    assert result.confidence_score <= 0.2
    assert result.warnings


def test_lm_studio_vlm_parser_calls_openai_compatible_endpoint(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pytest.importorskip("PIL")
    from PIL import Image

    image_path = tmp_path / "invoice.png"
    Image.new("RGB", (20, 20), "white").save(image_path)

    monkeypatch.setattr(settings, "lm_studio_enabled", True)
    monkeypatch.setattr(settings, "lm_studio_base_url", "http://localhost:1234/v1")
    monkeypatch.setattr(settings, "lm_studio_vlm_model", "gemma4-12b")

    captured: dict[str, object] = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {"choices": [{"message": {"content": "Invoice text from Gemma"}}]}

    def fake_post(url: str, *, json: dict[str, object], timeout: float) -> FakeResponse:
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return FakeResponse()

    import httpx

    monkeypatch.setattr(httpx, "post", fake_post)

    result = MockVlmParser().parse(
        ParseRequest(
            file_id="file-image",
            filename=image_path.name,
            file_type=FileType.IMAGE,
            storage_path=str(image_path),
        )
    )

    assert result.parsed_text == "Invoice text from Gemma"
    assert captured["url"] == "http://localhost:1234/v1/chat/completions"
    assert captured["json"]["model"] == "gemma4-12b"  # type: ignore[index]
    assert result.structured_data["source"] == "lm_studio_vlm"


def test_embedding_service_can_call_lm_studio_embeddings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "lm_studio_embedding_enabled", True)
    monkeypatch.setattr(settings, "lm_studio_base_url", "http://localhost:1234/v1")
    monkeypatch.setattr(settings, "lm_studio_embedding_model", "nomic-text-embedding")

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {"data": [{"embedding": [0.1, 0.2, 0.3]}]}

    def fake_post(url: str, *, json: dict[str, object], timeout: float) -> FakeResponse:
        assert url == "http://localhost:1234/v1/embeddings"
        assert json["model"] == "nomic-text-embedding"
        assert json["input"] == ["hello"]
        return FakeResponse()

    import httpx

    monkeypatch.setattr(httpx, "post", fake_post)

    embeddings = embedding_service.embed_chunks(
        [{"chunk_id": "chunk-0", "index": 0, "text": "hello"}]
    )

    assert embeddings == [
        {
            "chunk_id": "chunk-0",
            "model": "nomic-text-embedding",
            "vector": [0.1, 0.2, 0.3],
        }
    ]
