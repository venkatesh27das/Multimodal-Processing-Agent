# API Contract

Base path: `/api/v1`

## Health

### `GET /health`

Returns service liveness metadata.

Response:

```json
{
  "status": "ok",
  "app_name": "Multimodal Parsing Agent",
  "version": "0.1.0",
  "environment": "local",
  "timestamp": "2026-06-27T00:00:00Z"
}
```

## Files

### `POST /files/upload`

Registers an uploaded file, stores it in local storage, calculates a checksum, and creates a file profile.

Request:

- Content type: `multipart/form-data`
- Field: `file`

Response `201`:

```json
{
  "file_id": "uuid",
  "original_filename": "invoice.pdf",
  "file_type": "pdf",
  "mime_type": "application/pdf",
  "size_bytes": 12345,
  "checksum_sha256": "hex",
  "source": "ui",
  "storage_path": "storage/generated-name.pdf",
  "status": "registered",
  "uploaded_at": "2026-06-27T00:00:00"
}
```

### `GET /files/{file_id}`

Returns the file registry record.

### `GET /files/{file_id}/profile`

Returns the generated file profile with modality, scanned/text-layer signals, likelihood placeholders, layout estimate, and recommended parsing strategy.

## Parse Jobs

### `POST /jobs/plan`

Creates an intelligent parser selection plan from a generated file profile.

Request:

```json
{
  "file_id": "uuid",
  "requested_output_contract": {
    "tables": true
  },
  "quality_target": "balanced",
  "cost_profile": "balanced",
  "latency_profile": "interactive",
  "governance_constraints": {
    "external_services_allowed": true
  }
}
```

Response:

```json
{
  "file_id": "uuid",
  "primary_parser_id": "pdf_native_text",
  "fallback_parser_id": "azure_document_intelligence",
  "secondary_parser_id": "mock_vlm",
  "selected_skill_id": "table_normalization",
  "decision_score": 0.72,
  "decision_explanation": "Selected PDF Native Text Parser for pdf profile...",
  "score_breakdown": []
}
```

### `POST /parse-jobs`

Creates a placeholder parse job for a registered file.

Request:

```json
{
  "file_id": "uuid"
}
```

Response `202`:

```json
{
  "job_id": "uuid",
  "file_id": "uuid",
  "status": "queued",
  "parser_id": null,
  "skill_id": null,
  "quality_status": "not_evaluated",
  "created_at": "2026-06-27T00:00:00",
  "updated_at": "2026-06-27T00:00:00"
}
```

### `GET /parse-jobs`

Returns parse jobs in reverse creation order.

Response:

```json
[]
```

## Parser Registry

### `GET /parser-registry`

Returns registered parser definitions.

Response:

```json
[
  {
    "parser_id": "pdf_native_text",
    "name": "PDF Native Text Parser",
    "parser_type": "deterministic",
    "supported_file_types": ["pdf"],
    "supported_modalities": ["document", "text"],
    "strengths": ["Fast deterministic extraction for PDFs with text layers"],
    "weaknesses": ["Poor fit for scanned or image-heavy PDFs"],
    "cost_level": "low",
    "latency_level": "low",
    "quality_level": "medium",
    "deployment_mode": "local",
    "enabled": true,
    "version": "0.1.0"
  }
]
```

### `GET /parser-registry/{parser_id}`

Returns one parser definition.

Errors:

- `404` when the parser does not exist.

### `POST /parser-registry/candidates`

Returns enabled parsers whose file type and modality metadata match a file profile.

Request:

```json
{
  "file_type": "pdf",
  "modalities": ["document", "text"],
  "has_text_layer": true,
  "is_scanned": false
}
```

### `POST /parser-registry/{parser_id}/enable`

Enables a parser definition.

### `POST /parser-registry/{parser_id}/disable`

Disables a parser definition.

## Skills Registry

### `GET /skills-registry`

Returns seeded skill definitions for reusable extraction workflows.

### `GET /skills-registry/{skill_id}`

Returns one skill definition.

Errors:

- `404` when the skill does not exist.
