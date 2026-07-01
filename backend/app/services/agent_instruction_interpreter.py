from dataclasses import dataclass, field


@dataclass(frozen=True)
class AgentInstructionInterpretation:
    instruction: str
    inferred_objective: str | None = None
    inferred_outputs: list[str] = field(default_factory=list)
    output_contract_patch: dict[str, object] = field(default_factory=dict)
    governance_constraints_patch: dict[str, object] = field(default_factory=dict)
    review_rules: dict[str, object] = field(default_factory=dict)
    rationale: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, object]:
        return {
            "instruction": self.instruction,
            "inferred_objective": self.inferred_objective,
            "inferred_outputs": self.inferred_outputs,
            "output_contract_patch": self.output_contract_patch,
            "governance_constraints_patch": self.governance_constraints_patch,
            "review_rules": self.review_rules,
            "rationale": self.rationale,
        }


class AgentInstructionInterpreter:
    """Deterministically converts lightweight user instructions into planning hints."""

    def enrich(
        self,
        *,
        requested_output_contract: dict[str, object],
        governance_constraints: dict[str, object],
        agent_instruction: str | None = None,
    ) -> tuple[dict[str, object], dict[str, object], AgentInstructionInterpretation | None]:
        instruction = self._instruction_text(agent_instruction, requested_output_contract)
        if not instruction:
            return requested_output_contract, governance_constraints, None

        interpretation = self.interpret(instruction)
        return (
            self._merge_contract(requested_output_contract, interpretation),
            {**governance_constraints, **interpretation.governance_constraints_patch},
            interpretation,
        )

    def interpret(self, instruction: str) -> AgentInstructionInterpretation:
        normalized = " ".join(instruction.split())
        text = normalized.lower()
        patch: dict[str, object] = {"agent_instruction": normalized}
        governance_patch: dict[str, object] = {}
        review_rules: dict[str, object] = {}
        outputs: list[str] = []
        rationale: list[str] = []
        objective: str | None = None

        def add_output(asset: str) -> None:
            if asset not in outputs:
                outputs.append(asset)

        if self._has_any(text, "table", "tabular", "spreadsheet", "csv"):
            patch["tables"] = True
            add_output("tables")
            rationale.append("Instruction asks for table extraction or tabular structure.")
            objective = objective or "structured"

        if self._has_any(text, "search-ready", "search ready", "rag", "chunk", "chunks"):
            patch["chunks"] = True
            add_output("chunks")
            rationale.append("Instruction asks for search-ready chunking.")
            objective = "search"

        if self._has_any(text, "embedding", "embeddings", "vector", "vectors"):
            patch["chunks"] = True
            patch["embeddings"] = True
            add_output("chunks")
            add_output("vectors")
            rationale.append("Instruction asks for vector or embedding-ready output.")
            objective = "search"

        if self._has_any(text, "kg", "knowledge graph", "graph-ready", "graph ready"):
            patch["entities"] = True
            patch["relationships"] = True
            patch["knowledge_graph"] = True
            add_output("entities")
            add_output("relationships")
            add_output("knowledge_graph")
            rationale.append("Instruction asks for knowledge-graph-ready assets.")
            objective = "graph"

        if self._has_any(text, "entity", "entities", "key entities"):
            patch["entities"] = True
            add_output("entities")
            rationale.append("Instruction asks for entity extraction.")
            objective = objective or "structured"

        if self._has_any(text, "relationship", "relationships", "relations"):
            patch["entities"] = True
            patch["relationships"] = True
            add_output("entities")
            add_output("relationships")
            rationale.append("Instruction asks for relationship extraction.")
            objective = objective or "graph"

        if self._has_any(text, "summarize", "summary", "summarise"):
            patch["summary"] = True
            add_output("summary")
            rationale.append("Instruction asks for summarization.")

        if self._has_any(text, "invoice", "vendor", "line item", "line items", "total amount"):
            patch["invoice"] = True
            patch["skill_id"] = "invoice_extraction"
            patch["entities"] = True
            patch["tables"] = True
            patch["user_defined_extraction"] = True
            add_output("entities")
            add_output("tables")
            add_output("user_defined_extraction")
            rationale.append("Instruction maps to invoice extraction skill and field validation.")
            objective = "structured"

        if self._has_any(
            text,
            "contract",
            "clause",
            "clauses",
            "obligation",
            "obligations",
            "party",
            "parties",
        ):
            patch["contract"] = True
            patch["skill_id"] = "contract_parsing"
            patch["entities"] = True
            patch["user_defined_extraction"] = True
            add_output("entities")
            add_output("user_defined_extraction")
            rationale.append("Instruction maps to contract clause extraction skill.")
            objective = "structured"

        if self._has_any(
            text,
            "evidence",
            "reference",
            "references",
            "citation",
            "source span",
            "source spans",
        ):
            patch["evidence"] = True
            add_output("evidence")
            rationale.append("Instruction asks to preserve evidence references.")

        if self._has_any(
            text,
            "review",
            "low confidence",
            "low-confidence",
            "validate",
            "validation",
        ):
            patch["review_package"] = True
            patch["quality_report"] = True
            governance_patch["human_review_policy"] = "review_if_85"
            review_rules = {
                "route_low_confidence_to_review": True,
                "recommended_threshold": 0.85,
            }
            add_output("quality_report")
            add_output("review_package")
            rationale.append("Instruction asks for validation or low-confidence review routing.")

        if outputs:
            patch["selected_asset_types"] = outputs

        return AgentInstructionInterpretation(
            instruction=normalized,
            inferred_objective=objective,
            inferred_outputs=outputs,
            output_contract_patch=patch,
            governance_constraints_patch=governance_patch,
            review_rules=review_rules,
            rationale=rationale or ["Instruction captured for downstream planner context."],
        )

    def _merge_contract(
        self,
        requested_output_contract: dict[str, object],
        interpretation: AgentInstructionInterpretation,
    ) -> dict[str, object]:
        merged = {**requested_output_contract, **interpretation.output_contract_patch}
        requested_assets = requested_output_contract.get("selected_asset_types")
        existing_assets = [
            str(asset)
            for asset in requested_assets
            if isinstance(asset, str)
        ] if isinstance(requested_assets, list) else []
        merged_assets = [*existing_assets]
        for asset in interpretation.inferred_outputs:
            if asset not in merged_assets:
                merged_assets.append(asset)
        if merged_assets:
            merged["selected_asset_types"] = merged_assets
        merged["agent_instruction_interpretation"] = interpretation.to_dict()
        return merged

    def _instruction_text(
        self,
        agent_instruction: str | None,
        requested_output_contract: dict[str, object],
    ) -> str | None:
        if agent_instruction and agent_instruction.strip():
            return agent_instruction.strip()
        contract_instruction = requested_output_contract.get("agent_instruction")
        if isinstance(contract_instruction, str) and contract_instruction.strip():
            return contract_instruction.strip()
        return None

    def _has_any(self, text: str, *needles: str) -> bool:
        return any(needle in text for needle in needles)


agent_instruction_interpreter = AgentInstructionInterpreter()
