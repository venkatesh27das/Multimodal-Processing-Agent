from sqlalchemy import inspect, text

from backend.app.db.base import Base
from backend.app.db.seed import seed_registry_data
from backend.app.db.session import SessionLocal, engine
from backend.app.models import (
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


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _apply_sqlite_dev_migrations()
    with SessionLocal() as db:
        seed_registry_data(db)


if __name__ == "__main__":
    init_db()
