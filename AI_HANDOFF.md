# AI Handoff

Last updated: 2026-06-29

## Current State

The repo contains a working local MVP for an enterprise multimodal parsing agent:

- FastAPI backend with SQLite default storage.
- Next.js frontend with compact enterprise UI aligned to supplied wireframes.
- Local parsers for HTML, DOCX, native-text PDF, image OCR, and optional LM Studio VLM.
- Parser registry, skills registry, parsing plan, synchronous job execution, quality evaluation, fallback, asset publishing, audit, and observability.
- A first backend slice of the A2A-style Multimodal Parser Agent API is now available. It exposes an Agent Card, creates parser-agent tasks, uses a Google ADK-backed workflow runtime, runs parser-agent work through a DB-backed worker claim flow, supports multi-file/file/text/asset/URL-placeholder inputs, and persists an agent trace with messages, artifacts, plan, steps, decisions, parser tool calls, skill invocation records, quality judgement, subtasks, and lineage.
- The ADK runtime now exposes named internal phase agents, planner-facing skill discovery, and a governed internal tool gateway metadata surface for parser selection, parsing, OCR, VLM, document intelligence, speech/video placeholders, schema validation, table normalization, policy checks, embeddings, quality evaluation, and asset publishing.
- Agent tasks now persist a normalized `tool_policy` snapshot in `input_payload`, a `tool_policy` decision record, and gateway `AgentToolCall` planning records for selected non-parser capabilities. Skill invocation payloads now include planner-selectable skill metadata such as required inputs, produced outputs, JSON schema, validation rules, confidence behavior, cost/latency posture, parser compatibility, and examples.
- Home, Jobs, Job Detail, Parsers, and Skills screens have been moved away from mock-only presentation toward backend-backed data.

## Recent UI/Backend Alignment Work

Home:

- Removed frontend mock dashboard data.
- Added backend routes for dashboard and review summaries.
- Added backend metrics routes for jobs and parsers.
- Removed fake generated sparklines when the backend does not provide trend series.

Parsers:

- Parser page data should come from `/api/v1/parser-registry`.
- Usage, success, latency, and degradation signals should come from backend parser metrics where available.

Skills:

- Skills page should come from `/api/v1/skills-registry`.
- Avoid deterministic fake success/usage metrics unless a real backend metric exists.

Density and wireframe alignment:

- Root UI font size is intentionally 14px.
- Header, sidebar, cards, tables, and controls are compact to match the provided screenshots at 100% browser zoom.

## Important Local Endpoints

Base URL: `http://localhost:8000/api/v1`

Useful checks:

```bash
curl http://localhost:8000/api/v1/health
curl http://localhost:8000/api/v1/dashboard/summary
curl http://localhost:8000/api/v1/review/summary
curl http://localhost:8000/api/v1/jobs/metrics
curl http://localhost:8000/api/v1/parsers/metrics
curl http://localhost:8000/api/v1/observability/summary
curl http://localhost:8000/api/v1/parser-registry
curl http://localhost:8000/api/v1/skills-registry
curl http://localhost:8000/.well-known/agent-card.json
curl http://localhost:8000/api/v1/agent/card
curl http://localhost:8000/api/v1/agent/tasks
curl -F "file=@sample_files/invoice.html;type=text/html" http://localhost:8000/api/v1/agent/tasks/upload
curl -X POST http://localhost:8000/api/v1/agent/tasks -H "Content-Type: application/json" -d '{"text_payload":"Inline document text","requested_output_contract":{"parsed_text":true}}'
```

Agent task routes:

```bash
POST /api/v1/agent/tasks
POST /api/v1/agent/tasks/upload
GET  /api/v1/agent/tasks
GET  /api/v1/agent/tasks/{task_id}
POST /api/v1/agent/tasks/{task_id}/cancel
GET  /api/v1/agent/tasks/{task_id}/messages
GET  /api/v1/agent/tasks/{task_id}/artifacts
GET  /api/v1/agent/tasks/{task_id}/events
GET  /api/v1/agent/tasks/{task_id}/events/stream
```

## How To Run

Recommended one-command setup:

```bash
make install
cp .env.example .env
```

Backend:

```bash
make api
```

Frontend:

```bash
make web
```

Open `http://localhost:3000`.

API-only agent work:

```bash
make install-api
make agent-api
```

Docker deployment:

```bash
make docker-up
```

## Verification Commands

Backend:

```bash
make verify-api
```

Frontend:

```bash
make verify-web
```

## Known Gaps

