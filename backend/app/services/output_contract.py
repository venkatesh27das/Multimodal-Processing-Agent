import re

from backend.app.models.domain import (
    AuditEvent,
    FileRecord,
    ParserExecutionResult,
    ParsingPlan,
    QualityReport,
)


class ChunkingService:
    def chunk_text(self, text: str | None, *, chunk_size: int = 600) -> list[dict[str, object]]:
        if not text:
            return []

        chunks: list[dict[str, object]] = []
        cursor = 0
        index = 0
        while cursor < len(text):
            end = min(len(text), cursor + chunk_size)
            chunk_text = text[cursor:end]
            chunks.append(
                {
                    "chunk_id": f"chunk-{index}",
                    "index": index,
                    "text": chunk_text,
                    "start_char": cursor,
                    "end_char": end,
                }
            )
            cursor = end
            index += 1
        return chunks


class MockEmbeddingService:
    def embed_chunks(self, chunks: list[dict[str, object]]) -> list[dict[str, object]]:
        embeddings: list[dict[str, object]] = []
        for chunk in chunks:
            text = str(chunk.get("text", ""))
            embeddings.append(
                {
                    "chunk_id": chunk["chunk_id"],
                    "model": "mock-embedding-v0",
                    "vector": [len(text) / 1000, (sum(map(ord, text)) % 997) / 997, 0.0],
                }
            )
        return embeddings


class EntityExtractor:
    def extract(self, text: str | None) -> list[dict[str, object]]:
        if not text:
            return []

        entities: list[dict[str, object]] = []
        seen: set[str] = set()
        for match in re.finditer(r"\b[A-Z][A-Za-z0-9&.-]{2,}\b", text):
            value = match.group(0)
            if value in seen:
                continue
            seen.add(value)
            entities.append(
                {
                    "entity_id": f"entity-{len(entities)}",
                    "text": value,
                    "type": "mock_entity",
                    "start_char": match.start(),
                    "end_char": match.end(),
                    "confidence": 0.5,
                }
            )
        return entities


class RelationshipExtractor:
    def extract(self, entities: list[dict[str, object]]) -> list[dict[str, object]]:
        if len(entities) < 2:
            return []

        return [
            {
                "relationship_id": "relationship-0",
                "source_entity_id": entities[0]["entity_id"],
                "target_entity_id": entities[1]["entity_id"],
                "type": "co_occurs_with",
                "confidence": 0.4,
            }
        ]


class OutputContractBuilder:
    def build(
        self,
        *,
        file_record: FileRecord,
        execution_result: ParserExecutionResult,
        quality_report: QualityReport,
        plan: ParsingPlan,
        fallback_used: bool,
        audit_events: list[AuditEvent],
    ) -> dict[str, object]:
        payload = execution_result.output_payload or {}
        structured_data = payload.get("structured_data")
        if not isinstance(structured_data, dict):
            structured_data = {}

        parsed_text = payload.get("parsed_text")
        parsed_text = parsed_text if isinstance(parsed_text, str) else None
        chunks = chunking_service.chunk_text(parsed_text)
        entities = entity_extractor.extract(parsed_text)

        return {
            "asset_type": "unified_parsed_asset",
            "document_metadata": {
                "file_id": file_record.id,
                "original_filename": file_record.original_filename,
                "mime_type": file_record.mime_type,
                "file_type": file_record.file_type,
                "size_bytes": file_record.size_bytes,
                "checksum_sha256": file_record.checksum_sha256,
            },
            "parsed_text": parsed_text,
            "layout_blocks": self._list_payload(payload, "layout_blocks"),
            "tables": self._list_payload(payload, "tables"),
            "image_descriptions": self._list_payload(payload, "image_descriptions"),
            "audio_transcript": self._optional_string(payload, "audio_transcript"),
            "video_transcript": self._optional_string(payload, "video_transcript"),
            "chunks": chunks,
            "embeddings": embedding_service.embed_chunks(chunks),
            "entities": entities,
            "relationships": relationship_extractor.extract(entities),
            "evidence_spans": self._build_evidence_spans(chunks),
            "quality_report": {
                "quality_report_id": quality_report.id,
                "quality_status": quality_report.quality_status,
                "parser_confidence": quality_report.parser_confidence,
                "extraction_confidence": quality_report.extraction_confidence,
                "schema_validation_score": quality_report.schema_validation_score,
                "completeness_score": quality_report.completeness_score,
                "consistency_score": quality_report.consistency_score,
                "human_review_required": quality_report.human_review_required,
                "quality_explanation": quality_report.quality_explanation,
            },
            "lineage": {
                "plan_id": plan.id,
                "execution_result_id": execution_result.id,
                "source_file_id": file_record.id,
                "storage_path": file_record.storage_path,
            },
            "parser_used": execution_result.parser_id,
            "fallback_used": fallback_used,
            "skill_used": plan.selected_skill_id,
            "cost_estimate": self._cost_estimate(plan),
            "latency_ms": execution_result.duration_ms,
            "audit_trail": [
                {
                    "audit_event_id": event.id,
                    "action": event.action,
                    "entity_type": event.entity_type,
                    "entity_id": event.entity_id,
                    "metadata": event.event_metadata,
                    "created_at": event.created_at.isoformat() if event.created_at else None,
                }
                for event in audit_events
            ],
            "structured_data": structured_data,
        }

    def _list_payload(self, payload: dict[str, object], key: str) -> list[dict[str, object]]:
        value = payload.get(key)
        return value if isinstance(value, list) else []

    def _optional_string(self, payload: dict[str, object], key: str) -> str | None:
        value = payload.get(key)
        return value if isinstance(value, str) else None

    def _build_evidence_spans(self, chunks: list[dict[str, object]]) -> list[dict[str, object]]:
        return [
            {
                "evidence_id": f"evidence-{chunk['index']}",
                "chunk_id": chunk["chunk_id"],
                "start_char": chunk["start_char"],
                "end_char": chunk["end_char"],
            }
            for chunk in chunks
        ]

    def _cost_estimate(self, plan: ParsingPlan) -> dict[str, object]:
        profile = plan.cost_profile or {}
        return {
            "profile": profile.get("profile", "balanced"),
            "estimated_units": 1,
            "currency": "USD",
            "estimated_cost": 0.0,
        }


chunking_service = ChunkingService()
embedding_service = MockEmbeddingService()
entity_extractor = EntityExtractor()
relationship_extractor = RelationshipExtractor()
output_contract_builder = OutputContractBuilder()
