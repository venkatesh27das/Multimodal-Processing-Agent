# Multimodal Processing Agent

Enterprise MVP for multimodal file intake, parser selection, parsing orchestration, quality scoring, human review routing, asset publishing, skills, MCP tool wrappers, governance, audit, and observability.

The project is intentionally split between deterministic enterprise controls and agentic decisioning. Deterministic code owns file registration, storage, validation, audit, and publishing. Agentic/intelligent code owns profiling, parser selection, fallback planning, skill selection, quality interpretation, and review recommendations.

## What Works Today

- Local upload and file registry for HTML, DOCX, PDF, and image files.
- File profiling with modality, file type, text/scanned signals, and recommended strategy.
- Parser registry with local parsers and placeholder managed/media adapters.
- Parser selection, planning, synchronous execution, fallback handling, quality evaluation, and asset publishing.
- Google ADK-backed A2A-style Multimodal Parser Agent API with Agent Card, background task execution, multi-file tasks, upload/file/text/asset/URL-placeholder inputs, messages, artifacts, SSE/pollable events, reasoning trace, quality judgement, cancellation, and lineage.
- Internal agent tool gateway metadata and ADK tools for parser planning, skill discovery, quality evaluation, publishing, and governance-aware tool policy.
- Skills registry backed by folder-based skill packs in `backend/app/skills`.
- Observability, audit, dashboard, jobs, parser, skill, review, and asset APIs.
- Next.js enterprise console for Home, Parse, Jobs, Job Detail, Parsers, Skills, Review Queue, Assets, Observability, and Settings.
- Compact UI density aligned to the supplied wireframes at normal browser zoom.

## Current Limitations

- Agent parsing runs in an in-process FastAPI background task; a production queue worker is not included yet.
- URL agent input records a governed local placeholder; it does not fetch remote content in local mode.
- Azure Document Intelligence, speech, and video adapters are placeholders.
- Legacy `.doc` files are not parsed directly; convert them to DOCX or PDF.
- OCR quality depends on the local Tesseract binary and image quality.
- LM Studio VLM parsing depends on a local model that supports image inputs.
- PII and restricted document detection use lightweight heuristics.
- SQLite migrations are intentionally lightweight; production should use Alembic.
- Human review approve/reject interactions are not fully persisted.
- Authentication, authorization, tenant isolation, and secrets management are not implemented.
- Global search and direct drag/drop from the Home card into a parse run are still feature work.

## Repository Map

```text
backend/app/api/routes      FastAPI route modules
backend/app/agent_adk       Google ADK agent runtime and tool wrappers
backend/app/services        orchestration, profiling, selection, quality, audit, observability
backend/app/parsers         parser adapters and parser base contracts
backend/app/skills          folder-based skill packs
backend/app/models          SQLAlchemy persistence models
backend/app/schemas         Pydantic API contracts
frontend/app                Next.js App Router screens
frontend/api                typed frontend API clients
frontend/components         shared UI and shell components
docs                        architecture, API, MCP, and examples
sample_files                local files for manual testing
application wireframes      reference screenshots used for UI alignment
tests                       backend unit and service tests
```

## Local Setup

The shortest path for a fresh clone is:

```bash
make install
cp .env.example .env
```

Then run the API and frontend in two terminals:

```bash
make api
make web
```

For API-only agent work, only run:

```bash
make install-api
make agent-api
```

### Backend

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev,postgres]"
cp .env.example .env
uvicorn backend.app.main:app --reload --port 8000
```

The default database is SQLite at `./local.db`. PostgreSQL is supported by setting `DATABASE_URL`.

For local image OCR on macOS, install the system Tesseract binary:

```bash
brew install tesseract
```

Health check:

```bash
curl http://localhost:8000/api/v1/health
```

Agent Card:

```bash
curl http://localhost:8000/.well-known/agent-card.json
curl http://localhost:8000/api/v1/agent/card
```

Create an agent task directly from an upload:

```bash
curl -F "file=@sample_files/invoice.html;type=text/html" \
  http://localhost:8000/api/v1/agent/tasks/upload
```

API docs:

- Swagger: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Frontend

```bash
cd frontend
npm install
npm run dev -- --port 3000
```

Open `http://localhost:3000`.

The frontend defaults to `http://localhost:8000/api/v1`. Override with:

```bash
NEXT_PUBLIC_API_BASE_URL="http://localhost:8000/api/v1"
```

### Docker Compose

```bash
make docker-up
```

Services:

- API: `http://localhost:8000`
- Web: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

## Environment

See [.env.example](.env.example).

Important variables:

