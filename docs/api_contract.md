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

### `GET /files/{file_id}/assets`

Returns unified parsed assets produced for the file.

## Assets

### `GET /assets/{asset_id}`

Returns one unified parsed asset.

The asset contract includes:

- `asset_id`
- `file_id`
- `job_id`
- `document_metadata`
- `parsed_text`
- `layout_blocks`
- `tables`
- `image_descriptions`
- `audio_transcript`
- `video_transcript`
- `chunks`
- `embeddings`
- `entities`
- `relationships`
- `evidence_spans`
- `quality_report`
- `lineage`
- `parser_used`
- `fallback_used`
- `skill_used`
- `cost_estimate`
- `latency_ms`
- `audit_trail`

## Parse Jobs

### `POST /jobs`

Runs the synchronous MVP orchestration flow: plan, create job, execute parser, evaluate quality, optionally run fallback, publish asset, optionally create review item, and write audit events.

Governance runs during planning. If `governance_constraints.block_restricted_documents` is `true` and the document is flagged as restricted, the API returns `409`.

Response:

```json
{
  "job": {
    "id": "uuid",
    "file_id": "uuid",
    "status": "complete",
    "parser_id": "html_text",
    "skill_id": null,
    "quality_status": "passed",
    "created_at": "2026-06-27T00:00:00",
    "updated_at": "2026-06-27T00:00:00"
  },
  "plan": {},
  "quality": {},
  "assets": [],
  "review_item": null
}
```

### `GET /jobs`

Returns parse jobs in reverse creation order.

### `GET /jobs/metrics`

Returns lightweight job metrics used by the Home and Jobs dashboards.

Response:

```json
{
  "jobs_today": 0,
  "failed_jobs": 0,
  "success_rate": 0.82
}
```

### `GET /jobs/{job_id}`

Returns a parse job.

### `GET /jobs/{job_id}/plan`

Returns the persisted parsing plan for a job.

### `GET /jobs/{job_id}/quality`

Returns the latest quality report for a job.

### `GET /jobs/{job_id}/assets`

Returns parsed assets published for a job.

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
    "strengths": ["Fast local extraction for PDFs with native text layers via PyMuPDF"],
    "weaknesses": ["Poor fit for scanned PDFs without OCR/VLM fallback"],
    "cost_level": "low",
    "latency_level": "low",
    "quality_level": "high",
    "deployment_mode": "local",
    "enabled": true,
    "version": "0.1.0",
    "expected_quality": 0.78
  }
]
```

Local parser support:

- `pdf_native_text`: PyMuPDF native PDF text/layout extraction.
- `docx_text`: python-docx paragraph and table extraction.
- `html_text`: BeautifulSoup text, table, and image metadata extraction.
- `image_ocr`: Pillow plus pytesseract image OCR.
- `tesseract_ocr`: Tesseract OCR for images and rendered PDF pages.
- `mock_vlm`: compatibility id for the LM Studio local VLM adapter.
- `azure_document_intelligence`, `audio_transcription`, and `video_parser` are still placeholder adapters.

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

### `GET /parsers/metrics`

Returns parser usage metrics used by the Parsers and Home dashboards.

Response:

```json
[
  {
    "parser_id": "html_text",
    "execution_count": 8,
    "job_count": 8,
    "success_count": 8,
    "error_count": 0,
    "fallback_asset_count": 0,
    "average_confidence": 0.73,
    "average_latency_ms": 0,
    "estimated_cost": 0
  }
]
```

## Skills Registry

### `GET /skills-registry`

Returns seeded skill definitions for reusable extraction workflows.

### `GET /skills-registry/{skill_id}`

Returns one skill definition.

Errors:

- `404` when the skill does not exist.

## Agent Skills

Skills are filesystem-backed folders under `backend/app/skills/{skill_id}` with:

- `SKILL.md`
- `schema.json`
- `validation_rules.yaml`
- `examples/`

### `GET /skills`

Returns loaded Agent Skills from disk.

### `GET /skills/{skill_id}`

Returns one loaded skill, including metadata, supported document types, schema, and validation rules.

### `POST /skills/{skill_id}/test`

Runs a skill against supplied mock content and validates the output against its JSON schema where possible.

Request:

```json
{
  "parsed_text": "Acme Corp invoice INV-123 total 42.50",
  "structured_data": {},
  "tables": [],
  "entities": [],
  "relationships": [],
  "document_metadata": {}
}
```

## MCP

### `GET /mcp/tools`

Returns demo metadata for callable MCP-style tools exposed by the parsing agent. See [docs/mcp_design.md](mcp_design.md) for the tool-to-backend mapping.

Response:

```json
{
  "skill_id": "invoice_extraction",
  "output": {
    "invoice_number": "INV-123",
    "vendor_name": "Acme",
    "total_amount": 42.5
  },
  "valid": true,
  "validation_errors": []
}
```

## Observability

### `GET /dashboard/summary`

Returns Home dashboard summary metrics from persisted jobs, quality, review, and observability data.

Response:

```json
{
  "jobs_today": 0,
  "success_rate": 0.82,
  "review_required": 3,
  "avg_quality": 0.64
}
```

### `GET /review/summary`

Returns review summary counts used by Home and review-oriented navigation.

Response:

```json
{
  "pending_review": 3,
  "review_required": 3,
  "count": 3
}
```

### `GET /observability/summary`

Returns job, fallback, review, latency, cost, and error-log metrics.

Response:

```json
{
  "jobs": {
    "total_jobs": 1,
    "completed_jobs": 1,
    "failed_jobs": 0,
    "review_required_jobs": 0,
    "success_rate": 1
  },
  "fallback": {"count": 0, "rate": 0},
  "review": {"count": 0, "rate": 0},
  "latency": {"average_ms": 10, "p50_ms": 10, "p95_ms": 10, "max_ms": 10},
  "cost": {"estimated_cost": 0, "currency": "USD"},
  "error_logs": []
}
```

### `GET /observability/parser-usage`

Returns parser execution counts, success/error counts, fallback asset counts,
average confidence, latency, and estimated cost by parser.

### `GET /observability/quality`

Returns quality status counts and low/medium/high score buckets.

## Audit

### `GET /audit/events`

Returns recent audit events in reverse chronological order.

Query parameters:

- `limit`: integer from 1 to 250, default 50.

## Known Error Responses

- `400`: empty upload or malformed request.
- `404`: missing file, profile, job, plan, quality report, parser, skill, or asset.
- `409`: no parser candidate available or governance policy blocks processing.
- `413`: upload exceeds `MAX_UPLOAD_BYTES`.
- `422`: request validation failed.
- `500`: unexpected server error.

## Known Limitations

- Parsing runs synchronously.
- Azure Document Intelligence, speech, and video adapters are placeholders.
- Legacy `.doc` files require conversion to DOCX/PDF before upload.
- OCR depends on local Tesseract and image quality.
- LM Studio VLM parsing depends on an image-capable local model.
- Governance detectors are placeholders.
- Review queue actions are not persisted yet.
