from datetime import UTC, datetime, timedelta
from time import sleep
from uuid import uuid4

from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.domain.enums import AgentTaskStatus
from backend.app.models.domain import AgentTask
from backend.app.services.multimodal_parser_agent import multimodal_parser_agent

TERMINAL_STATUSES = {
    AgentTaskStatus.AWAITING_REVIEW.value,
    AgentTaskStatus.CANCELLED.value,
    AgentTaskStatus.COMPLETED.value,
    AgentTaskStatus.FAILED.value,
}


class AgentTaskWorker:
    """Durable worker loop for persisted parser-agent tasks."""

    def __init__(
        self,
        *,
        worker_id: str | None = None,
        lock_timeout_seconds: int | None = None,
        retry_backoff_seconds: int | None = None,
    ) -> None:
        self.worker_id = worker_id or f"agent-worker-{uuid4()}"
        self.lock_timeout_seconds = (
            settings.agent_task_lock_timeout_seconds
            if lock_timeout_seconds is None
            else lock_timeout_seconds
        )
        self.retry_backoff_seconds = (
            settings.agent_task_retry_backoff_seconds
            if retry_backoff_seconds is None
            else retry_backoff_seconds
        )

    def process_next(self, db: Session) -> AgentTask | None:
        self.recover_stale_locks(db)
        task = self.claim_next(db)
        if task is None:
            return None
        return self._execute_claimed_task(db, task.id)

    def process_task(self, db: Session, task_id: str) -> AgentTask | None:
        self.recover_stale_locks(db)
        task = self.claim_task(db, task_id)
        if task is None:
            return db.get(AgentTask, task_id)
        return self._execute_claimed_task(db, task.id)

    def claim_next(self, db: Session) -> AgentTask | None:
        now = self._now()
        candidate = (
            db.query(AgentTask)
            .filter(AgentTask.status.in_(self._claimable_statuses()))
            .filter(or_(AgentTask.next_attempt_at.is_(None), AgentTask.next_attempt_at <= now))
            .filter(or_(AgentTask.lock_expires_at.is_(None), AgentTask.lock_expires_at <= now))
            .order_by(AgentTask.created_at.asc())
            .first()
        )
        if candidate is None:
            return None
        return self._claim_candidate(db, candidate.id, now=now)

    def claim_task(self, db: Session, task_id: str) -> AgentTask | None:
        now = self._now()
        task = db.get(AgentTask, task_id)
        if task is None:
            return None
        if task.status not in self._claimable_statuses():
            return None
        if task.next_attempt_at is not None and task.next_attempt_at > now:
            return None
        if task.lock_expires_at is not None and task.lock_expires_at > now:
            return None
        return self._claim_candidate(db, task.id, now=now)

    def heartbeat(self, db: Session, task_id: str) -> AgentTask | None:
        now = self._now()
        task = db.get(AgentTask, task_id)
        if task is None or task.worker_id != self.worker_id:
            return task
        task.heartbeat_at = now
        task.lock_expires_at = now + timedelta(seconds=self.lock_timeout_seconds)
        db.commit()
        db.refresh(task)
        return task

    def recover_stale_locks(self, db: Session) -> int:
        now = self._now()
        stale_tasks = (
            db.query(AgentTask)
            .filter(AgentTask.status.in_(self._running_statuses()))
            .filter(AgentTask.lock_expires_at.is_not(None))
            .filter(AgentTask.lock_expires_at <= now)
            .order_by(AgentTask.updated_at.asc())
            .all()
        )
        recovered = 0
        for task in stale_tasks:
            task.worker_id = None
            task.locked_at = None
            task.lock_expires_at = None
            task.heartbeat_at = None
            if task.attempt_count >= task.max_attempts:
                task.status = AgentTaskStatus.FAILED.value
                task.error_code = task.error_code or "WorkerLockExpired"
                task.error_message = task.error_message or "Worker lock expired."
                task.summary = "Parser-agent task failed after stale worker recovery."
            else:
                task.status = AgentTaskStatus.ACCEPTED.value
                task.next_attempt_at = now
                task.summary = "Parser-agent task recovered from a stale worker lock."
            recovered += 1
        if recovered:
            db.commit()
        return recovered

    def run_forever(
        self,
        session_factory,
        *,
        poll_seconds: float = 2.0,
    ) -> None:
        while True:
            db = session_factory()
            try:
                self.process_next(db)
            finally:
                db.close()
            sleep(poll_seconds)

    def _execute_claimed_task(self, db: Session, task_id: str) -> AgentTask:
        try:
            task = multimodal_parser_agent.execute_task(db, task_id)
        except Exception as exc:
            task = db.get(AgentTask, task_id)
            if task is None:
                raise
            task.status = AgentTaskStatus.FAILED.value
            task.error_code = exc.__class__.__name__
            task.error_message = str(exc)
            task.summary = "Parser-agent task failed during worker execution."
            db.commit()
        return self._finalize_attempt(db, task_id)

    def _claim_candidate(self, db: Session, task_id: str, *, now: datetime) -> AgentTask | None:
        rows = (
            db.query(AgentTask)
            .filter(AgentTask.id == task_id)
            .filter(AgentTask.status.in_(self._claimable_statuses()))
            .filter(or_(AgentTask.next_attempt_at.is_(None), AgentTask.next_attempt_at <= now))
            .filter(or_(AgentTask.lock_expires_at.is_(None), AgentTask.lock_expires_at <= now))
            .update(
                {
                    AgentTask.status: AgentTaskStatus.EXECUTING.value,
                    AgentTask.worker_id: self.worker_id,
                    AgentTask.attempt_count: AgentTask.attempt_count + 1,
                    AgentTask.locked_at: now,
                    AgentTask.lock_expires_at: now + timedelta(seconds=self.lock_timeout_seconds),
                    AgentTask.heartbeat_at: now,
                    AgentTask.next_attempt_at: None,
                },
                synchronize_session=False,
            )
        )
        db.commit()
        if rows != 1:
            return None
        task = db.get(AgentTask, task_id)
        if task is not None:
            db.refresh(task)
        return task

    def _finalize_attempt(self, db: Session, task_id: str) -> AgentTask:
        task = db.get(AgentTask, task_id)
        if task is None:
            raise LookupError("Agent task not found")
        now = self._now()
        if task.status == AgentTaskStatus.FAILED.value and task.attempt_count < task.max_attempts:
            task.status = AgentTaskStatus.ACCEPTED.value
            task.summary = (
                "Parser-agent task failed; retry "
                f"{task.attempt_count + 1} of {task.max_attempts} scheduled."
            )
            task.next_attempt_at = now + timedelta(
                seconds=self.retry_backoff_seconds * max(task.attempt_count, 1)
            )
        elif task.status in TERMINAL_STATUSES:
            task.next_attempt_at = None

        if task.status in TERMINAL_STATUSES or task.status == AgentTaskStatus.ACCEPTED.value:
            task.worker_id = None
            task.locked_at = None
            task.lock_expires_at = None
            task.heartbeat_at = None
        db.commit()
        db.refresh(task)
        return task

    def _claimable_statuses(self) -> list[str]:
        return [AgentTaskStatus.SUBMITTED.value, AgentTaskStatus.ACCEPTED.value]

    def _running_statuses(self) -> list[str]:
        return [
            AgentTaskStatus.OBSERVING.value,
            AgentTaskStatus.PLANNING.value,
            AgentTaskStatus.EXECUTING.value,
            AgentTaskStatus.EVALUATING.value,
            AgentTaskStatus.REPAIRING.value,
            AgentTaskStatus.PUBLISHING.value,
        ]

    def _now(self) -> datetime:
        return datetime.now(UTC).replace(tzinfo=None)


agent_task_worker = AgentTaskWorker()
