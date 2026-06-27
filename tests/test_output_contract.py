from backend.app.services.output_contract import (
    chunking_service,
    embedding_service,
    entity_extractor,
    relationship_extractor,
)


def test_output_contract_helpers_create_placeholders() -> None:
    chunks = chunking_service.chunk_text("Acme Corp works with Globex Corporation.", chunk_size=20)
    embeddings = embedding_service.embed_chunks(chunks)
    entities = entity_extractor.extract("Acme Corp works with Globex Corporation.")
    relationships = relationship_extractor.extract(entities)

    assert chunks[0]["chunk_id"] == "chunk-0"
    assert embeddings[0]["model"] == "mock-embedding-v0"
    assert {entity["text"] for entity in entities} >= {"Acme", "Corp", "Globex", "Corporation"}
    assert relationships[0]["type"] == "co_occurs_with"

