from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base


class ParseJob(Base):
    __tablename__ = "parse_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    file_id: Mapped[str] = mapped_column(String(36), ForeignKey("file_records.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="queued")
    parser_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    quality_status: Mapped[str] = mapped_column(String(64), nullable=False, default="not_evaluated")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

