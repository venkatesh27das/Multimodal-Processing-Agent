import argparse

from backend.app.core.logging import configure_logging, get_logger
from backend.app.db.init_db import init_db
from backend.app.db.session import SessionLocal
from backend.app.services.agent_task_worker import agent_task_worker

logger = get_logger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run persisted parser-agent tasks.")
    parser.add_argument("--once", action="store_true", help="Process one queued task and exit.")
    parser.add_argument("--poll-seconds", type=float, default=2.0)
    args = parser.parse_args()

    configure_logging()
    init_db()
    if args.once:
        db = SessionLocal()
        try:
            task = agent_task_worker.process_next(db)
            logger.info("agent worker processed task_id=%s", task.id if task else None)
        finally:
            db.close()
        return

    logger.info("agent worker started poll_seconds=%s", args.poll_seconds)
    agent_task_worker.run_forever(SessionLocal, poll_seconds=args.poll_seconds)


if __name__ == "__main__":
    main()
