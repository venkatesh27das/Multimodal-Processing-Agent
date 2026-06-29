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
    requires_external_service: bool = False


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
            ToolDescriptor(
                tool_id="ocr.tesseract",
                category="ocr",
                input_schema={"type": "object", "required": ["file_id"]},
                output_schema={"type": "object", "required": ["text", "confidence"]},
                timeout_seconds=120,
                retry_policy={"max_attempts": 1},
                cost_estimate={"level": "low", "unit": "local_cpu"},
                security_classification="local",
                external_service_allowed=False,
            ),
            ToolDescriptor(
                tool_id="vlm.lmstudio",
                category="vlm_parsing",
                input_schema={"type": "object", "required": ["file_id", "prompt_contract"]},
                output_schema={"type": "object", "required": ["extracted_fields", "confidence"]},
                timeout_seconds=180,
                retry_policy={"max_attempts": 1},
                cost_estimate={"level": "medium", "unit": "local_model"},
                security_classification="local_model",
                external_service_allowed=False,
            ),
            ToolDescriptor(
                tool_id="document_intelligence.azure",
                category="document_intelligence",
                input_schema={"type": "object", "required": ["file_id", "model"]},
                output_schema={"type": "object", "required": ["document", "confidence"]},
                timeout_seconds=180,
                retry_policy={"max_attempts": 2, "backoff_seconds": 2},
                cost_estimate={"level": "medium", "unit": "page"},
                security_classification="external_service",
                external_service_allowed=True,
                requires_external_service=True,
            ),
            ToolDescriptor(
                tool_id="speech.transcription",
                category="speech_transcription",
                input_schema={"type": "object", "required": ["file_id", "language_hint"]},
                output_schema={"type": "object", "required": ["transcript", "segments"]},
                timeout_seconds=300,
                retry_policy={"max_attempts": 1},
                cost_estimate={"level": "medium", "unit": "audio_minute"},
                security_classification="external_service",
                external_service_allowed=True,
                requires_external_service=True,
            ),
            ToolDescriptor(
                tool_id="video.understanding",
                category="video_understanding",
                input_schema={"type": "object", "required": ["file_id", "sampling_policy"]},
                output_schema={"type": "object", "required": ["scenes", "transcript"]},
                timeout_seconds=600,
                retry_policy={"max_attempts": 1},
                cost_estimate={"level": "high", "unit": "video_minute"},
                security_classification="external_service",
                external_service_allowed=True,
                requires_external_service=True,
            ),
            ToolDescriptor(
                tool_id="schema.validation",
                category="schema_validation",
                input_schema={"type": "object", "required": ["payload", "schema"]},
                output_schema={"type": "object", "required": ["valid", "errors"]},
                timeout_seconds=15,
                retry_policy={"max_attempts": 1},
                cost_estimate={"level": "low"},
                security_classification="local",
                external_service_allowed=False,
            ),
            ToolDescriptor(
                tool_id="table.normalization",
                category="table_normalization",
                input_schema={"type": "object", "required": ["tables"]},
                output_schema={"type": "object", "required": ["normalized_tables"]},
                timeout_seconds=60,
                retry_policy={"max_attempts": 1},
                cost_estimate={"level": "low"},
                security_classification="local",
                external_service_allowed=False,
            ),
            ToolDescriptor(
                tool_id="policy.pii",
                category="policy_checks",
                input_schema={"type": "object", "required": ["parsed_payload"]},
                output_schema={"type": "object", "required": ["findings", "risk_level"]},
                timeout_seconds=30,
                retry_policy={"max_attempts": 1},
                cost_estimate={"level": "low"},
                security_classification="local",
                external_service_allowed=False,
            ),
            ToolDescriptor(
                tool_id="embeddings.vector_search",
                category="embeddings",
                input_schema={"type": "object", "required": ["chunks", "index_policy"]},
                output_schema={"type": "object", "required": ["embedding_refs"]},
                timeout_seconds=120,
                retry_policy={"max_attempts": 1},
                cost_estimate={"level": "medium", "unit": "chunk"},
                security_classification="external_service",
                external_service_allowed=True,
                requires_external_service=True,
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
                "requires_external_service": tool.requires_external_service,
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
            if external_services_allowed or not tool.requires_external_service
        ]

    def policy_snapshot(
        self,
        governance_constraints: dict[str, object] | None,
    ) -> dict[str, object]:
        constraints = governance_constraints or {}
        external_services_allowed = bool(
            constraints.get(
                "external_services_allowed",
                constraints.get("allow_external_services", False),
            )
        )
        explicitly_allowed = {
            str(tool_id)
            for tool_id in constraints.get("allowed_tool_ids", [])
            if isinstance(tool_id, str)
        }
        explicitly_blocked = {
            str(tool_id)
            for tool_id in (
                constraints.get("blocked_tool_ids")
                or constraints.get("denied_tool_ids")
                or []
            )
            if isinstance(tool_id, str)
        }
        blocked_categories = {
            str(category)
            for category in constraints.get("blocked_tool_categories", [])
            if isinstance(category, str)
        }

        allowed_tools: list[dict[str, object]] = []
        blocked_tools: list[dict[str, object]] = []
        for tool in self._tools:
            reasons: list[str] = []
            if explicitly_allowed and tool.tool_id not in explicitly_allowed:
                reasons.append("not_in_allowed_tool_ids")
            if tool.tool_id in explicitly_blocked:
                reasons.append("blocked_tool_id")
            if tool.category in blocked_categories:
                reasons.append("blocked_tool_category")
            if tool.requires_external_service and not external_services_allowed:
                reasons.append("external_services_not_allowed")

            payload = {
                "tool_id": tool.tool_id,
                "category": tool.category,
                "security_classification": tool.security_classification,
                "cost_estimate": tool.cost_estimate,
                "timeout_seconds": tool.timeout_seconds,
                "retry_policy": tool.retry_policy,
                "external_service_allowed": tool.external_service_allowed,
                "requires_external_service": tool.requires_external_service,
            }
            if reasons:
                blocked_tools.append({**payload, "blocked_reasons": reasons})
            else:
                allowed_tools.append(payload)

        return {
            "external_services_allowed": external_services_allowed,
            "allowed_tool_ids": [tool["tool_id"] for tool in allowed_tools],
            "blocked_tool_ids": [tool["tool_id"] for tool in blocked_tools],
            "allowed_tools": allowed_tools,
            "blocked_tools": blocked_tools,
            "policy_inputs": {
                "allowed_tool_ids": sorted(explicitly_allowed),
                "blocked_tool_ids": sorted(explicitly_blocked),
                "blocked_tool_categories": sorted(blocked_categories),
            },
        }


tool_gateway = ToolGateway()
