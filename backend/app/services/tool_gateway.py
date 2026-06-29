from dataclasses import dataclass


@dataclass(frozen=True)
class ToolDescriptor:
    tool_id: str
    category: str
    input_schema: dict[str, object]
    output_schema: dict[str, object]
    timeout_seconds: int
    retry_policy: dict[str, object]
    cost_estimate: dict[str, object]
    security_classification: str
    external_service_allowed: bool


class ToolGateway:
    """Registry for parser-agent tool capabilities and governance metadata."""

    def __init__(self) -> None:
        self._tools = [
            ToolDescriptor(
                tool_id="parser.registry",
                category="parser_selection",
                input_schema={"type": "object", "required": ["file_profile"]},
                output_schema={"type": "object", "required": ["selected_parser_id"]},
                timeout_seconds=10,
                retry_policy={"max_attempts": 1},
                cost_estimate={"level": "low"},
                security_classification="local",
                external_service_allowed=False,
            ),
            ToolDescriptor(
                tool_id="parser.adapter",
                category="parsing",
                input_schema={"type": "object", "required": ["file_id", "parser_id"]},
                output_schema={"type": "object", "required": ["output_payload"]},
                timeout_seconds=120,
                retry_policy={"max_attempts": 1},
                cost_estimate={"level": "varies_by_parser"},
                security_classification="local_or_external",
                external_service_allowed=True,
            ),
            ToolDescriptor(
                tool_id="skill.registry",
                category="skill_selection",
                input_schema={"type": "object", "required": ["file_type", "document_goal"]},
                output_schema={"type": "object", "required": ["skill_ids"]},
                timeout_seconds=10,
                retry_policy={"max_attempts": 1},
                cost_estimate={"level": "low"},
                security_classification="local",
                external_service_allowed=False,
            ),
            ToolDescriptor(
                tool_id="quality.evaluator",
                category="quality_evaluation",
                input_schema={"type": "object", "required": ["parser_result", "threshold"]},
                output_schema={"type": "object", "required": ["quality_status"]},
                timeout_seconds=15,
                retry_policy={"max_attempts": 1},
                cost_estimate={"level": "low"},
                security_classification="local",
                external_service_allowed=False,
            ),
            ToolDescriptor(
                tool_id="asset.publisher",
                category="asset_publishing",
                input_schema={"type": "object", "required": ["execution_result", "quality_report"]},
                output_schema={"type": "object", "required": ["asset_id", "lineage"]},
                timeout_seconds=30,
                retry_policy={"max_attempts": 1},
                cost_estimate={"level": "low"},
                security_classification="local",
                external_service_allowed=False,
            ),
        ]

    def list_tools(self) -> list[ToolDescriptor]:
        return list(self._tools)

    def categories(self) -> list[str]:
        return sorted({tool.category for tool in self._tools})

    def metadata(self) -> list[dict[str, object]]:
        return [
            {
                "tool_id": tool.tool_id,
                "category": tool.category,
                "input_schema": tool.input_schema,
                "output_schema": tool.output_schema,
                "timeout_seconds": tool.timeout_seconds,
                "retry_policy": tool.retry_policy,
                "cost_estimate": tool.cost_estimate,
                "security_classification": tool.security_classification,
                "external_service_allowed": tool.external_service_allowed,
            }
            for tool in self._tools
        ]

    def allowed_tools(
        self,
        *,
        external_services_allowed: bool,
    ) -> list[ToolDescriptor]:
        return [
            tool
            for tool in self._tools
            if external_services_allowed or not tool.external_service_allowed
        ]


tool_gateway = ToolGateway()
