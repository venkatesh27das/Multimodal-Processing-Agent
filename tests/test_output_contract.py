from datetime import datetime
from types import SimpleNamespace

from backend.app.services.output_contract import (
    chunking_service,
    embedding_service,
    entity_extractor,
    output_contract_builder,
    relationship_extractor,
)


def test_output_contract_helpers_create_placeholders() -> None:
    chunks = chunking_service.chunk_text("Acme Corp works with Globex Corporation.", chunk_size=20)
    embeddings = embedding_service.embed_chunks(chunks)
    entities = entity_extractor.extract("Acme Corp works with Globex Corporation.")
    relationships = relationship_extractor.extract(entities)

    assert chunks[0]["chunk_id"] == "chunk-0"
    assert embeddings[0]["model"] == "local-hashing-embedding-v1"
    assert embeddings[0]["dimensions"] == 128
    assert {entity["text"] for entity in entities} >= {"Acme Corp", "Globex Corporation"}
    assert relationships[0]["type"] == "co_occurs_with"


def test_requested_fields_are_extracted_from_labelled_text() -> None:
    entities = entity_extractor.extract(
        "Invoice Number: INV-2026-001\nVendor Name: Acme Corp",
        requested_entities=["invoice_number", "vendor_name"],
    )

    assert {
        (entity["type"], entity["text"])
        for entity in entities
        if entity["source"] == "user_defined_pattern"
    } >= {
        ("invoice_number", "INV-2026-001"),
        ("vendor_name", "Acme Corp"),
    }


def test_output_contract_manifest_includes_every_selected_asset_even_when_empty() -> None:
    selected_assets = [
        "parsed_content",
        "document_structure",
        "tables",
        "chunks",
        "vectors",
        "entities",
        "relationships",
        "knowledge_graph",
        "summary",
        "classification",
        "evidence",
        "quality_report",
        "lineage",
        "review_package",
        "user_defined_extraction",
    ]
    contract = output_contract_builder.build(
        file_record=SimpleNamespace(
            id="file-1",
            original_filename="invoice.pdf",
            mime_type="application/pdf",
            file_type="pdf",
            size_bytes=1024,
            checksum_sha256="abc123",
            storage_path="storage/invoice.pdf",
        ),
        execution_result=SimpleNamespace(
            id="execution-1",
            parser_id="pdf_native_text",
            output_payload={
                "parsed_text": (
                    "Invoice Number: INV-2026-001. "
                    "Acme Corp charged USD 100 on 2026-06-30."
                ),
                "layout_blocks": [],
                "tables": [],
                "structured_data": {"source": "test"},
            },
            duration_ms=25,
        ),
        quality_report=SimpleNamespace(
            id="quality-1",
            quality_status="review_required",
            parser_confidence=0.9,
            extraction_confidence=0.86,
            schema_validation_score=1.0,
            completeness_score=0.82,
            consistency_score=0.88,
            human_review_required=True,
            quality_explanation="Review required by policy.",
        ),
        plan=SimpleNamespace(
            id="plan-1",
            selected_parser_id="pdf_native_text",
            selected_skill_id=None,
            output_contract={
                "selected_asset_types": selected_assets,
                "custom_outputs": "invoice_number",
            },
            cost_profile={},
        ),
        fallback_used=False,
        audit_events=[
            SimpleNamespace(
                id="audit-1",
                action="parser_executed",
                entity_type="job",
                entity_id="job-1",
                event_metadata={},
                created_at=datetime(2026, 6, 30, 1, 2, 3),
            )
        ],
    )

    manifest = {
        item["kind"]: item for item in contract["structured_data"]["asset_manifest"]
    }

    assert set(selected_assets) <= set(manifest)
    assert manifest["tables"]["status"] == "empty"
    assert manifest["tables"]["count"] == 0
    assert manifest["user_defined_extraction"]["status"] == "ready"
    assert manifest["user_defined_extraction"]["count"] == 1
    assert contract["structured_data"]["summary_asset"]["method"] == "ranked_extractive"


def test_output_contract_respects_chunking_configuration() -> None:
    contract = output_contract_builder.build(
        file_record=SimpleNamespace(
            id="file-2",
            original_filename="chunked.pdf",
            mime_type="application/pdf",
            file_type="pdf",
            size_bytes=1024,
            checksum_sha256="def456",
            storage_path="storage/chunked.pdf",
        ),
        execution_result=SimpleNamespace(
            id="execution-2",
            parser_id="pdf_native_text",
            output_payload={
                "parsed_text": " ".join(f"token-{index}" for index in range(120)),
                "layout_blocks": [],
                "tables": [],
                "structured_data": {},
            },
            duration_ms=25,
        ),
        quality_report=SimpleNamespace(
            id="quality-2",
            quality_status="passed",
            parser_confidence=0.9,
            extraction_confidence=0.9,
            schema_validation_score=1.0,
            completeness_score=0.9,
            consistency_score=0.9,
            human_review_required=False,
            quality_explanation="Passed.",
        ),
        plan=SimpleNamespace(
            id="plan-2",
            selected_parser_id="pdf_native_text",
            selected_skill_id=None,
            output_contract={
                "selected_asset_types": ["parsed_content", "chunks", "vectors"],
                "max_chunk_size": 120,
                "chunk_overlap": 10,
                "chunking_strategy": "fixed_size",
            },
            cost_profile={},
        ),
        fallback_used=False,
        audit_events=[],
    )

    chunks = contract["chunks"]
    assert len(chunks) > 1
    assert chunks[0]["metadata"]["chunk_size"] == 120
    assert chunks[0]["metadata"]["overlap"] == 10
    assert chunks[0]["metadata"]["strategy"] == "fixed_size"
    assert contract["structured_data"]["vector_asset"]["vector_count"] == len(chunks)
