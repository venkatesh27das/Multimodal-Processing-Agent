# Multimodal Processing Agent

An enterprise-style multimodal parser agent for turning messy files into trusted, governed, structured assets.

This repo is both:

- an **agent API** that other apps or agents can call, built around a Google ADK-backed Multimodal Parser Agent; and
- a **Next.js operations console** for uploading files, watching parser runs, reviewing uncertain output, browsing assets, and inspecting observability.

The core idea is simple: external clients should not need to know which parser, OCR engine, skill, fallback, or review rule to call. They ask one agent to transform one or more multimodal inputs into structured assets with quality, lineage, and audit context.

```text
External app / user / another agent
        |
        v
A2A-style Multimodal Parser Agent API
        |
        v
Observe -> Plan -> Act -> Evaluate -> Repair -> Publish
        |
        +-- file profiling
        +-- parser registry and parser adapters
        +-- skill discovery and execution
        +-- governed tool gateway metadata
        +-- quality, review, audit, lineage, and asset publishing
```

## Why This Exists

Most document parsing systems become a pile of one-off routes: call OCR here, call PDF parsing there, call a table extractor somewhere else, then stitch the results together in product code. This project pushes that complexity behind one public agent boundary.

The platform keeps deterministic enterprise controls separate from agentic decisioning:

| Deterministic platform controls | Agentic/intelligent decisions |
| --- | --- |
| Upload registration, checksum, storage | File profiling and modality interpretation |
| Schema validation and persistence | Parser, fallback, and skill selection |
| Governance checks and audit logs | Quality judgement and repair planning |
| Asset publishing and lineage records | Review recommendation and reasoning trace |

The result is a parser agent that is explainable enough for enterprise workflows and flexible enough to grow into OCR, VLM, speech, video, document intelligence, MCP tools, and richer domain skills.

## What Works Today

- Upload and profile HTML, DOCX, PDF, and image files.
- Parse local HTML, DOCX, native-text PDF, image OCR, and optional LM Studio VLM paths.
- Select parsers through a registry-backed planner.
- Run fallback, quality scoring, review routing, asset publishing, audit, and observability.
- Create Google ADK-backed parser-agent tasks from uploads, file IDs, multiple file IDs, inline text, existing asset IDs, and URL placeholders.
- Poll task status or stream persisted task events over SSE.
- Inspect agent messages, artifacts, plans, steps, decisions, parser tool calls, skill invocation records, quality judgement, subtasks, and lineage.
- Use a Next.js console for Home, Parse, Jobs, Job Detail, Parsers, Skills, Review Queue, Assets, Observability, and Settings.

## Current Agent Capabilities

This is what the current implementation exposes behind the Multimodal Parser Agent boundary.

### Internal Subagents

These are represented as named Google ADK phase agents and persisted subtask trace records. They are internal capabilities, not separate public products.

| Subagent | Phase | Current responsibility |
| --- | --- | --- |
| `FileProfilerAgent` | Observe | Reads persisted file profile, modality, layout, text/scanned signals, and risk hints. |
| `ParserStrategyAgent` | Plan | Selects parser, fallback, skill, quality target, cost/latency posture, and review policy. |
| `ExtractionAgent` | Act | Runs parser adapters and records parser execution outputs. |
| `QualityAgent` | Evaluate | Scores confidence, completeness, schema validity, consistency, and review need. |
| `RepairAgent` | Repair | Uses fallback policy when confidence is below threshold or primary extraction is weak. |
| `PublisherAgent` | Publish | Creates parsed assets with quality, lineage, skill output, and audit context. |

### ADK Tools And Internal Tool Gateway

The ADK runtime currently registers these function tools:

- `observe_file_profile_tool`
- `plan_parser_strategy_tool`
- `execute_parser_plan_tool`
- `evaluate_quality_tool`
- `publish_asset_tool`
- `discover_skills_tool`
- `tool_gateway_policy_tool`