- The core Multimodal Parser Agent now has a first backend API, Google ADK workflow adapter, direct upload-to-agent endpoint, multi-file task execution, text payload materialization, asset-reference materialization, URL-placeholder materialization, background execution, SSE-compatible event streaming, durable cancellation before/between major phases, and persistence slice.
- Background execution now routes through the same persisted worker claim flow as `make agent-worker`. Agent tasks carry `worker_id`, `attempt_count`, `max_attempts`, lock, heartbeat, and retry timing fields.
- URL input is a local governed placeholder only; remote URL fetching is intentionally not implemented in this local mode.
- Live streaming is backed by persisted task messages/events emitted by the worker; websocket streaming is not implemented.
- Home upload and the Parse screen now create parser-agent tasks. Parse and Job Detail show first Agent Trace panels with timeline, plan, reasoning, artifacts, quality, and task status. Some legacy list views still read job endpoints.
- MCP/tool gateway support currently exposes capability metadata, governance policy filtering, and persisted planning traces; real external MCP service execution is still pending.
- Global search in the app shell is still mostly visual.
- Quick templates are still shortcut-style UI; they are not a backend-authored template catalog.
- Human review approve/reject decisions are persisted through `/api/v1/review/items/{id}/approve` and `/api/v1/review/items/{id}/reject`, with audit events and a backend-backed Review Queue page.
- A DB-backed persisted agent worker is available through `make agent-worker` / `python -m backend.app.workers.agent_worker`. It supports claims, configurable attempts, retry backoff, heartbeat lock extension, and stale-lock recovery. Production still needs a dedicated queue backend, dead-letter handling, and operational dashboards before high-concurrency multi-instance deployment.
- Azure Document Intelligence, audio transcription, and video parsing are placeholders.
- Authentication, authorization, tenant isolation, and secrets management are not implemented.
- Production migrations are not implemented; SQLite dev schema creation is lightweight.

## Suggested Next Work

Priority 1 is to turn the current orchestration platform into a single public **A2A-style Multimodal Parser Agent**. The main agent should be the stable API boundary. Internally it can call parser services, skills, MCP tools, and subagents, but external clients should interact with one agent.

### Priority 1: A2A Multimodal Parser Agent

1. Replace the DB-backed local queue with a production queue backend, dead-letter workflow, and worker dashboard.
2. Make remaining REST screens read from or delegate to the core agent task model where possible.
3. Deepen Home/Parse agent task UX with direct task detail navigation and multi-task history.
4. Deepen policy controls around subagents and task-level data residency beyond the current tool/category/external-service gateway checks.
5. Add richer UI treatment for tool policy decisions and skill metadata inside Agent Plan, Agent Timeline, Agent Reasoning, Artifacts, Quality, and Lineage panels.

### Priority 2: Internal Capabilities Behind The Agent

1. Define a persisted internal subagent registry beyond the current ADK phase-agent metadata.
2. Connect the MCP/tool gateway to real OCR, VLM, document intelligence, vector search, policy, or external parsing tools through a consistent execution interface.
3. Add persisted skill evaluation sets and quality calibration beyond the current planner metadata.
4. Add persisted policy controls around internal subagents and reviewer routing.

### Priority 3: Agentic UI

1. Expand Agent Plan and Agent Reasoning panels with richer artifact detail views.
2. Deepen the agent timeline with parser alternatives, tool decisions, and fallback rationale.
3. Add full artifact detail views for file profile, parsing plan, parsed asset, quality report, review request, and lineage report.
4. Connect remaining shortcut/template flows to create real parser-agent tasks.
5. Implement global search with a backend `/search` endpoint across files, jobs, assets, parsers, skills, and agent tasks.

### Priority 4: Operational Hardening

1. Reflect persisted review decisions in Home, Jobs, and Job Detail.
2. Add backend trend series for dashboard sparklines instead of hiding them.
3. Add tests for dashboard, review summary, jobs metrics, parser metrics, and new agent task routes.
4. Add worker metrics, retry/dead-letter observability, and async job/task state transition dashboards.

## Files Future Agents Should Read First

- [README.md](README.md)
- [AGENTS.md](AGENTS.md)
- [Codex.md](Codex.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/api_contract.md](docs/api_contract.md)
- [backend/app/services/orchestration_engine.py](backend/app/services/orchestration_engine.py)
- [backend/app/agent_adk/runtime.py](backend/app/agent_adk/runtime.py)
- [backend/app/services/multimodal_parser_agent.py](backend/app/services/multimodal_parser_agent.py)
- [backend/app/api/routes/agent.py](backend/app/api/routes/agent.py)
- [backend/app/schemas/agent.py](backend/app/schemas/agent.py)
- [backend/app/services/parser_selector.py](backend/app/services/parser_selector.py)
- [frontend/api/dashboard.ts](frontend/api/dashboard.ts)
- [frontend/app/page.tsx](frontend/app/page.tsx)
