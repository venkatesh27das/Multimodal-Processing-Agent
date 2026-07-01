from backend.app.services.agent_instruction_interpreter import agent_instruction_interpreter


def test_instruction_interpreter_maps_search_tables_and_review() -> None:
    contract, governance, interpretation = agent_instruction_interpreter.enrich(
        requested_output_contract={"parsed_text": True},
        governance_constraints={},
        agent_instruction=(
            "Extract all tables, create search-ready chunks, preserve evidence "
            "references, and route low-confidence results to review."
        ),
    )

    assert interpretation is not None
    assert contract["tables"] is True
    assert contract["chunks"] is True
    assert contract["evidence"] is True
    assert contract["review_package"] is True
    assert contract["quality_report"] is True
    assert governance["human_review_policy"] == "review_if_85"
    assert "tables" in contract["selected_asset_types"]
    assert "chunks" in contract["selected_asset_types"]
    assert "agent_instruction_interpretation" in contract


def test_instruction_interpreter_maps_invoice_and_contract_skills() -> None:
    invoice_contract, _, invoice = agent_instruction_interpreter.enrich(
        requested_output_contract={},
        governance_constraints={},
        agent_instruction="Validate invoice fields including vendor, totals, and line items.",
    )
    contract_contract, _, contract = agent_instruction_interpreter.enrich(
        requested_output_contract={},
        governance_constraints={},
        agent_instruction="Extract contract clauses, parties, obligations, and dates.",
    )

    assert invoice is not None
    assert invoice_contract["invoice"] is True
    assert invoice_contract["skill_id"] == "invoice_extraction"
    assert invoice.inferred_objective == "structured"
    assert contract is not None
    assert contract_contract["contract"] is True
    assert contract_contract["skill_id"] == "contract_parsing"