The internal tool gateway currently exposes capability metadata and governance filtering for:

| Tool gateway id | Category | Status |
| --- | --- | --- |
| `parser.registry` | parser selection | Local metadata-backed capability. |
| `parser.adapter` | parsing | Local parser execution path; external use is policy-gated. |
| `skill.registry` | skill selection | Local skill discovery metadata. |
| `quality.evaluator` | quality evaluation | Local quality scoring capability. |
| `asset.publisher` | asset publishing | Local governed asset publishing capability. |

### Parser Tools

Parser adapters are pluggable through the parser registry.

| Parser id | Type | Deployment | Status |
| --- | --- | --- | --- |
| `pdf_native_text` | deterministic PDF | local | Real parser for PDFs with native text layers. |
| `docx_text` | deterministic DOCX | local | Real parser for DOCX paragraphs and tables. |
| `html_text` | deterministic HTML | local | Real parser for clean text, tables, and image metadata. |
| `image_ocr` | OCR | local | Real path when Tesseract is installed. |
| `tesseract_ocr` | OCR | local | OCR fallback for images and rendered PDF pages. |
| `mock_vlm` | VLM | local LM Studio | Calls a local OpenAI-compatible LM Studio VLM endpoint when enabled. |
| `azure_document_intelligence` | document intelligence | external | Placeholder adapter; credentials/service integration pending. |
| `audio_transcription` | speech | local | Placeholder adapter; real speech model pending. |
| `video_parser` | video | local | Placeholder adapter; real media pipeline pending. |

### MCP-Style Tools

The MVP includes a lightweight MCP-style tool registry at `GET /api/v1/mcp/tools`. It does not require the MCP SDK yet; handlers are local Python callables that can later be wrapped by a real MCP transport.

| MCP tool | What it does today |
| --- | --- |
| `parse_document` | Runs the orchestration flow for one registered file. |
| `parse_batch` | Runs parsing for multiple registered files. |
| `get_parse_status` | Returns parse job status and parser metadata. |
| `get_document_assets` | Returns parsed assets for a file. |
| `get_quality_report` | Returns the latest quality report for a job. |
| `compare_parser_outputs` | Runs selected parsers and compares confidence scores. |
| `reprocess_with_strategy` | Re-runs parsing with explicit strategy fields. |
| `submit_human_review` | Creates a human review item for a parse job. |

### Skills

Skills are folder-backed capabilities under `backend/app/skills` and are also seeded into the skills registry.

| Skill id | Purpose | Supported document types |
| --- | --- | --- |
| `invoice_extraction` | Invoice numbers, vendors, totals, line items, and due dates. | PDF, DOCX, image |
| `contract_parsing` | Parties, terms, obligations, clauses, and effective dates. | PDF, DOCX |
| `research_paper_parsing` | Title, authors, abstract, sections, citations, figures, and tables. | PDF, HTML |
| `audio_meeting_parsing` | Speaker turns, action items, decisions, and meeting summaries. | audio, video |
| `table_normalization` | Typed rows, columns, units, and table cleanup. | PDF, DOCX, HTML |
| `knowledge_graph_preparation` | Entities and relationships for graph-oriented publishing. | PDF, DOCX, HTML |

### Public Agent Input And Output Modes

Supported task inputs:

- uploaded file through `POST /api/v1/agent/tasks/upload`
- `file_id`
- `file_ids`
- `text_payload`
- `asset_id`
- `url` placeholder, without remote fetching in local mode

Persisted task outputs:

- file profile
- parsing plan
- agent reasoning
- parser output
- skill output
- quality report
- fallback report when used
- review request when needed
- parsed asset
- lineage report
- audit summary

## Screenshots

The UI is intentionally compact and operations-focused. The screenshots below are the current wireframe-aligned app screens in this repo.

