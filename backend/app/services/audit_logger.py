from sqlalchemy.orm import Session

from backend.app.models.domain import AuditEvent


class AuditLogger:
    def log(
        self,
        db: Session,
        *,
        actor: str,
        action: str,
        entity_type: str,
        entity_id: str,
        metadata: dict[str, object] | None = None,
    ) -> AuditEvent:
        event = AuditEvent(
            actor=actor,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            event_metadata=metadata or {},
        )
        db.add(event)
        return event


audit_logger = AuditLogger()

