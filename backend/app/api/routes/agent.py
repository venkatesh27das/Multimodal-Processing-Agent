from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.models.domain import (
    AgentArtifact,
    AgentMessage,
    AgentStep,
    AgentTask,
)
from backend.app.schemas.agent import (
    AgentArtifactRead,
    AgentCard,
    AgentEventRead,
    AgentMessageRead,
    AgentTaskCreate,
    AgentTaskCreateResponse,
    AgentTaskDetail,
    AgentTaskRead,
)
from backend.app.services.multimodal_parser_agent import multimodal_parser_agent

router = APIRouter(prefix="/agent")
well_known_router = APIRouter()


@well_known_router.get("/.well-known/agent-card.json", response_model=AgentCard)
def get_well_known_agent_card(db: Session = Depends(get_db)) -> AgentCard:
    return multimodal_parser_agent.agent_card(db)


@router.get("/card", response_model=AgentCard)
def get_agent_card(db: Session = Depends(get_db)) -> AgentCard:
    return multimodal_parser_agent.agent_card(db)


@router.post(
    "/tasks",
    response_model=AgentTaskCreateResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def create_agent_task(
    payload: AgentTaskCreate,
    db: Session = Depends(get_db),
) -> AgentTaskCreateResponse:
    try:
        task = multimodal_parser_agent.create_task(db, payload)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    return AgentTaskCreateResponse(task=multimodal_parser_agent.detail(db, task))


@router.get("/tasks", response_model=list[AgentTaskRead])
def list_agent_tasks(db: Session = Depends(get_db)) -> list[AgentTask]:
    return db.query(AgentTask).order_by(AgentTask.created_at.desc()).all()


@router.get("/tasks/{task_id}", response_model=AgentTaskDetail)
def get_agent_task(task_id: str, db: Session = Depends(get_db)) -> AgentTaskDetail:
    return multimodal_parser_agent.detail(db, _load_task(db, task_id))


@router.post("/tasks/{task_id}/cancel", response_model=AgentTaskRead)
def cancel_agent_task(task_id: str, db: Session = Depends(get_db)) -> AgentTask:
    return multimodal_parser_agent.cancel_task(db, _load_task(db, task_id))


@router.get("/tasks/{task_id}/messages", response_model=list[AgentMessageRead])
def get_agent_task_messages(task_id: str, db: Session = Depends(get_db)) -> list[AgentMessage]:
    _load_task(db, task_id)
    return (
        db.query(AgentMessage)
        .filter(AgentMessage.task_id == task_id)
        .order_by(AgentMessage.sequence.asc(), AgentMessage.created_at.asc())
        .all()
    )


@router.get("/tasks/{task_id}/artifacts", response_model=list[AgentArtifactRead])
def get_agent_task_artifacts(task_id: str, db: Session = Depends(get_db)) -> list[AgentArtifact]:
    _load_task(db, task_id)
    return (
        db.query(AgentArtifact)
        .filter(AgentArtifact.task_id == task_id)
        .order_by(AgentArtifact.sequence.asc(), AgentArtifact.created_at.asc())
        .all()
    )


@router.get("/tasks/{task_id}/events", response_model=list[AgentEventRead])
def get_agent_task_events(task_id: str, db: Session = Depends(get_db)) -> list[AgentEventRead]:
    _load_task(db, task_id)
    messages = (
        db.query(AgentMessage)
        .filter(AgentMessage.task_id == task_id)
        .order_by(AgentMessage.sequence.asc(), AgentMessage.created_at.asc())
        .all()
    )
    steps = (
        db.query(AgentStep)
        .filter(AgentStep.task_id == task_id)
        .order_by(AgentStep.sequence.asc(), AgentStep.created_at.asc())
        .all()
    )
    events: list[AgentEventRead] = []
    for message in messages:
        events.append(
            AgentEventRead(
                id=message.id,
                task_id=message.task_id,
                event_type=f"message.{message.role}",
                sequence=message.sequence,
                title=message.title,
                summary=message.summary,
                payload=message.payload,
                created_at=message.created_at,
            )
        )
    for step in steps:
        events.append(
            AgentEventRead(
                id=step.id,
                task_id=step.task_id,
                event_type=f"step.{step.kind}",
                sequence=100 + step.sequence,
                title=step.title,
                summary=step.summary,
                payload=step.payload,
                created_at=step.created_at,
            )
        )
    return sorted(events, key=lambda event: (event.sequence, event.created_at))


def _load_task(db: Session, task_id: str) -> AgentTask:
    task = db.get(AgentTask, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent task not found")
    return task