| Home | Parse |
| --- | --- |
| ![Home screen](application%20wireframes/Home%20Screen.png) | ![Parse screen](application%20wireframes/Parse%20Screen1.png) |

| Jobs | Review Queue |
| --- | --- |
| ![Jobs screen](application%20wireframes/Jobs%20Screen.png) | ![Review queue screen](application%20wireframes/Review%20Queue%20Screen.png) |

| Assets | Observability |
| --- | --- |
| ![Assets screen](application%20wireframes/Assets%20Screen.png) | ![Observability screen](application%20wireframes/Observabiity%20Screen.png) |

## Quick Start

Prerequisites:

- Python 3.12+
- Node.js 20+
- npm
- Optional: Docker and Docker Compose
- Optional for OCR: local `tesseract` binary

Install everything:

```bash
make install
cp .env.example .env
```

Run the backend and frontend in two terminals:

```bash
make api
make web
```

Open:

- App: `http://localhost:3000`
- API docs: `http://localhost:8000/docs`
- Agent Card: `http://localhost:8000/.well-known/agent-card.json`

API-only agent mode:

```bash
make install-api
make agent-api
```

Docker:

```bash
make docker-up
```

Services:

- API: `http://localhost:8000`
- Web: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

## Consume It As An Agent API

The preferred integration path is the parser-agent task API.

### 1. Discover The Agent

```bash
curl http://localhost:8000/.well-known/agent-card.json
curl http://localhost:8000/api/v1/agent/card
```

The Agent Card describes supported modalities, input modes, output modes, skills, ADK runtime metadata, tool gateway metadata, streaming support, and endpoints.

### 2. Create A Task From Upload

```bash
curl -F "file=@sample_files/invoice.html;type=text/html" \
  http://localhost:8000/api/v1/agent/tasks/upload
```

The response includes an accepted task. Execution continues in a background FastAPI task.

### 3. Create A Task From Existing Inputs

Use a registered `file_id`:

```bash
curl -X POST http://localhost:8000/api/v1/agent/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "replace-with-file-id",
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
      "external_services_allowed": false
    }
  }'
```

Use multiple files:

```bash
curl -X POST http://localhost:8000/api/v1/agent/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "file_ids": ["first-file-id", "second-file-id"],
    "requested_output_contract": {"parsed_text": true, "tables": true}
  }'
```

Use inline text:

```bash
curl -X POST http://localhost:8000/api/v1/agent/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "text_payload": "Invoice INV-123 from Example Corp for $42.00",
    "requested_output_contract": {"parsed_text": true, "entities": true}
  }'
```

Other supported input modes:

- `asset_id`: materializes an existing parsed asset as a new agent input.
- `url`: records a governed local URL placeholder. The local runtime does not fetch remote content yet.

### 4. Track Status, Messages, Events, And Artifacts

```bash
curl http://localhost:8000/api/v1/agent/tasks/{task_id}
curl http://localhost:8000/api/v1/agent/tasks/{task_id}/messages
curl http://localhost:8000/api/v1/agent/tasks/{task_id}/artifacts
curl http://localhost:8000/api/v1/agent/tasks/{task_id}/events
curl http://localhost:8000/api/v1/agent/tasks/{task_id}/events/stream
```

Tasks move through this lifecycle:

```text
submitted -> accepted -> observing -> planning -> executing
-> evaluating -> repairing -> publishing -> completed
```

They can also become `awaiting_review`, `cancelled`, or `failed`.

### 5. Minimal Python Client

```python
import time
import requests

base_url = "http://localhost:8000/api/v1"

with open("sample_files/invoice.html", "rb") as file:
    response = requests.post(
        f"{base_url}/agent/tasks/upload",
        files={"file": ("invoice.html", file, "text/html")},
        timeout=30,
    )
response.raise_for_status()
task_id = response.json()["task"]["id"]

while True:
    task = requests.get(f"{base_url}/agent/tasks/{task_id}", timeout=30).json()
    if task["status"] in {"completed", "awaiting_review", "failed", "cancelled"}:
        break
    time.sleep(0.5)

artifacts = requests.get(f"{base_url}/agent/tasks/{task_id}/artifacts", timeout=30).json()
print(task["status"])
print([artifact["kind"] for artifact in artifacts])
```

