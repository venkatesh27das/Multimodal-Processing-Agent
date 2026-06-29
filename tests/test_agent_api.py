from pathlib import Path
from time import sleep

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.routes.agent import get_db
from backend.app.core.config import settings
from backend.app.db.base import Base
from backend.app.db.seed import seed_registry_data
from backend.app.domain.enums import FileType, JobStatus, Modality
from backend.app.main import app
from backend.app.models.domain import FileProfile, FileRecord
from backend.app.schemas.agent import AgentTaskCreate
from backend.app.services.multimodal_parser_agent import multimodal_parser_agent


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


def add_html_file(db, tmp_path: Path) -> FileRecord:
    storage_path = tmp_path / "agent.html"
    storage_path.write_text("<html><body>Agentic parser task</body></html>")
    file_record = FileRecord(
        id="agent-html",
        original_filename="agent.html",
        file_type=FileType.HTML.value,
        mime_type="text/html",
        size_bytes=storage_path.stat().st_size,
        checksum_sha256="d" * 64,
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
        table_likelihood=0.1,
        image_likelihood=0.1,
        layout_complexity="low",
        recommended_parsing_strategy="Use HTML text extraction.",
    )
    db.add_all([file_record, profile])
    db.commit()
    return file_record


def wait_for_terminal_task(client: TestClient, task_id: str) -> dict[str, object]:
    terminal = {"awaiting_review", "cancelled", "completed", "failed"}
    for _ in range(20):
        response = client.get(f"/api/v1/agent/tasks/{task_id}")
        assert response.status_code == 200
        task = response.json()
        if task["status"] in terminal:
            return task
        sleep(0.05)
    raise AssertionError("Agent task did not reach a terminal state")


def test_agent_card_is_discoverable() -> None:
    db = make_session()

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.get("/.well-known/agent-card.json")
            assert response.status_code == 200
            payload = response.json()
            assert payload["name"] == "multimodal-parser-agent"
            assert payload["auth"]["runtime"]["framework"] == "google_adk"
            assert "parser_selection" in payload["capabilities"]
            assert "google_adk_runtime" in payload["capabilities"]
            assert payload["endpoints"]["create_task"] == "/api/v1/agent/tasks"
            assert payload["endpoints"]["create_task_from_upload"] == "/api/v1/agent/tasks/upload"
            assert payload["endpoints"]["event_stream"].endswith("/events/stream")
            assert "invoice_extraction" in payload["skills"]
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()


def test_agent_task_runs_parser_flow_and_persists_trace(tmp_path: Path) -> None:
    db = make_session()
    file_record = add_html_file(db, tmp_path)

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/agent/tasks",
                json={
                    "file_id": file_record.id,
                    "requested_output_contract": {"kind": "agent-test"},
                    "quality_target": "balanced",
                    "cost_profile": "balanced",
                    "latency_profile": "interactive",
                    "governance_constraints": {},
                },
            )
            assert response.status_code == 202
            task = response.json()["task"]
            task_id = task["id"]
            assert task["status"] == "accepted"

            task = wait_for_terminal_task(client, task_id)
            assert task["status"] == "completed"
            assert task["job_id"]
            assert task["plan"]["selected_parser_id"] == "html_text"
            assert [step["kind"] for step in task["steps"]] == [
                "observe",
                "plan",
                "act",
                "evaluate",
                "repair",
                "publish",
            ]
            assert task["quality_judgement"]["status"] == "passed"
            assert task["lineage"]["asset_id"]
            assert task["tool_calls"][0]["tool_id"] == "parser:html_text"
            reasoning = [
                artifact
                for artifact in task["artifacts"]
                if artifact["title"] == "Agent reasoning"
            ][0]
            assert reasoning["payload"]["agent_framework"]["framework"] == "google_adk"

            artifacts = client.get(f"/api/v1/agent/tasks/{task_id}/artifacts").json()
            artifact_kinds = {artifact["kind"] for artifact in artifacts}
            assert {
                "file_profile",
                "parsing_plan",
                "parser_output",
                "quality_report",
                "parsed_asset",
                "lineage_report",
                "audit_summary",
                "agent_reasoning",
            }.issubset(artifact_kinds)

            messages = client.get(f"/api/v1/agent/tasks/{task_id}/messages").json()
            assert messages[0]["role"] == "user"
            message_titles = {message["title"] for message in messages}
            assert "ADK observe" in message_titles
            assert "ADK publish" in message_titles
            assert "Task completed" in message_titles

            events = client.get(f"/api/v1/agent/tasks/{task_id}/events").json()
            assert events[0]["event_type"] == "message.user"
            assert any(event["event_type"] == "step.publish" for event in events)
            stream_response = client.get(f"/api/v1/agent/tasks/{task_id}/events/stream")
            assert stream_response.status_code == 200
            assert "text/event-stream" in stream_response.headers["content-type"]
            assert "event: step.publish" in stream_response.text
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()


def test_agent_task_can_be_created_directly_from_upload(tmp_path: Path) -> None:
    db = make_session()
    original_storage_dir = settings.storage_dir
    settings.storage_dir = tmp_path / "uploads"

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/agent/tasks/upload",
                files={
                    "file": (
                        "uploaded.html",
                        b"<html><body>Uploaded agent task</body></html>",
                        "text/html",
                    )
                },
                data={
                    "quality_target": "balanced",
                    "cost_profile": "balanced",
                    "latency_profile": "interactive",
                },
            )
            assert response.status_code == 202
            task = response.json()["task"]
            assert task["file_id"]
            task = wait_for_terminal_task(client, task["id"])
            assert task["status"] == "completed"
            assert task["plan"]["selected_parser_id"] == "html_text"
            assert task["input_payload"]["file_id"] == task["file_id"]
    finally:
        settings.storage_dir = original_storage_dir
        app.dependency_overrides.pop(get_db, None)
        db.close()


def test_cancelled_agent_task_does_not_execute(tmp_path: Path) -> None:
    db = make_session()
    file_record = add_html_file(db, tmp_path)
    task = multimodal_parser_agent.create_task(db, AgentTaskCreate(file_id=file_record.id))

    cancelled = multimodal_parser_agent.cancel_task(db, task)
    assert cancelled.status == "cancelled"

    after_execute = multimodal_parser_agent.execute_task(db, task.id)
    assert after_execute.status == "cancelled"
    assert after_execute.job_id is None
    db.close()
