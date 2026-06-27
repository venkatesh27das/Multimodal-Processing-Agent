from backend.app.schemas.parsers import (
    CostLevel,
    DeploymentMode,
    LatencyLevel,
    ParserDefinition,
)


class ParserRegistry:
    def __init__(self) -> None:
        self._parsers = {
            parser.parser_id: parser
            for parser in [
                ParserDefinition(
                    parser_id="pdf_native_text",
                    name="PDF Native Text Parser",
                    supported_file_types=["pdf"],
                    supported_modalities=["document", "text"],
                    strengths=["Fast deterministic extraction for PDFs with text layers"],
                    weaknesses=["Poor fit for scanned or image-heavy PDFs"],
                    cost_level=CostLevel.LOW,
                    latency_level=LatencyLevel.LOW,
                    quality_level="medium",
                    deployment_mode=DeploymentMode.LOCAL,
                    enabled=True,
                    version="0.1.0",
                ),
                ParserDefinition(
                    parser_id="docx_text",
                    name="DOCX Parser",
                    supported_file_types=["docx"],
                    supported_modalities=["document", "text"],
                    strengths=["Structured document text extraction"],
                    weaknesses=["Complex embedded media support pending"],
                    cost_level=CostLevel.LOW,
                    latency_level=LatencyLevel.LOW,
                    quality_level="medium",
                    deployment_mode=DeploymentMode.LOCAL,
                    enabled=True,
                    version="0.1.0",
                ),
                ParserDefinition(
                    parser_id="mock_vlm",
                    name="Mock VLM Parser",
                    supported_file_types=["pdf", "png", "jpg", "jpeg"],
                    supported_modalities=["document", "image"],
                    strengths=["Placeholder for multimodal reasoning workflows"],
                    weaknesses=["No real parsing implemented yet"],
                    cost_level=CostLevel.HIGH,
                    latency_level=LatencyLevel.HIGH,
                    quality_level="placeholder",
                    deployment_mode=DeploymentMode.EXTERNAL,
                    enabled=False,
                    version="0.1.0",
                ),
            ]
        }

    def list_parsers(self) -> list[ParserDefinition]:
        return list(self._parsers.values())

    def get_parser(self, parser_id: str) -> ParserDefinition | None:
        return self._parsers.get(parser_id)


parser_registry = ParserRegistry()