## Consume It As A Web App

Run `make api` and `make web`, then open `http://localhost:3000`.

Core screens:

- **Home**: operational snapshot, recent jobs, parser health, review pressure, and entry points into parsing.
- **Parse**: file upload and parse workflow surface. This is where the app should increasingly converge on agent-task creation.
- **Jobs**: parse job list, status, parser used, quality, review state, and operational metadata.
- **Job Detail**: plan, quality, assets, audit, and execution context for a specific job.
- **Parsers**: parser registry, supported file types, strengths, weaknesses, deployment mode, and usage signals.
- **Skills**: folder-backed skill packs, extraction schemas, validation rules, and supported document types.
- **Review Queue**: uncertain outputs and rationale for human review.
- **Assets**: published structured assets with lineage and confidence context.
- **Observability**: quality, parser usage, audit, and system health views.
- **Settings**: local configuration and environment-oriented controls.

## API Surface

Base URL: `http://localhost:8000/api/v1`

Important routes:

| Area | Routes |
| --- | --- |
| Health | `GET /health` |
| Files | `POST /files/upload`, `GET /files/{file_id}`, `GET /files/{file_id}/profile` |
| Agent | `GET /agent/card`, `POST /agent/tasks`, `POST /agent/tasks/upload`, `GET /agent/tasks/{task_id}`, `POST /agent/tasks/{task_id}/cancel` |
| Agent Trace | `GET /agent/tasks/{task_id}/messages`, `/artifacts`, `/events`, `/events/stream` |
| Jobs | `POST /jobs`, `POST /jobs/plan`, `GET /jobs`, `GET /jobs/{job_id}` |
| Assets | `GET /assets/{asset_id}`, `GET /files/{file_id}/assets`, `GET /jobs/{job_id}/assets` |
| Registries | `GET /parser-registry`, `GET /skills-registry` |
| Observability | `GET /observability/summary`, `GET /audit/events` |
| MCP Demo | `GET /mcp/tools` |

More examples:

- [docs/api_examples.md](docs/api_examples.md)
- [docs/api_contract.md](docs/api_contract.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/mcp_design.md](docs/mcp_design.md)

## Parser And Modality Support

| Input | Primary local parser | Behavior |
| --- | --- | --- |
| PDF with text layer | `pdf_native_text` | Extracts page text and layout blocks with PyMuPDF. |
| Scanned PDF | `tesseract_ocr` or `mock_vlm` fallback | Renders pages for local OCR or VLM parsing. |
| DOCX | `docx_text` | Extracts paragraphs and tables with `python-docx`. |
| HTML | `html_text` | Extracts clean text, tables, and image metadata with BeautifulSoup. |
| Image | `image_ocr` | Runs local Tesseract OCR when available, otherwise routes to fallback/review paths. |
| Local VLM | `mock_vlm` | Compatibility parser id that calls LM Studio when `LM_STUDIO_ENABLED=true`. |

For local image OCR on macOS:

```bash
brew install tesseract
```

For local VLM parsing with LM Studio, configure:

```env
LM_STUDIO_ENABLED=true
LM_STUDIO_BASE_URL="http://localhost:1234/v1"
LM_STUDIO_VLM_MODEL="google/gemma-4-12b"
LM_STUDIO_EMBEDDING_ENABLED=true
LM_STUDIO_EMBEDDING_MODEL="text-embedding-nomic-embed-text-v1.5"
```

## Project Layout

```text
backend/app/api/routes      FastAPI route modules
backend/app/agent_adk       Google ADK runtime and ADK tool wrappers
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
application wireframes      UI reference screenshots
tests                       backend unit and service tests
```

