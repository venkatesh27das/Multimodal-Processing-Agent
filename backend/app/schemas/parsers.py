from pydantic import Field

from backend.app.domain.enums import (
    CostLevel,
    DeploymentMode,
    FileType,
    LatencyLevel,
    Modality,
    ParserType,
)
from backend.app.schemas.common import APIModel


class ParserDefinition(APIModel):
    parser_id: str
    name: str
    parser_type: ParserType
    supported_file_types: list[FileType]
    supported_modalities: list[Modality]
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    cost_level: CostLevel
    latency_level: LatencyLevel
    expected_quality: float = Field(ge=0, le=1)
    quality_level: str
    deployment_mode: DeploymentMode
    enabled: bool
    version: str
