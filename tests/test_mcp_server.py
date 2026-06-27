from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db.base import Base
from backend.app.db.seed import seed_registry_data
from backend.app.domain.enums import FileType, JobStatus, Modality
from backend.app.main import app
from backend.app.mcp.server import mcp_server
from backend.app.models.domain import FileProfile, FileRecord, ReviewItem


def make_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = testing_session_local()
    seed_registry_data(db)
    return db


def add_file(db, tmp_path: Path, file_id: str = "mcp-file") -> FileRecord:
    storage_path = tmp_path / f"{file_id}.html"
    storage_path.write_text("Acme MCP document INV-456 total 12.00")
    file_record = FileRecord(
        id=file_id,
        original_filename=f"{file_id}.html",
        file_type=FileType.HTML.value,
        mime_type="text/html",
        size_bytes=storage_path.stat().st_size,
        checksum_sha256="e" * 64,
        source="test",
        storage_path=str(storage_path),
        status=JobStatus.REGISTERED.value,
        created_by="tester",
    )
    profile = FileProfile(
        file_id=file_record.id,
        file_type=FileType.HTML.value,
        modalities=[Modality.DOCUMENT.value, Modality.TEXT.value],
        has_text_layer=True,
        is_scanned=False,
        table_likelihood=0.0,
        image_likelihood=0.0,
        layout_complexity="low",
        recommended_parsing_strategy="test",
    )
    db.add_all([file_record, profile])
    db.commit()
    return file_record


def test_mcp_tools_metadata_and_route() -> None:
    tools = mcp_server.list_tools()
    assert {tool["name"] for tool in tools} == {
        "compare_parser_outputs",
        "get_document_assets",
        "get_parse_status",
        "get_quality_report",
        "parse_batch",
        "parse_document",
        "reprocess_with_strategy",
        "submit_human_review",
    }

    with TestClient(app) as client:
        response = client.get("/api/v1/mcp/tools")
        assert response.status_code == 200
        assert len(response.json()["tools"]) == 8


def test_parse_document_assets_quality_and_review(tmp_path: Path) -> None:
    db = make_session()
    file_record = add_file(db, tmp_path)

    parsed = mcp_server.call_tool(
        db,
        "parse_document",
        {
            "file_id": file_record.id,
            "requested_output_contract": {"skill_id": "invoice_extraction"},
        },
    )
    job_id = parsed["job"]["job_id"]
    asset_id = parsed["assets"][0]["asset_id"]

    status = mcp_server.call_tool(db, "get_parse_status", {"job_id": job_id})
    assets = mcp_server.call_tool(db, "get_document_assets", {"file_id": file_record.id})
    quality = mcp_server.call_tool(db, "get_quality_report", {"job_id": job_id})
    review = mcp_server.call_tool(
        db,
        "submit_human_review",
        {"job_id": job_id, "reason": "Please verify extraction."},
    )

    assert status["status"] == "complete"
    assert assets["assets"][0]["asset_id"] == asset_id
    assert quality["quality_status"] == "passed"
    assert review["status"] == "open"
    assert db.query(ReviewItem).filter(ReviewItem.job_id == job_id).count() == 1


def test_parse_batch_compare_and_reprocess(tmp_path: Path) -> None:
    db = make_session()
    first = add_file(db, tmp_path, "mcp-file-1")
    second = add_file(db, tmp_path, "mcp-file-2")

    batch = mcp_server.call_tool(
        db,
        "parse_batch",
        {"file_ids": [first.id, second.id], "quality_target": "balanced"},
    )
    comparison = mcp_server.call_tool(
        db,
        "compare_parser_outputs",
        {"file_id": first.id, "parser_ids": ["html_text", "mock_vlm"]},
    )
    reprocessed = mcp_server.call_tool(
        db,
        "reprocess_with_strategy",
        {
            "file_id": first.id,
            "strategy": {
                "quality_target": "high",
                "requested_output_contract": {"skill_id": "invoice_extraction"},
            },
        },
    )

    assert len(batch["results"]) == 2
    assert comparison["best_parser_id"] == "html_text"
    assert reprocessed["job"]["file_id"] == first.id

