from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.db.base import Base
from backend.app.db.seed import seed_registry_data
from backend.app.domain.enums import FileType, Modality
from backend.app.models.domain import FileProfile, ParserDefinition
from backend.app.parsers import ParseRequest
from backend.app.services.parser_registry import parser_registry


def make_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return testing_session_local()


def test_all_parser_classes_are_seeded() -> None:
    db = make_session()
    seed_registry_data(db)

    parser_ids = {parser.parser_id for parser in db.query(ParserDefinition).all()}

    assert parser_ids == {
        "audio_transcription",
        "azure_document_intelligence",
        "docx_text",
        "html_text",
        "image_ocr",
        "mock_vlm",
        "pdf_native_text",
        "tesseract_ocr",
        "video_parser",
    }


def test_find_candidate_parsers_uses_file_profile_and_enabled_state() -> None:
    db = make_session()
    seed_registry_data(db)
    profile = FileProfile(
        file_id="file-1",
        file_type=FileType.PDF.value,
        modalities=[Modality.DOCUMENT.value, Modality.TEXT.value],
    )

    candidates = parser_registry.find_candidate_parsers(db, profile)
    assert [candidate.parser_id for candidate in candidates] == [
        "azure_document_intelligence",
        "pdf_native_text",
        "mock_vlm",
        "tesseract_ocr",
    ]

    disabled = parser_registry.disable_parser(db, "azure_document_intelligence")
    assert disabled is not None

    candidates = parser_registry.find_candidate_parsers(db, profile)
    assert "azure_document_intelligence" not in [candidate.parser_id for candidate in candidates]


def test_get_list_enable_and_disable_parser() -> None:
    db = make_session()
    seed_registry_data(db)

    assert len(parser_registry.list_parsers(db)) == 9
    assert len(parser_registry.list_parsers(db, include_disabled=False)) == 9

    parser = parser_registry.get_parser(db, "mock_vlm")
    assert parser is not None
    assert parser.enabled is True

    parser = parser_registry.enable_parser(db, "mock_vlm")
    assert parser is not None
    assert parser.enabled is True

    parser = parser_registry.disable_parser(db, "mock_vlm")
    assert parser is not None
    assert parser.enabled is False

    assert parser_registry.get_parser(db, "missing") is None
    assert parser_registry.enable_parser(db, "missing") is None
    assert parser_registry.disable_parser(db, "missing") is None


def test_parser_instances_return_mock_parse_results() -> None:
    parser = parser_registry.get_parser_instance("html_text")
    assert parser is not None

    result = parser.parse(
        ParseRequest(
            file_id="file-1",
            filename="sample.html",
            file_type=FileType.HTML,
            content=b"<html><body>Hello</body></html>",
        )
    )

    assert result.parser_id == "html_text"
    assert "Hello" in (result.parsed_text or "")
    assert result.confidence_score > 0
