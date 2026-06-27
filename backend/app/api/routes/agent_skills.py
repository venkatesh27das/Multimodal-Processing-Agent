from fastapi import APIRouter, HTTPException, status

from backend.app.schemas.domain import SkillRead, SkillTestRequest, SkillTestResponse
from backend.app.services.skills_framework import (
    SkillExecutionRequest,
    skill_executor,
    skill_registry,
)

router = APIRouter(prefix="/skills")


@router.get("", response_model=list[SkillRead])
def list_agent_skills() -> list[SkillRead]:
    return [
        SkillRead(
            skill_id=skill.skill_id,
            name=skill.name,
            description=skill.description,
            supported_document_types=skill.supported_document_types,
            schema=skill.schema,
            validation_rules=skill.validation_rules,
        )
        for skill in skill_registry.list_skills()
    ]


@router.get("/{skill_id}", response_model=SkillRead)
def get_agent_skill(skill_id: str) -> SkillRead:
    skill = skill_registry.get_skill(skill_id)
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")
    return SkillRead(
        skill_id=skill.skill_id,
        name=skill.name,
        description=skill.description,
        supported_document_types=skill.supported_document_types,
        schema=skill.schema,
        validation_rules=skill.validation_rules,
    )


@router.post("/{skill_id}/test", response_model=SkillTestResponse)
def test_agent_skill(skill_id: str, payload: SkillTestRequest) -> SkillTestResponse:
    try:
        result = skill_executor.execute(
            skill_id,
            SkillExecutionRequest(
                parsed_text=payload.parsed_text,
                structured_data=payload.structured_data,
                tables=payload.tables,
                entities=payload.entities,
                relationships=payload.relationships,
                document_metadata=payload.document_metadata,
            ),
        )
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Skill not found",
        ) from exc

    return SkillTestResponse(
        skill_id=result.skill_id,
        output=result.output,
        valid=result.valid,
        validation_errors=result.validation_errors,
    )
