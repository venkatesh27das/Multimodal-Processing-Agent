import json
import re
from dataclasses import dataclass
from pathlib import Path

from pydantic import BaseModel, Field

from backend.app.domain.enums import FileType

SKILLS_ROOT = Path(__file__).resolve().parents[1] / "skills"


class SkillExecutionRequest(BaseModel):
    parsed_text: str | None = None
    structured_data: dict[str, object] = Field(default_factory=dict)
    tables: list[dict[str, object]] = Field(default_factory=list)
    entities: list[dict[str, object]] = Field(default_factory=list)
    relationships: list[dict[str, object]] = Field(default_factory=list)
    document_metadata: dict[str, object] = Field(default_factory=dict)


class SkillExecutionResult(BaseModel):
    skill_id: str
    output: dict[str, object]
    valid: bool
    validation_errors: list[str] = Field(default_factory=list)


@dataclass(frozen=True)
class BaseSkill:
    skill_id: str
    name: str
    description: str
    supported_document_types: list[FileType]
    schema: dict[str, object]
    validation_rules: dict[str, object]
    path: Path

    def execute(self, request: SkillExecutionRequest) -> dict[str, object]:
        text = request.parsed_text or ""
        if self.skill_id == "invoice_extraction":
            return {
                "invoice_number": self._first_match(text, r"\bINV[-\s]?\d+\b") or "UNKNOWN",
                "vendor_name": self._first_entity(text) or "UNKNOWN",
                "total_amount": self._first_amount(text),
                "due_date": None,
                "line_items": [],
            }
        if self.skill_id == "contract_parsing":
            return {
                "parties": self._entities(text)[:4],
                "effective_date": None,
                "obligations": [],
                "governing_law": None,
                "clauses": [],
            }
        if self.skill_id == "research_paper_parsing":
            first_line = next((line.strip() for line in text.splitlines() if line.strip()), "")
            return {
                "title": first_line or "Untitled Paper",
                "authors": [],
                "abstract": text[:500],
                "sections": [],
                "citations": [],
            }
        if self.skill_id == "audio_meeting_parsing":
            return {
                "summary": text[:500] if text else "Mock meeting summary unavailable.",
                "action_items": [],
                "decisions": [],
                "speaker_turns": [],
            }
        if self.skill_id == "table_normalization":
            return {
                "tables": request.tables,
                "normalization_notes": ["MVP table normalization placeholder."],
            }
        if self.skill_id == "knowledge_graph_preparation":
            entities = request.entities or [
                {"entity_id": f"entity-{index}", "text": value, "type": "mock_entity"}
                for index, value in enumerate(self._entities(text))
            ]
            relationships = request.relationships
            return {"entities": entities, "relationships": relationships, "evidence": []}
        return {}

    def validate(self, output: dict[str, object]) -> tuple[bool, list[str]]:
        errors: list[str] = []
        required = self.schema.get("required", [])
        if isinstance(required, list):
            for field_name in required:
                if isinstance(field_name, str) and field_name not in output:
                    errors.append(f"Missing required field: {field_name}")

        properties = self.schema.get("properties", {})
        if isinstance(properties, dict):
            for field_name, definition in properties.items():
                if field_name in output and isinstance(definition, dict):
                    expected_type = definition.get("type")
                    if not self._matches_json_type(output[field_name], expected_type):
                        errors.append(f"Field {field_name} does not match schema type")

        return not errors, errors

    def _matches_json_type(self, value: object, expected_type: object) -> bool:
        expected_types = expected_type if isinstance(expected_type, list) else [expected_type]
        for item in expected_types:
            if item == "string" and isinstance(value, str):
                return True
            if item == "number" and isinstance(value, int | float):
                return True
            if item == "array" and isinstance(value, list):
                return True
            if item == "object" and isinstance(value, dict):
                return True
            if item == "null" and value is None:
                return True
        return False

    def _first_match(self, text: str, pattern: str) -> str | None:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        return match.group(0) if match else None

    def _first_amount(self, text: str) -> float:
        match = re.search(r"(?:total|amount)\s*\$?(\d+(?:\.\d{1,2})?)", text, re.IGNORECASE)
        if match:
            return float(match.group(1))
        match = re.search(r"\$(\d+(?:\.\d{1,2})?)", text)
        return float(match.group(1)) if match else 0.0

    def _first_entity(self, text: str) -> str | None:
        entities = self._entities(text)
        return entities[0] if entities else None

    def _entities(self, text: str) -> list[str]:
        seen: set[str] = set()
        entities: list[str] = []
        for match in re.finditer(r"\b[A-Z][A-Za-z0-9&.-]{2,}\b", text):
            value = match.group(0)
            if value not in seen:
                seen.add(value)
                entities.append(value)
        return entities


