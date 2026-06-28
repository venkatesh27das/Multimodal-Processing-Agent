import json
import re
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.models.domain import SkillDefinition
from backend.app.schemas.domain import (
    SkillDefinitionCreate,
    SkillDefinitionRead,
    SkillDefinitionUpdate,
    SkillDuplicateRequest,
    SkillImportResponse,
    SkillWorkflowAttachmentRequest,
    SkillWorkflowAttachmentResponse,
)

router = APIRouter(prefix="/skills-registry")


@router.get("", response_model=list[SkillDefinitionRead])
def list_skills(db: Session = Depends(get_db)) -> list[SkillDefinitionRead]:
    return db.query(SkillDefinition).order_by(SkillDefinition.name.asc()).all()


@router.get("/{skill_id}", response_model=SkillDefinitionRead)
def get_skill(skill_id: str, db: Session = Depends(get_db)) -> SkillDefinitionRead:
    skill = db.get(SkillDefinition, skill_id)
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")
    return skill


@router.post("", response_model=SkillDefinitionRead, status_code=status.HTTP_201_CREATED)
def create_skill(payload: SkillDefinitionCreate, db: Session = Depends(get_db)) -> SkillDefinitionRead:
    skill_id = _unique_skill_id(db, payload.skill_id or payload.name)
    skill = SkillDefinition(skill_id=skill_id, **_skill_create_values(payload))
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


@router.patch("/{skill_id}", response_model=SkillDefinitionRead)
def update_skill(
    skill_id: str,
    payload: SkillDefinitionUpdate,
    db: Session = Depends(get_db),
) -> SkillDefinitionRead:
    skill = _get_skill_or_404(db, skill_id)
    for key, value in _skill_update_values(payload).items():
        setattr(skill, key, value)
    skill.updated_at = datetime.now(UTC).replace(tzinfo=None)
    db.commit()
    db.refresh(skill)
    return skill


@router.post("/{skill_id}/duplicate", response_model=SkillDefinitionRead, status_code=status.HTTP_201_CREATED)
def duplicate_skill(
    skill_id: str,
    payload: SkillDuplicateRequest | None = None,
    db: Session = Depends(get_db),
) -> SkillDefinitionRead:
    source = _get_skill_or_404(db, skill_id)
    duplicate_name = payload.name if payload and payload.name else f"{source.name} Copy"
    duplicate_id = _unique_skill_id(db, (payload.skill_id if payload else None) or duplicate_name)
    duplicate = SkillDefinition(
        skill_id=duplicate_id,
        name=duplicate_name,
        description=source.description,
        supported_document_types=list(source.supported_document_types or []),
        extraction_schema=dict(source.extraction_schema or {}),
        validation_rules=dict(source.validation_rules or {}),
        examples=list(source.examples or []),
        post_processing_hook=source.post_processing_hook,
        enabled=source.enabled,
        version=source.version,
    )
    db.add(duplicate)
    db.commit()
    db.refresh(duplicate)
    return duplicate


@router.post("/import", response_model=SkillImportResponse, status_code=status.HTTP_201_CREATED)
async def import_skill_pack(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> SkillImportResponse:
    content = await file.read()
    try:
        raw_payload = json.loads(content.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Skill pack must be a JSON file.",
        ) from exc

    skill_payloads = _skill_payloads_from_pack(raw_payload)
    imported_ids: list[str] = []
    for item in skill_payloads:
        payload = SkillDefinitionCreate.model_validate(item)
        skill_id = _unique_skill_id(db, payload.skill_id or payload.name)
        skill = SkillDefinition(skill_id=skill_id, **_skill_create_values(payload))
        db.add(skill)
        imported_ids.append(skill_id)

    db.commit()
    return SkillImportResponse(imported=len(imported_ids), skill_ids=imported_ids)


@router.post("/{skill_id}/attach", response_model=SkillWorkflowAttachmentResponse)
def attach_skill_to_workflow(
    skill_id: str,
    payload: SkillWorkflowAttachmentRequest,
    db: Session = Depends(get_db),
) -> SkillWorkflowAttachmentResponse:
    skill = _get_skill_or_404(db, skill_id)
    workflow_id = payload.workflow_id or _slugify(payload.workflow_name)
    validation_rules = dict(skill.validation_rules or {})
    attachments = list(validation_rules.get("workflow_attachments", []))
    attachments.append(
        {
            "workflow_id": workflow_id,
            "workflow_name": payload.workflow_name,
            "notes": payload.notes,
            "attached_at": datetime.now(UTC).isoformat(),
        }
    )
    validation_rules["workflow_attachments"] = attachments
    skill.validation_rules = validation_rules
    skill.updated_at = datetime.now(UTC).replace(tzinfo=None)
    db.commit()
    return SkillWorkflowAttachmentResponse(
        skill_id=skill.skill_id,
        workflow_id=workflow_id,
        workflow_name=payload.workflow_name,
        attached=True,
    )


def _get_skill_or_404(db: Session, skill_id: str) -> SkillDefinition:
    skill = db.get(SkillDefinition, skill_id)
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")
    return skill


def _skill_create_values(payload: SkillDefinitionCreate) -> dict[str, object]:
    return {
        "name": payload.name,
        "description": payload.description,
        "supported_document_types": [item.value for item in payload.supported_document_types],
        "extraction_schema": payload.extraction_schema,
        "validation_rules": payload.validation_rules,
        "examples": payload.examples,
        "post_processing_hook": payload.post_processing_hook,
        "enabled": payload.enabled,
        "version": payload.version,
    }


def _skill_update_values(payload: SkillDefinitionUpdate) -> dict[str, object]:
    values = payload.model_dump(exclude_unset=True)
    if "supported_document_types" in values and values["supported_document_types"] is not None:
        values["supported_document_types"] = [item.value for item in payload.supported_document_types or []]
    return values


def _skill_payloads_from_pack(raw_payload: Any) -> list[dict[str, Any]]:
    if isinstance(raw_payload, dict) and isinstance(raw_payload.get("skills"), list):
        payloads = raw_payload["skills"]
    elif isinstance(raw_payload, dict) and isinstance(raw_payload.get("skill"), dict):
        payloads = [raw_payload["skill"]]
    elif isinstance(raw_payload, dict):
        payloads = [raw_payload]
    elif isinstance(raw_payload, list):
        payloads = raw_payload
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Skill pack must contain a skill object or skills array.",
        )

    if not payloads:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Skill pack contains no skills.")
    if not all(isinstance(item, dict) for item in payloads):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Each imported skill must be an object.")
    return payloads


def _unique_skill_id(db: Session, source: str) -> str:
    base = _slugify(source) or f"skill_{uuid4().hex[:8]}"
    candidate = base
    suffix = 2
    while db.get(SkillDefinition, candidate) is not None:
        candidate = f"{base}_{suffix}"
        suffix += 1
    return candidate


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", value.strip().lower()).strip("_")
    return re.sub(r"_+", "_", slug)
