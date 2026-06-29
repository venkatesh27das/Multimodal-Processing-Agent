from sqlalchemy import inspect, text

from backend.app.db.base import Base
from backend.app.db.seed import seed_registry_data
from backend.app.db.session import SessionLocal, engine
from backend.app.models import (
    AgentArtifact,
    AgentDecision,
    AgentLineage,
    AgentMessage,
    AgentPlan,
    AgentQualityJudgement,
    AgentSkillInvocation,
    AgentStep,
    AgentSubtask,
    AgentTask,
    AgentToolCall,
    AuditEvent,
    FileProfile,
    FileRecord,
    ParsedAsset,
    ParseJob,
    ParserDefinition,
    ParserExecutionResult,
    ParsingPlan,
    QualityReport,
    ReviewItem,
    SkillDefinition,
)

__all__ = [
    "AgentArtifact",
    "AgentDecision",
    "AgentLineage",
    "AgentMessage",
    "AgentPlan",
    "AgentQualityJudgement",
    "AgentSkillInvocation",
    "AgentStep",
    "AgentSubtask",
    "AgentTask",
    "AgentToolCall",
    "AuditEvent",
    "FileProfile",
    "FileRecord",
    "ParsedAsset",
    "ParseJob",
    "ParserDefinition",
    "ParserExecutionResult",
    "ParsingPlan",
    "QualityReport",
    "ReviewItem",
    "SkillDefinition",
]


def _apply_sqlite_dev_migrations() -> None:
    if engine.url.get_backend_name() != "sqlite":
        return

    inspector = inspect(engine)
    if "parse_jobs" not in inspector.get_table_names():
        return

    if "agent_tasks" in inspector.get_table_names():
        agent_task_columns = {column["name"] for column in inspector.get_columns("agent_tasks")}
        agent_task_column_sql = {
            "worker_id": "ALTER TABLE agent_tasks ADD COLUMN worker_id VARCHAR(128)",
            "attempt_count": (
                "ALTER TABLE agent_tasks ADD COLUMN attempt_count INTEGER DEFAULT 0 NOT NULL"
            ),
            "max_attempts": (
                "ALTER TABLE agent_tasks ADD COLUMN max_attempts INTEGER DEFAULT 3 NOT NULL"
            ),
            "locked_at": "ALTER TABLE agent_tasks ADD COLUMN locked_at DATETIME",
            "lock_expires_at": "ALTER TABLE agent_tasks ADD COLUMN lock_expires_at DATETIME",
            "heartbeat_at": "ALTER TABLE agent_tasks ADD COLUMN heartbeat_at DATETIME",
            "next_attempt_at": "ALTER TABLE agent_tasks ADD COLUMN next_attempt_at DATETIME",
        }
        missing_agent_task_statements = [
            statement
            for column, statement in agent_task_column_sql.items()
            if column not in agent_task_columns
        ]
        if missing_agent_task_statements:
            with engine.begin() as connection:
                for statement in missing_agent_task_statements:
                    connection.execute(text(statement))

    parse_job_columns = {column["name"] for column in inspector.get_columns("parse_jobs")}
    if "skill_id" not in parse_job_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE parse_jobs ADD COLUMN skill_id VARCHAR(128)"))

    parser_columns = {column["name"] for column in inspector.get_columns("parser_definitions")}
    if "expected_quality" not in parser_columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE parser_definitions ADD COLUMN expected_quality FLOAT DEFAULT 0.5")
            )

    if "parsed_assets" not in inspector.get_table_names():
        return

    asset_columns = {column["name"] for column in inspector.get_columns("parsed_assets")}
    asset_column_sql = {
        "audio_transcript": "ALTER TABLE parsed_assets ADD COLUMN audio_transcript TEXT",
        "video_transcript": "ALTER TABLE parsed_assets ADD COLUMN video_transcript TEXT",
        "chunks": "ALTER TABLE parsed_assets ADD COLUMN chunks JSON DEFAULT '[]'",
        "embeddings": "ALTER TABLE parsed_assets ADD COLUMN embeddings JSON DEFAULT '[]'",
        "entities": "ALTER TABLE parsed_assets ADD COLUMN entities JSON DEFAULT '[]'",
        "relationships": "ALTER TABLE parsed_assets ADD COLUMN relationships JSON DEFAULT '[]'",
        "evidence_spans": "ALTER TABLE parsed_assets ADD COLUMN evidence_spans JSON DEFAULT '[]'",
        "quality_report": "ALTER TABLE parsed_assets ADD COLUMN quality_report JSON DEFAULT '{}'",
        "lineage": "ALTER TABLE parsed_assets ADD COLUMN lineage JSON DEFAULT '{}'",
        "parser_used": (
            "ALTER TABLE parsed_assets ADD COLUMN parser_used VARCHAR(128) DEFAULT 'unknown'"
        ),
        "fallback_used": "ALTER TABLE parsed_assets ADD COLUMN fallback_used BOOLEAN DEFAULT 0",
        "skill_used": "ALTER TABLE parsed_assets ADD COLUMN skill_used VARCHAR(128)",
        "cost_estimate": "ALTER TABLE parsed_assets ADD COLUMN cost_estimate JSON DEFAULT '{}'",
        "latency_ms": "ALTER TABLE parsed_assets ADD COLUMN latency_ms INTEGER",
        "audit_trail": "ALTER TABLE parsed_assets ADD COLUMN audit_trail JSON DEFAULT '[]'",
    }
    missing_statements = [
        statement for column, statement in asset_column_sql.items() if column not in asset_columns
    ]
    if missing_statements:
        with engine.begin() as connection:
            for statement in missing_statements:
                connection.execute(text(statement))


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _apply_sqlite_dev_migrations()
    with SessionLocal() as db:
        seed_registry_data(db)


if __name__ == "__main__":
    init_db()