- `DATABASE_URL`: SQLite or PostgreSQL SQLAlchemy URL.
- `STORAGE_DIR`: local file storage directory.
- `MAX_UPLOAD_BYTES`: upload size limit.
- `CORS_ORIGINS`: JSON array of allowed frontend origins.
- `NEXT_PUBLIC_API_BASE_URL`: frontend API base URL.
- `TESSERACT_CMD`: optional path to the `tesseract` binary.
- `LM_STUDIO_ENABLED`: enable local VLM parsing.
- `LM_STUDIO_BASE_URL`: OpenAI-compatible LM Studio base URL.
- `LM_STUDIO_VLM_MODEL`: local VLM model name.
- `LM_STUDIO_EMBEDDING_ENABLED`: enable local embeddings.
- `LM_STUDIO_EMBEDDING_MODEL`: embedding model name.

## Local Parser Support

| Input | Primary local parser | Behavior |
| --- | --- | --- |
| PDF with text layer | `pdf_native_text` | Extracts page text and layout blocks with PyMuPDF. |
| Scanned PDF | `tesseract_ocr` or `mock_vlm` fallback | Renders PDF pages for local OCR or VLM parsing. |
| DOCX | `docx_text` | Extracts paragraphs and tables with python-docx. |
| HTML | `html_text` | Extracts clean text, tables, and image metadata with BeautifulSoup. |
| Image | `image_ocr` | Runs local Tesseract OCR when available; otherwise falls back to review/VLM paths. |
| Local VLM | `mock_vlm` | Compatibility parser id that calls LM Studio when `LM_STUDIO_ENABLED=true`. |

## End-to-End Flow

1. Upload a file through the UI or `POST /api/v1/files/upload`.
2. Backend stores the file, calculates checksum, and creates a `FileRecord`.
3. File profiling detects type, modality, text/scanned signals, layout complexity, and recommended strategy.
4. Parser selector creates an explainable plan.
5. Orchestration runs the parser, evaluates quality, optionally triggers fallback, publishes a parsed asset, and creates review items when confidence is low.
6. Audit and observability endpoints expose operational signals to the UI.

## API Examples

Upload a sample:

```bash
curl -F "file=@sample_files/invoice.html;type=text/html" \
  http://localhost:8000/api/v1/files/upload
```

Create a parsing job:

```bash
curl -X POST http://localhost:8000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "replace-with-uploaded-file-id",
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
    "governance_constraints": {
      "external_services_allowed": true
    }
  }'
```

Create a parser-agent task from an uploaded file:

```bash
curl -X POST http://localhost:8000/api/v1/agent/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "replace-with-uploaded-file-id",
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
    "governance_constraints": {
      "external_services_allowed": true
    }
  }'
```

Create a multi-file task, or materialize inline text as an agent input:

```bash
curl -X POST http://localhost:8000/api/v1/agent/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "file_ids": ["first-file-id", "second-file-id"],
    "requested_output_contract": {"parsed_text": true}
  }'

curl -X POST http://localhost:8000/api/v1/agent/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "text_payload": "Inline document text to parse",
    "requested_output_contract": {"parsed_text": true}
  }'
```

The parser agent uses Google ADK internally. FastAPI remains the public API boundary,
and SQLAlchemy remains the durable system of record for task state, artifacts,
quality, audit, and lineage.
The ADK runtime exposes named internal phase agents, skill discovery, and a
governed tool gateway metadata surface; parser execution remains deterministic
and persisted behind the public agent task API.
The local runtime uses an in-process background worker; deploy a real queue for
multi-instance production workloads.

Task events are available both as JSON and as an SSE-compatible stream:

```bash
curl http://localhost:8000/api/v1/agent/tasks/{task_id}/events
curl http://localhost:8000/api/v1/agent/tasks/{task_id}/events/stream
```

Operational checks:

```bash
curl http://localhost:8000/api/v1/dashboard/summary
curl http://localhost:8000/api/v1/review/summary
curl http://localhost:8000/api/v1/jobs/metrics
curl http://localhost:8000/api/v1/parsers/metrics
curl http://localhost:8000/api/v1/observability/summary
```

More examples are in [docs/api_examples.md](docs/api_examples.md).

## Verification

Backend:

```bash
make verify-api
```

Frontend:

```bash
make verify-web
```

Full verification:

```bash
make verify
```

Cleanup generated local files:

```bash
make clean
```

Cleanup generated files plus local runtime database/storage:

```bash
make clean-state
```

## Handoff Docs

- [AGENTS.md](AGENTS.md): repository rules for AI coding agents.
- [AI_HANDOFF.md](AI_HANDOFF.md): current implementation state, known gaps, and next recommended work.
- [Codex.md](Codex.md): original product and architecture guidance.
- [docs/architecture.md](docs/architecture.md): system architecture details.
- [docs/api_contract.md](docs/api_contract.md): API reference.
