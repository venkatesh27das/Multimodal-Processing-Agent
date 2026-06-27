from enum import StrEnum

from pydantic import Field

from backend.app.schemas.common import APIModel


class CostLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class LatencyLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class DeploymentMode(StrEnum):
    LOCAL = "local"
    MANAGED = "managed"
    EXTERNAL = "external"


class ParserDefinition(APIModel):
    parser_id: str
    name: str
    supported_file_types: list[str]
    supported_modalities: list[str]
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    cost_level: CostLevel
    latency_level: LatencyLevel
    quality_level: str
    deployment_mode: DeploymentMode
    enabled: bool
    version: str

