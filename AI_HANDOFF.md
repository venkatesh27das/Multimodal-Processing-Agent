# AI Handoff

Last updated: 2026-06-29

## Current State

The repo contains a working local MVP for an enterprise multimodal parsing agent:

- FastAPI backend with SQLite default storage.
- Next.js frontend with compact enterprise UI aligned to supplied wireframes.
- Local parsers for HTML, DOCX, native-text PDF, image OCR, and optional LM Studio VLM.
- Parser registry, skills registry, parsing plan, synchronous job execution, quality evaluation, fallback, asset publishing, audit, and observability.
- A first backend slice of the A2A-style Multimodal Parser Agent API is now available. It exposes an Agent Card, creates parser-agent tasks, uses a Google ADK-backed workflow runtime, runs parser-agent work in an in-process FastAPI background task, supports multi-file/file/text/asset/URL-placeholder inputs, and persists an agent trace with messages, artifacts, plan, steps, decisions, parser tool calls, skill invocation records, quality judgement, subtasks, and lineage.
- The ADK runtime now exposes named internal phase agents, planner-facing skill discovery, and a governed internal tool gateway metadata surface for parser selection, parsing, skill selection, quality evaluation, and asset publishing.
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
- Background execution is currently in-process via FastAPI `BackgroundTasks`; a production queue/worker remains pending for multi-instance deployments and crash recovery.
- URL input is a local governed placeholder only; remote URL fetching is intentionally not implemented in this local mode.
- Live streaming is backed by persisted task messages/events emitted by the worker; websocket streaming is not implemented.
- The canonical agent trace is persisted for the synchronous flow, but existing UI screens still mostly read legacy job endpoints instead of the agent task trace.
- MCP/tool gateway support currently exposes local capability metadata and governance policy filtering; real external MCP service execution is still pending.
- Global search in the app shell is still mostly visual.
- Home drag/drop does not yet upload directly into a parse workflow.
- Quick templates are still shortcut-style UI; they are not a backend-authored template catalog.
- Human review actions need durable approve/reject persistence.
- Job execution is synchronous; a production version needs a queue and worker.
- Azure Document Intelligence, audio transcription, and video parsing are placeholders.
- Authentication, authorization, tenant isolation, and secrets management are not implemented.
- Production migrations are not implemented; SQLite dev schema creation is lightweight.

## Suggested Next Work

Priority 1 is to turn the current orchestration platform into a single public **A2A-style Multimodal Parser Agent**. The main agent should be the stable API boundary. Internally it can call parser services, skills, MCP tools, and subagents, but external clients should interact with one agent.

### Priority 1: A2A Multimodal Parser Agent

1. Replace the in-process background worker with a durable queue/worker for production.
2. Make existing REST screens read from or delegate to the core agent task model where possible.
3. Connect Home and Parse upload flows to `POST /api/v1/agent/tasks/upload`.
4. Persist explicit MCP/tool gateway planning records for non-parser tools when they are selected.
5. Expand policy controls around which tools, MCPs, subagents, and external services the agent may use per task.
6. Add UI panels for Agent Plan, Agent Timeline, Agent Reasoning, Artifacts, Quality, and Lineage.

### Priority 2: Internal Capabilities Behind The Agent

1. Define a persisted internal subagent registry beyond the current ADK phase-agent metadata.
2. Connect the MCP/tool gateway to real OCR, VLM, document intelligence, vector search, policy, or external parsing tools through a consistent execution interface.
3. Expand skills into richer planner-selectable capabilities with declared confidence behavior, cost/latency expectations, and compatibility metadata.
4. Add policy controls around which tools, MCPs, subagents, and external services the agent may use per task.

### Priority 3: Agentic UI

1. Add Agent Plan and Agent Reasoning panels to Parse and Job Detail.
2. Show the agent timeline: observed, planned, parser selected, skill invoked, fallback attempted, quality judged, review requested, asset published.
3. Show task artifacts such as file profile, parsing plan, parsed asset, quality report, review request, and lineage report.
4. Connect Home drag/drop to create a real parser-agent task.
5. Implement global search with a backend `/search` endpoint across files, jobs, assets, parsers, skills, and agent tasks.

### Priority 4: Operational Hardening

1. Add persisted review decisions and reflect them in Review Queue, Home, Jobs, and Job Detail.
2. Add backend trend series for dashboard sparklines instead of hiding them.
3. Add tests for dashboard, review summary, jobs metrics, parser metrics, and new agent task routes.
4. Add a background worker and async job/task state transitions.

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
