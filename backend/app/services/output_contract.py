import re
from collections import Counter
from hashlib import sha256
from itertools import combinations
from math import sqrt

from backend.app.core.config import settings
from backend.app.models.domain import (
    AuditEvent,
    FileRecord,
    ParserExecutionResult,
    ParsingPlan,
    QualityReport,
)

COMMON_ENTITY_PATTERNS: dict[str, str] = {
    "email": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
    "money": r"(?<!\w)(?:USD|INR|EUR|GBP|\$|€|£)\s?\d[\d,]*(?:\.\d+)?\b",
    "date": r"\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b",
    "percentage": r"\b\d+(?:\.\d+)?%\b",
    "phone": r"\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b",
}


class ChunkingService:
    def chunk_text(
        self,
        text: str | None,
        *,
        chunk_size: int = 600,
        overlap: int = 80,
    ) -> list[dict[str, object]]:
        if not text:
            return []

        normalized = re.sub(r"\s+", " ", text).strip()
        if not normalized:
            return []

        chunks: list[dict[str, object]] = []
        cursor = 0
        index = 0
        while cursor < len(normalized):
            target_end = min(len(normalized), cursor + chunk_size)
            end = self._semantic_boundary(normalized, cursor, target_end)
            chunk_text = normalized[cursor:end].strip()
            if not chunk_text:
                break
            chunks.append(
                {
                    "chunk_id": f"chunk-{index}",
                    "index": index,
                    "text": chunk_text,
                    "start_char": cursor,
                    "end_char": end,
                    "token_estimate": max(1, len(chunk_text.split())),
                    "content_hash": sha256(chunk_text.encode("utf-8")).hexdigest(),
                    "metadata": {
                        "strategy": "semantic_window",
                        "chunk_size": chunk_size,
                        "overlap": overlap,
                    },
                }
            )
            if end >= len(normalized):
                break
            cursor = max(end - overlap, cursor + 1)
            index += 1
        return chunks

    def _semantic_boundary(self, text: str, start: int, target_end: int) -> int:
        if target_end >= len(text):
            return len(text)
        window = text[start:target_end]
        boundary = max(window.rfind(". "), window.rfind("\n"), window.rfind("; "))
        if boundary >= max(80, int((target_end - start) * 0.55)):
            return start + boundary + 1
        space = window.rfind(" ")
        if space > 0:
            return start + space
        return target_end


