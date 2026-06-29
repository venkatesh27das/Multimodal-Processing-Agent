# AI Handoff

Last updated: 2026-06-29

## Current State

The repo contains a working local MVP for an enterprise multimodal parsing agent:

- FastAPI backend with SQLite default storage.
- Next.js frontend with compact enterprise UI aligned to supplied wireframes.
- Local parsers for HTML, DOCX, native-text PDF, image OCR, and optional LM Studio VLM.
- Parser registry, skills registry, parsing plan, synchronous job execution, quality evaluation, fallback, asset publishing, audit, and observability.
- A first backend slice of the A2A-style Multimodal Parser Agent API is now available. It exposes an Agent Card, creates parser-agent tasks, delegates to the existing synchronous parser orchestration path, and persists an agent trace with messages, artifacts, plan, steps, decisions, parser tool calls, skill invocation records, quality judgement, subtasks, and lineage.
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
```

Agent task routes:

```bash
POST /api/v1/agent/tasks
GET  /api/v1/agent/tasks
GET  /api/v1/agent/tasks/{task_id}
POST /api/v1/agent/tasks/{task_id}/cancel
GET  /api/v1/agent/tasks/{task_id}/messages
GET  /api/v1/agent/tasks/{task_id}/artifacts
GET  /api/v1/agent/tasks/{task_id}/events
```

## How To Run

Backend:

```bash
source .venv/bin/activate
uvicorn backend.app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev -- --port 3000
```

Open `http://localhost:3000`.

## Verification Commands

Backend:

```bash
pytest
python -m ruff check backend tests
PYTHONPYCACHEPREFIX=/tmp/mmpa-pycache python3 -m compileall backend/app
```

Frontend:

```bash
cd frontend
npm run typecheck
npm run lint
npm run build
```

## Known Gaps

- The core Multimodal Parser Agent now has a first backend API and persistence slice, but it still executes synchronously and only supports the existing file-id based local parse path.
- Agent event streaming is currently implemented as pollable task events, not server-sent events or websocket streaming.
- The canonical agent trace is persisted for the synchronous flow, but existing UI screens still mostly read legacy job endpoints instead of the agent task trace.
- MCP/tool gateway records currently model parser adapters as internal tool calls; a generalized MCP gateway abstraction is still pending.
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

1. Extend the first-class `MultimodalParserAgent` service beyond the synchronous file-id flow into async/background execution.
2. Replace pollable task events with real event streaming once lifecycle persistence is stable.
3. Make existing REST screens read from or delegate to the core agent task model where possible.
4. Connect Home and Parse upload flows to `POST /api/v1/agent/tasks`.
5. Add generalized MCP/tool gateway records beyond parser-adapter tool-call traces.
6. Expand policy controls around which tools, MCPs, subagents, and external services the agent may use per task.
7. Add UI panels for Agent Plan, Agent Timeline, Agent Reasoning, Artifacts, Quality, and Lineage.

### Priority 2: Internal Capabilities Behind The Agent

1. Define an internal subagent registry for focused capabilities such as File Profiler, Parser Strategy, Extraction, Quality, Repair, Review, and Publisher.
2. Define an MCP/tool gateway so the core parser agent can call OCR, VLM, document intelligence, vector search, policy, or external parsing tools through a consistent interface.
3. Make skills first-class planner-selectable capabilities with declared inputs, outputs, supported document types, confidence behavior, and validation rules.
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
- [backend/app/services/multimodal_parser_agent.py](backend/app/services/multimodal_parser_agent.py)
- [backend/app/api/routes/agent.py](backend/app/api/routes/agent.py)
- [backend/app/schemas/agent.py](backend/app/schemas/agent.py)
- [backend/app/services/parser_selector.py](backend/app/services/parser_selector.py)
- [frontend/api/dashboard.ts](frontend/api/dashboard.ts)
- [frontend/app/page.tsx](frontend/app/page.tsx)