class SkillLoader:
    def __init__(self, root: Path = SKILLS_ROOT) -> None:
        self.root = root

    def load_all(self) -> list[BaseSkill]:
        return [self.load(path) for path in sorted(self.root.iterdir()) if path.is_dir()]

    def load(self, path: Path) -> BaseSkill:
        metadata = self._parse_skill_md(path / "SKILL.md")
        schema = json.loads((path / "schema.json").read_text())
        validation_rules = self._parse_simple_yaml(path / "validation_rules.yaml")
        supported = [
            FileType(item.strip())
            for item in metadata.get("supported_document_types", "").split(",")
            if item.strip()
        ]
        return BaseSkill(
            skill_id=metadata["skill_id"],
            name=metadata["name"],
            description=metadata.get("description", ""),
            supported_document_types=supported,
            schema=schema,
            validation_rules=validation_rules,
            path=path,
        )

    def _parse_skill_md(self, path: Path) -> dict[str, str]:
        metadata: dict[str, str] = {}
        for line in path.read_text().splitlines():
            if ":" not in line or line.lstrip().startswith("#"):
                continue
            key, value = line.split(":", 1)
            metadata[key.strip()] = value.strip()
        return metadata

    def _parse_simple_yaml(self, path: Path) -> dict[str, object]:
        rules: dict[str, object] = {}
        current_key: str | None = None
        for raw_line in path.read_text().splitlines():
            line = raw_line.rstrip()
            if not line:
                continue
            if not line.startswith(" ") and line.endswith(":"):
                current_key = line[:-1]
                rules[current_key] = []
            elif line.startswith("  - ") and current_key:
                value = line[4:].strip()
                current_value = rules.setdefault(current_key, [])
                if isinstance(current_value, list):
                    current_value.append(value)
        return rules


class SkillRegistry:
    def __init__(self, loader: SkillLoader | None = None) -> None:
        self.loader = loader or SkillLoader()
        self._skills: dict[str, BaseSkill] | None = None

    def list_skills(self) -> list[BaseSkill]:
        return list(self._load().values())

    def get_skill(self, skill_id: str) -> BaseSkill | None:
        return self._load().get(skill_id)

    def refresh(self) -> None:
        self._skills = None

    def _load(self) -> dict[str, BaseSkill]:
        if self._skills is None:
            self._skills = {skill.skill_id: skill for skill in self.loader.load_all()}
        return self._skills


class SkillExecutor:
    def __init__(self, registry: SkillRegistry | None = None) -> None:
        self.registry = registry or skill_registry

    def execute(self, skill_id: str, request: SkillExecutionRequest) -> SkillExecutionResult:
        skill = self.registry.get_skill(skill_id)
        if skill is None:
            raise KeyError(f"Skill not found: {skill_id}")

        output = skill.execute(request)
        valid, errors = skill.validate(output)
        return SkillExecutionResult(
            skill_id=skill.skill_id,
            output=output,
            valid=valid,
            validation_errors=errors,
        )


skill_registry = SkillRegistry()
skill_executor = SkillExecutor(skill_registry)
