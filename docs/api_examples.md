# API Examples

Base URL: `http://localhost:8000/api/v1`

## Upload

```bash
curl -F "file=@sample_files/invoice.html;type=text/html" \
  http://localhost:8000/api/v1/files/upload
```

Response includes `file_id`; use it in later requests.

## File Profile

```bash
curl http://localhost:8000/api/v1/files/{file_id}/profile
```

## Parser Plan

```bash
curl -X POST http://localhost:8000/api/v1/jobs/plan \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "{file_id}",
    "requested_output_contract": {"parsed_text": true, "tables": true},
    "quality_target": "balanced",
    "cost_profile": "balanced",
    "latency_profile": "interactive",
    "governance_constraints": {"external_services_allowed": true}
  }'
```

## Run Parse Job

```bash
curl -X POST http://localhost:8000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "{file_id}",
    "requested_output_contract": {
      "parsed_text": true,
      "tables": true,
      "entities": true,
      "relationships": true,
      "evidence_spans": true
    },
    "quality_target": "balanced",
    "cost_profile": "balanced",
    "latency_profile": "interactive",
    "governance_constraints": {}
  }'
```

## Force Local-Only Parser Selection

Use this when the user has no cloud access and you want the selector to avoid managed
services such as Azure Document Intelligence.

```bash
curl -X POST http://localhost:8000/api/v1/jobs/plan \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "{file_id}",
    "requested_output_contract": {"parsed_text": true, "tables": true},
    "quality_target": "high",
    "cost_profile": "balanced",
    "latency_profile": "interactive",
    "governance_constraints": {"external_services_allowed": false}
  }'
```

## LM Studio Local VLM

Set these values in `.env`, restart the backend, and upload an image or scanned PDF:

```env
LM_STUDIO_ENABLED=true
LM_STUDIO_BASE_URL="http://localhost:1234/v1"
LM_STUDIO_VLM_MODEL="google/gemma-4-12b"
LM_STUDIO_EMBEDDING_ENABLED=true
LM_STUDIO_EMBEDDING_MODEL="text-embedding-nomic-embed-text-v1.5"
```

The VLM adapter uses the existing parser id `mock_vlm` for compatibility. When enabled,
it sends image data to `/chat/completions`; embeddings use `/embeddings`.

## Assets

```bash
curl http://localhost:8000/api/v1/jobs/{job_id}/assets
curl http://localhost:8000/api/v1/assets/{asset_id}
curl http://localhost:8000/api/v1/files/{file_id}/assets
```

## Registries

```bash
curl http://localhost:8000/api/v1/parser-registry
curl http://localhost:8000/api/v1/skills
```

## Governance Block Example

```bash
curl -X POST http://localhost:8000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "{file_id}",
    "requested_output_contract": {"parsed_text": true},
    "quality_target": "balanced",
    "cost_profile": "balanced",
    "latency_profile": "interactive",
    "governance_constraints": {
      "restricted_document": true,
      "block_restricted_documents": true
    }
  }'
```

## Observability

```bash
curl http://localhost:8000/api/v1/observability/summary
curl http://localhost:8000/api/v1/observability/parser-usage
curl http://localhost:8000/api/v1/observability/quality
curl http://localhost:8000/api/v1/audit/events
```

## MCP Demo Tools

```bash
curl http://localhost:8000/api/v1/mcp/tools
```
