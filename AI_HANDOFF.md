# AI Handoff

Last updated: 2026-06-28

## Current State

The repo contains a working local MVP for an enterprise multimodal parsing agent:

- FastAPI backend with SQLite default storage.
- Next.js frontend with compact enterprise UI aligned to supplied wireframes.
- Local parsers for HTML, DOCX, native-text PDF, image OCR, and optional LM Studio VLM.
- Parser registry, skills registry, parsing plan, synchronous job execution, quality evaluation, fallback, asset publishing, audit, and observability.
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

- Global search in the app shell is still mostly visual.
- Home drag/drop does not yet upload directly into a parse workflow.
- Quick templates are still shortcut-style UI; they are not a backend-authored template catalog.
- Human review actions need durable approve/reject persistence.
- Job execution is synchronous; a production version needs a queue and worker.
- Azure Document Intelligence, audio transcription, and video parsing are placeholders.
- Authentication, authorization, tenant isolation, and secrets management are not implemented.
- Production migrations are not implemented; SQLite dev schema creation is lightweight.

## Suggested Next Work

1. Implement real global search with a backend `/search` endpoint across files, jobs, assets, parsers, and skills.
2. Connect Home drag/drop to the existing file upload and parse workflow state.
3. Add persisted review decisions and reflect them in Review Queue, Home, Jobs, and Job Detail.
4. Add backend trend series for dashboard sparklines instead of hiding them.
5. Add tests for the dashboard, review summary, jobs metrics, and parser metrics routes.
6. Add a background worker and async job state transitions.

## Files Future Agents Should Read First

- [README.md](README.md)
- [AGENTS.md](AGENTS.md)
- [Codex.md](Codex.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/api_contract.md](docs/api_contract.md)
- [backend/app/services/orchestration_engine.py](backend/app/services/orchestration_engine.py)
- [backend/app/services/parser_selector.py](backend/app/services/parser_selector.py)
- [frontend/api/dashboard.ts](frontend/api/dashboard.ts)
- [frontend/app/page.tsx](frontend/app/page.tsx)