class MockEmbeddingService:
    local_dimensions = 128

    def embed_chunks(self, chunks: list[dict[str, object]]) -> list[dict[str, object]]:
        if settings.lm_studio_embedding_enabled and chunks:
            embeddings = self._embed_with_lm_studio(chunks)
            if embeddings:
                return embeddings

        embeddings: list[dict[str, object]] = []
        for chunk in chunks:
            text = str(chunk.get("text", ""))
            embeddings.append(
                {
                    "chunk_id": chunk["chunk_id"],
                    "model": "local-hashing-embedding-v1",
                    "dimensions": self.local_dimensions,
                    "vector": self._deterministic_vector(text),
                    "index_policy": {
                        "metric": "cosine",
                        "intended_use": "local_semantic_search",
                        "provider": "local_hashing",
                    },
                }
            )
        return embeddings

    def vector_asset(self, embeddings: list[dict[str, object]]) -> dict[str, object]:
        model = str(embeddings[0]["model"]) if embeddings else "none"
        dimensions = embeddings[0].get("dimensions") if embeddings else 0
        if not isinstance(dimensions, int):
            vector = embeddings[0].get("vector") if embeddings else []
            dimensions = len(vector) if isinstance(vector, list) else 0
        return {
            "asset_kind": "vector_index",
            "model": model,
            "dimensions": dimensions,
            "vector_count": len(embeddings),
            "index_policy": {
                "metric": "cosine",
                "scope": "document_chunks",
                "status": "ready" if embeddings else "empty",
            },
        }

    def _deterministic_vector(self, text: str) -> list[float]:
        vector = [0.0] * self.local_dimensions
        tokens = re.findall(r"[A-Za-z0-9_]+", text.lower())
        if not tokens:
            return vector

        for token in tokens:
            digest = sha256(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:2], "big") % self.local_dimensions
            sign = 1.0 if digest[2] % 2 == 0 else -1.0
            vector[index] += sign

        magnitude = sqrt(sum(value * value for value in vector)) or 1.0
        return [round(value / magnitude, 6) for value in vector]

    def _embed_with_lm_studio(
        self, chunks: list[dict[str, object]]
    ) -> list[dict[str, object]] | None:
        try:
            import httpx

            texts = [str(chunk.get("text", "")) for chunk in chunks]
            response = httpx.post(
                f"{settings.lm_studio_base_url.rstrip('/')}/embeddings",
                json={"model": settings.lm_studio_embedding_model, "input": texts},
                timeout=settings.lm_studio_timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json()
            rows = payload.get("data") if isinstance(payload, dict) else None
            if not isinstance(rows, list):
                return None

            embeddings: list[dict[str, object]] = []
            for index, row in enumerate(rows):
                if not isinstance(row, dict):
                    continue
                vector = row.get("embedding")
                if not isinstance(vector, list):
                    continue
                chunk = chunks[index]
                embeddings.append(
                    {
                        "chunk_id": chunk["chunk_id"],
                        "model": settings.lm_studio_embedding_model,
                        "dimensions": len(vector),
                        "vector": vector,
                        "index_policy": {
                            "metric": "cosine",
                            "intended_use": "semantic_search",
                        },
                    }
                )
            return embeddings or None
        except Exception:
            return None


class EntityExtractor:
    def extract(
        self,
        text: str | None,
        *,
        requested_entities: list[str] | None = None,
    ) -> list[dict[str, object]]:
        if not text:
            return []

        entities: list[dict[str, object]] = []
        seen: set[tuple[str, str, int]] = set()
        for entity_type, pattern in self._patterns(requested_entities):
            for match in re.finditer(pattern, text):
                value = match.group(0).strip()
                key = (entity_type, value.lower(), match.start())
                if not value or key in seen:
                    continue
                seen.add(key)
                entities.append(
                    {
                        "entity_id": f"entity-{len(entities)}",
                        "text": value,
                        "type": entity_type,
                        "start_char": match.start(),
                        "end_char": match.end(),
                        "confidence": self._confidence(entity_type),
                        "source": "requested_schema"
                        if requested_entities and entity_type in requested_entities
                        else "rule_based",
                    }
                )
        self._extract_requested_fields(
            text,
            requested_entities=requested_entities or [],
            entities=entities,
            seen=seen,
        )
        return entities

    def _patterns(self, requested_entities: list[str] | None) -> list[tuple[str, str]]:
        requested = requested_entities or []
        patterns = [
            (entity_type, COMMON_ENTITY_PATTERNS[entity_type])
            for entity_type in requested
            if entity_type in COMMON_ENTITY_PATTERNS
        ]
        patterns.extend(
            [
                (
                    "organization_or_title",
                    r"\b[A-Z][A-Za-z0-9&.-]{2,}(?:\s+[A-Z][A-Za-z0-9&.-]{2,}){0,4}\b",
                ),
                ("date", COMMON_ENTITY_PATTERNS["date"]),
                ("money", COMMON_ENTITY_PATTERNS["money"]),
                ("percentage", COMMON_ENTITY_PATTERNS["percentage"]),
            ]
        )
        return patterns

    def _extract_requested_fields(
        self,
        text: str,
        *,
        requested_entities: list[str],
        entities: list[dict[str, object]],
        seen: set[tuple[str, str, int]],
    ) -> None:
        for entity_type in requested_entities:
            if entity_type in COMMON_ENTITY_PATTERNS:
                continue
            labels = self._field_labels(entity_type)
            for label in labels:
                pattern = rf"\b{re.escape(label)}\b\s*(?:[:=\-]|is|was|as)\s*([^\n.;,|]{{2,120}})"
                for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                    value = match.group(1).strip(" \t:-")
                    if not value:
                        continue
                    key = (entity_type, value.lower(), match.start(1))
                    if key in seen:
                        continue
                    seen.add(key)
                    entities.append(
                        {
                            "entity_id": f"entity-{len(entities)}",
                            "text": value,
                            "type": entity_type,
                            "field_label": label,
                            "start_char": match.start(1),
                            "end_char": match.end(1),
                            "confidence": 0.68,
                            "source": "user_defined_pattern",
                        }
                    )

    def _field_labels(self, entity_type: str) -> list[str]:
        normalized = entity_type.replace("_", " ").strip()
        labels = {entity_type, normalized, normalized.title()}
        if normalized.endswith(" id"):
            labels.add(normalized.replace(" id", " identifier"))
        return [label for label in labels if label]

    def _confidence(self, entity_type: str) -> float:
        if entity_type in COMMON_ENTITY_PATTERNS:
            return 0.78
        return 0.56


class RelationshipExtractor:
    def extract(
        self,
        entities: list[dict[str, object]],
        chunks: list[dict[str, object]] | None = None,
    ) -> list[dict[str, object]]:
        if len(entities) < 2:
            return []

        relationships: list[dict[str, object]] = []
        chunk_windows = chunks or [{"chunk_id": "document", "start_char": 0, "end_char": 10**9}]
        for chunk in chunk_windows:
            start = int(chunk.get("start_char", 0))
            end = int(chunk.get("end_char", 0))
            in_chunk = [
                entity
                for entity in entities
                if start <= int(entity.get("start_char", -1)) < end
            ]
            for left, right in combinations(in_chunk[:12], 2):
                distance = abs(int(right.get("start_char", 0)) - int(left.get("end_char", 0)))
                if distance > 600:
                    continue
                relationships.append(
                    {
                        "relationship_id": f"relationship-{len(relationships)}",
                        "source_entity_id": left["entity_id"],
                        "target_entity_id": right["entity_id"],
                        "type": self._relationship_type(left, right),
                        "confidence": self._relationship_confidence(left, right, distance),
                        "evidence_chunk_id": chunk.get("chunk_id"),
                        "distance_chars": distance,
                        "source": "entity_window_inference",
                    }
                )
        return relationships

    def graph_asset(
        self,
        entities: list[dict[str, object]],
        relationships: list[dict[str, object]],
    ) -> dict[str, object]:
        return {
            "asset_kind": "knowledge_graph",
            "nodes": [
                {
                    "id": entity["entity_id"],
                    "label": entity["text"],
                    "type": entity["type"],
                    "confidence": entity["confidence"],
                }
                for entity in entities
            ],
            "edges": [
                {
                    "id": relationship["relationship_id"],
                    "source": relationship["source_entity_id"],
                    "target": relationship["target_entity_id"],
                    "type": relationship["type"],
                    "confidence": relationship["confidence"],
                    "evidence_chunk_id": relationship.get("evidence_chunk_id"),
                }
                for relationship in relationships
            ],
            "graph_format": "property_graph",
        }

    def _relationship_type(
        self,
        left: dict[str, object],
        right: dict[str, object],
    ) -> str:
        if left.get("type") == "organization_or_title" and right.get("type") in {
            "date",
            "money",
            "percentage",
        }:
            return "has_value"
        if right.get("type") == "organization_or_title" and left.get("type") in {
            "date",
            "money",
            "percentage",
        }:
            return "has_value"
        if left.get("type") == "date" and right.get("type") == "money":
            return "dated_amount"
        if left.get("type") == "money" and right.get("type") == "date":
            return "dated_amount"
        if (
            left.get("source") == "user_defined_pattern"
            or right.get("source") == "user_defined_pattern"
        ):
            return "same_field_context"
        return "co_occurs_with"

    def _relationship_confidence(
        self,
        left: dict[str, object],
        right: dict[str, object],
        distance: int,
    ) -> float:
        base = 0.74 if self._relationship_type(left, right) != "co_occurs_with" else 0.58
        distance_penalty = min(0.18, distance / 4000)
        return round(max(0.45, base - distance_penalty), 2)


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
        selected_assets = self._selected_assets(plan.output_contract)
        requested_entities = self._requested_entities(plan.output_contract)
        needs_chunks = bool(
            selected_assets
            & {"chunks", "vectors", "evidence", "summary", "relationships", "knowledge_graph"}
        )
        needs_entities = bool(
            selected_assets
            & {"entities", "relationships", "knowledge_graph", "user_defined_extraction"}
        )
        chunks = chunking_service.chunk_text(parsed_text) if needs_chunks else []
        embeddings = embedding_service.embed_chunks(chunks) if "vectors" in selected_assets else []
        entities = (
            entity_extractor.extract(parsed_text, requested_entities=requested_entities)
            if needs_entities
            else []
        )
        relationships = (
            relationship_extractor.extract(entities, chunks)
            if selected_assets & {"relationships", "knowledge_graph"}
            else []
        )
        user_defined_matches = [
            entity for entity in entities if entity.get("type") in set(requested_entities)
        ]
        evidence_spans = (
            self._build_evidence_spans(chunks, file_record=file_record)
            if "evidence" in selected_assets
            else []
        )
        tables = self._list_payload(payload, "tables") if "tables" in selected_assets else []
        layout_blocks = self._list_payload(payload, "layout_blocks")
        image_descriptions = self._list_payload(payload, "image_descriptions")
        audio_transcript = self._optional_string(payload, "audio_transcript")
        video_transcript = self._optional_string(payload, "video_transcript")
        quality_asset = (
            self._quality_asset(quality_report)
            if "quality_report" in selected_assets
            else {}
        )
        lineage_asset = (
            self._lineage_asset(
                plan=plan,
                execution_result=execution_result,
                file_record=file_record,
            )
            if "lineage" in selected_assets
            else {}
        )
        summary_asset = (
            self._summary_asset(parsed_text, chunks)
            if "summary" in selected_assets
            else {}
        )
        classification_asset = (
            self._classification_asset(
                file_record=file_record,
                plan=plan,
                payload=payload,
            )
            if "classification" in selected_assets
            else {}
        )
        vector_asset = embedding_service.vector_asset(embeddings)
        graph_asset = relationship_extractor.graph_asset(entities, relationships)
        asset_manifest = self._asset_manifest(
            selected_assets=selected_assets,
            parsed_text=parsed_text,
            chunks=chunks,
            embeddings=embeddings,
            entities=entities,
            relationships=relationships,
            evidence_spans=evidence_spans,
            tables=tables,
            image_descriptions=image_descriptions,
            audio_transcript=audio_transcript,
            video_transcript=video_transcript,
            summary_asset=summary_asset,
            classification_asset=classification_asset,
            requested_entities=requested_entities,
            user_defined_matches=user_defined_matches,
        )

        structured_data = {
            **structured_data,
            "asset_manifest": asset_manifest,
            "summary_asset": summary_asset,
            "classification_asset": classification_asset,
            "vector_asset": vector_asset,
            "graph_asset": graph_asset,
            "entity_asset": {
                "asset_kind": "entity_catalog",
                "entities": entities,
                "requested_entity_types": requested_entities,
            },
            "relationship_asset": {
                "asset_kind": "relationship_catalog",
                "relationships": relationships,
            },
            "evidence_asset": {
                "asset_kind": "evidence_map",
                "evidence_spans": evidence_spans,
            },
            "review_package_asset": {
                "asset_kind": "review_package",
                "human_review_required": quality_report.human_review_required,
                "rationale": quality_report.quality_explanation,
                "uncertain_fields": [
                    entity
                    for entity in entities
                    if float(entity.get("confidence", 1.0)) < 0.7
                ],
            },
            "user_defined_extraction_asset": {
                "asset_kind": "user_defined_extraction",
                "requested_entities": requested_entities,
                "matched_entities": user_defined_matches,
            },
        }

        return {
            "asset_type": "unified_parsed_asset",
            "document_metadata": {
                "file_id": file_record.id,
                "original_filename": file_record.original_filename,
                "mime_type": file_record.mime_type,
                "file_type": file_record.file_type,
                "size_bytes": file_record.size_bytes,
                "checksum_sha256": file_record.checksum_sha256,
                "generated_asset_count": len(asset_manifest),
            },
            "parsed_text": parsed_text if "parsed_content" in selected_assets else None,
            "layout_blocks": layout_blocks,
            "tables": tables,
            "image_descriptions": image_descriptions,
            "audio_transcript": audio_transcript,
            "video_transcript": video_transcript,
            "chunks": chunks,
            "embeddings": embeddings,
            "entities": entities,
            "relationships": relationships,
            "evidence_spans": evidence_spans,
            "quality_report": quality_asset,
            "lineage": lineage_asset,
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

    def _build_evidence_spans(
        self,
        chunks: list[dict[str, object]],
        *,
        file_record: FileRecord,
    ) -> list[dict[str, object]]:
        return [
            {
                "evidence_id": f"evidence-{chunk['index']}",
                "chunk_id": chunk["chunk_id"],
                "source_file_id": file_record.id,
                "source_filename": file_record.original_filename,
                "start_char": chunk["start_char"],
                "end_char": chunk["end_char"],
                "locator": {
                    "type": "character_span",
                    "start": chunk["start_char"],
                    "end": chunk["end_char"],
                },
            }
            for chunk in chunks
        ]

    def _requested_entities(self, output_contract: dict[str, object]) -> list[str]:
        values = output_contract.get("entities")
        if isinstance(values, list):
            return [str(value) for value in values if str(value).strip()]

        schema = output_contract.get("entity_schema")
        if isinstance(schema, dict):
            return [str(key) for key in schema if str(key).strip()]

        custom_outputs = output_contract.get("custom_outputs")
        if isinstance(custom_outputs, str):
            requested = []
            for value in re.split(r"[,;\n]", custom_outputs):
                normalized = value.strip().lower().replace(" ", "_")
                if normalized:
                    requested.append(normalized)
            return requested
        return []

    def _selected_assets(self, output_contract: dict[str, object]) -> set[str]:
        values = output_contract.get("selected_asset_types")
        if isinstance(values, list) and values:
            return {str(value) for value in values if str(value).strip()}
        return {
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
        }

    def _summary_asset(
        self,
        parsed_text: str | None,
        chunks: list[dict[str, object]],
    ) -> dict[str, object]:
        if not parsed_text:
            return {
                "asset_kind": "summary",
                "summary": "No parsed text was available to summarize.",
                "key_points": [],
            }

        sentences = [
            sentence.strip()
            for sentence in re.split(r"(?<=[.!?])\s+", parsed_text)
            if sentence.strip()
        ]
        key_points = self._rank_sentences(sentences) if sentences else [parsed_text[:240]]
        return {
            "asset_kind": "summary",
            "summary": key_points[0][:500],
            "key_points": key_points,
            "method": "ranked_extractive",
            "source_chunk_ids": [chunk["chunk_id"] for chunk in chunks[:5]],
        }

    def _rank_sentences(self, sentences: list[str]) -> list[str]:
        stop_words = {
            "a",
            "an",
            "and",
            "are",
            "as",
            "at",
            "be",
            "by",
            "for",
            "from",
            "in",
            "is",
            "it",
            "of",
            "on",
            "or",
            "that",
            "the",
            "to",
            "with",
        }
        term_counts = Counter(
            token
            for sentence in sentences
            for token in re.findall(r"[A-Za-z0-9_]+", sentence.lower())
            if token not in stop_words and len(token) > 2
        )
        scored = []
        for index, sentence in enumerate(sentences):
            tokens = re.findall(r"[A-Za-z0-9_]+", sentence.lower())
            score = sum(term_counts[token] for token in tokens) / max(1, len(tokens))
            scored.append((score, -index, sentence))
        ranked = [sentence for _, _, sentence in sorted(scored, reverse=True)[:5]]
        return ranked or sentences[:5]

    def _classification_asset(
        self,
        *,
        file_record: FileRecord,
        plan: ParsingPlan,
        payload: dict[str, object],
    ) -> dict[str, object]:
        return {
            "asset_kind": "classification",
            "file_type": file_record.file_type,
            "mime_type": file_record.mime_type,
            "parser_used": plan.selected_parser_id,
            "skill_selected": plan.selected_skill_id,
            "document_class": self._document_class(file_record, payload),
            "output_contract": plan.output_contract,
        }

    def _document_class(
        self,
        file_record: FileRecord,
        payload: dict[str, object],
    ) -> str:
        text = str(payload.get("parsed_text") or "").lower()
        if "invoice" in text:
            return "invoice"
        if "agreement" in text or "contract" in text:
            return "contract"
        if file_record.file_type in {"image", "audio", "video"}:
            return f"{file_record.file_type}_media"
        return "general_document"

    def _quality_asset(self, quality_report: QualityReport) -> dict[str, object]:
        return {
            "quality_report_id": quality_report.id,
            "quality_status": quality_report.quality_status,
            "parser_confidence": quality_report.parser_confidence,
            "extraction_confidence": quality_report.extraction_confidence,
            "schema_validation_score": quality_report.schema_validation_score,
            "completeness_score": quality_report.completeness_score,
            "consistency_score": quality_report.consistency_score,
            "human_review_required": quality_report.human_review_required,
            "quality_explanation": quality_report.quality_explanation,
        }

    def _lineage_asset(
        self,
        *,
        plan: ParsingPlan,
        execution_result: ParserExecutionResult,
        file_record: FileRecord,
    ) -> dict[str, object]:
        return {
            "plan_id": plan.id,
            "execution_result_id": execution_result.id,
            "source_file_id": file_record.id,
            "storage_path": file_record.storage_path,
            "parser_id": execution_result.parser_id,
            "skill_id": plan.selected_skill_id,
        }

    def _asset_manifest(
        self,
        *,
        selected_assets: set[str],
        parsed_text: str | None,
        chunks: list[dict[str, object]],
        embeddings: list[dict[str, object]],
        entities: list[dict[str, object]],
        relationships: list[dict[str, object]],
        evidence_spans: list[dict[str, object]],
        tables: list[dict[str, object]],
        image_descriptions: list[dict[str, object]],
        audio_transcript: str | None,
        video_transcript: str | None,
        summary_asset: dict[str, object],
        classification_asset: dict[str, object],
        requested_entities: list[str],
        user_defined_matches: list[dict[str, object]],
    ) -> list[dict[str, object]]:
        manifest: list[dict[str, object]] = []
        if "parsed_content" in selected_assets:
            manifest.append(
                self._manifest_item("parsed_content", bool(parsed_text), len(parsed_text or "")),
            )
        if "document_structure" in selected_assets:
            manifest.append(self._manifest_item("document_structure", True, 1))
        if "chunks" in selected_assets:
            manifest.append(self._manifest_item("chunks", bool(chunks), len(chunks)))
        if "vectors" in selected_assets:
            manifest.append(self._manifest_item("vectors", bool(embeddings), len(embeddings)))
        if "entities" in selected_assets:
            manifest.append(self._manifest_item("entities", bool(entities), len(entities)))
        if "relationships" in selected_assets:
            manifest.append(
                self._manifest_item(
                    "relationships",
                    bool(relationships),
                    len(relationships),
                ),
            )
        if "knowledge_graph" in selected_assets:
            manifest.append(
                self._manifest_item("knowledge_graph", bool(entities), len(relationships)),
            )
        if "evidence" in selected_assets:
            manifest.append(
                self._manifest_item("evidence", bool(evidence_spans), len(evidence_spans)),
            )
        if "quality_report" in selected_assets:
            manifest.append(self._manifest_item("quality_report", True, 1))
        if "lineage" in selected_assets:
            manifest.append(self._manifest_item("lineage", True, 1))
        if "summary" in selected_assets:
            manifest.append(self._manifest_item("summary", bool(summary_asset), 1))
        if "classification" in selected_assets:
            manifest.append(self._manifest_item("classification", bool(classification_asset), 1))
        if "review_package" in selected_assets:
            manifest.append(self._manifest_item("review_package", True, 1))
        if "user_defined_extraction" in selected_assets:
            manifest.append(
                self._manifest_item(
                    "user_defined_extraction",
                    bool(user_defined_matches),
                    len(user_defined_matches),
                ),
            )
        if "tables" in selected_assets:
            manifest.append(self._manifest_item("tables", bool(tables), len(tables)))
        if image_descriptions:
            manifest.append(
                self._manifest_item("image_understanding", True, len(image_descriptions)),
            )
        if audio_transcript:
            manifest.append(self._manifest_item("audio_transcript", True, 1))
        if video_transcript:
            manifest.append(self._manifest_item("video_understanding", True, 1))
        return manifest

    def _manifest_item(self, kind: str, generated: bool, count: int) -> dict[str, object]:
        return {
            "kind": kind,
            "generated": generated,
            "count": count,
            "status": "ready" if generated else "empty",
        }

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