## Configuration

See [.env.example](.env.example).

Common variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite or PostgreSQL SQLAlchemy URL. |
| `STORAGE_DIR` | Local file storage directory. |
| `MAX_UPLOAD_BYTES` | Upload size limit. |
| `CORS_ORIGINS` | JSON array of allowed frontend origins. |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend API base URL. |
| `TESSERACT_CMD` | Optional path to the `tesseract` binary. |
| `LM_STUDIO_ENABLED` | Enable local VLM parsing. |
| `LM_STUDIO_BASE_URL` | OpenAI-compatible LM Studio base URL. |
| `LM_STUDIO_VLM_MODEL` | Local VLM model name. |
| `LM_STUDIO_EMBEDDING_ENABLED` | Enable local embeddings. |
| `LM_STUDIO_EMBEDDING_MODEL` | Local embedding model name. |

## Verification

Backend:

```bash
make verify-api
```

Frontend:

```bash
make verify-web
```

Everything:

```bash
make verify
```

Cleanup generated files:

```bash
make clean
```

Cleanup generated files plus local database/storage:

```bash
make clean-state
```

## Current Limitations

This is a strong local MVP, not a production deployment template yet.

- Agent execution uses in-process FastAPI `BackgroundTasks`; production should use a durable queue and worker.
- URL input is recorded as a local placeholder; remote fetching is not implemented.
- Azure Document Intelligence, speech transcription, and video parsing adapters are placeholders.
- Legacy `.doc` files are not parsed directly; convert to DOCX or PDF.
- OCR quality depends on local Tesseract and source image quality.
- LM Studio VLM parsing requires a local model with image support.
- PII and restricted document detection use lightweight heuristics.
- SQLite schema creation is lightweight; production should use Alembic migrations.
- Human review approve/reject decisions need full durable persistence.
- Authentication, authorization, tenant isolation, and secrets management are not implemented.
- Global search and Home drag/drop-to-agent-task are still planned work.

## Roadmap

Near-term priorities:

- Move background parser-agent execution to a durable queue/worker.
- Make Home and Parse create real agent tasks directly from drag/drop.
- Add agent-native UI panels for Agent Plan, Timeline, Reasoning, Artifacts, Quality, and Lineage.
- Persist human review approve/reject decisions.
- Add global search across files, jobs, assets, parsers, skills, and agent tasks.
- Persist explicit MCP/tool gateway planning and execution records beyond local metadata.
- Add production migrations, auth, tenant isolation, and policy packs.

Capability expansion:

- Real Azure Document Intelligence adapter.
- Real audio transcription adapter.
- Real video understanding adapter.
- Richer domain skill metadata: confidence behavior, cost, latency, parser compatibility, examples.
- External MCP gateway execution for OCR, VLM, vector search, PII checks, schema validation, and table normalization.

## Good First Developer Paths

- **API integrator**: start with `POST /api/v1/agent/tasks/upload`, then read artifacts and events.
- **Frontend developer**: wire Parse/Home flows to agent tasks and render the task timeline.
- **Parser developer**: add a parser adapter under `backend/app/parsers` and register it in the parser registry seed data.
- **Skill developer**: add a skill pack under `backend/app/skills` with schema, validation rules, and examples.
- **Platform developer**: replace in-process background execution with a durable worker.

## Handoff And Design Docs

- [AGENTS.md](AGENTS.md): repo-level instructions for AI coding agents.
- [AI_HANDOFF.md](AI_HANDOFF.md): current implementation state, known gaps, and next recommended work.
- [Codex.md](Codex.md): original product and architecture guidance.
- [docs/architecture.md](docs/architecture.md): system architecture details.
- [docs/api_contract.md](docs/api_contract.md): API reference.
- [docs/api_examples.md](docs/api_examples.md): copy-paste API examples.
