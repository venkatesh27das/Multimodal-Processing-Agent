from backend.app.db.base import Base
from backend.app.db.session import engine
from backend.app.models import FileRecord, ParseJob

__all__ = ["FileRecord", "ParseJob"]


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()

