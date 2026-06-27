from abc import ABC, abstractmethod
from pathlib import Path

from pydantic import BaseModel, Field

from backend.app.domain.enums import CostLevel, FileType, LatencyLevel, Modality


class ParserMetadata(BaseModel):
    parser_id: str
    name: str
    supported_file_types: list[FileType]
    supported_modalities: list[Modality]
    cost_level: CostLevel
    latency_level: LatencyLevel
    expected_quality: float = Field(ge=0, le=1)
    version: str
    enabled: bool = True


class ParseRequest(BaseModel):
    file_id: str
    filename: str
    file_type: FileType
    mime_type: str | None = None
    storage_path: str | None = None
    content: bytes | None = None


class ParseResult(BaseModel):
    parser_id: str
    parsed_text: str | None = None
    structured_data: dict[str, object] = Field(default_factory=dict)
    confidence_score: float = Field(ge=0, le=1)
    warnings: list[str] = Field(default_factory=list)


class BaseParser(ABC):
    metadata: ParserMetadata

    @property
    def parser_id(self) -> str:
        return self.metadata.parser_id

    def supports(self, file_type: FileType, modalities: list[Modality]) -> bool:
        file_type_supported = file_type in self.metadata.supported_file_types
        modality_supported = not modalities or bool(
            set(modalities).intersection(self.metadata.supported_modalities)
        )
        return file_type_supported and modality_supported

    def _read_text_preview(self, request: ParseRequest) -> str:
        if request.content:
            return request.content[:2048].decode("utf-8", errors="ignore")

        if request.storage_path:
            path = Path(request.storage_path)
            if path.exists() and path.is_file():
                return path.read_bytes()[:2048].decode("utf-8", errors="ignore")

        return ""

    @abstractmethod
    def parse(self, request: ParseRequest) -> ParseResult:
        """Parse a file into a lightweight result payload."""

