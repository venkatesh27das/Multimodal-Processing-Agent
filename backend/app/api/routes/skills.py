from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.models.domain import SkillDefinition
from backend.app.schemas.domain import SkillDefinitionRead

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

