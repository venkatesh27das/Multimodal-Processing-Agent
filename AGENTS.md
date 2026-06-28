# AI Agent Instructions

Use this file as the repo-level operating guide for future AI coding agents.

## Project Intent

This repo is an enterprise multimodal parsing agent. Preserve the separation between deterministic platform controls and agentic decisioning:

- Deterministic: upload registration, checksum, storage, schema validation, persistence, governance checks, audit logs, and asset publishing.
- Agentic/intelligent: file profiling, parser selection, parsing strategy, fallback planning, skill selection, quality interpretation, review recommendation, and MCP/tool planning.

## Local Commands

Backend:

```bash
source .venv/bin/activate
uvicorn backend.app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm run dev -- --port 3000
```

Verification:

```bash
pytest
python -m ruff check backend tests
PYTHONPYCACHEPREFIX=/tmp/mmpa-pycache python3 -m compileall backend/app
cd frontend
npm run typecheck
npm run lint
```

## Editing Rules

- Prefer existing service boundaries over adding business logic to route files.
- Keep API response contracts in `backend/app/schemas` unless a tiny route-local response model is clearly scoped.
- Keep parser adapters pluggable through `backend/app/parsers/base.py` and registry metadata.
- Keep frontend API calls in `frontend/api`; screens should consume typed API helpers or hooks.
- Do not reintroduce frontend mock data for production views unless it is behind an explicit demo fixture.
- Do not hardcode parser decisions in the UI. Show backend decisions, metrics, and explanations.
- Preserve compact UI density: the app is designed to match wireframes at 100% browser zoom using a 14px root font.
- Do not commit local runtime state: `local.db`, `storage/`, `.venv/`, `.next/`, `node_modules/`, caches.

## Current High-Value Areas

- Make global search functional across jobs, files, parsers, and assets.
- Make Home drag/drop create or prefill a real parse workflow.
- Persist human review approve/reject decisions.
- Add durable background job execution instead of synchronous parsing.
- Replace placeholder cloud/audio/video adapters with real implementations.
- Add auth, tenant isolation, and production-grade policy packs.

## Backend-Backed Screen Expectations

- Home should read dashboard, review, jobs, parser, and observability data from APIs.
- Jobs and Job Detail should read jobs, plans, quality, and assets from APIs.
- Parsers should use `/parser-registry` and backend parser usage metrics.
- Skills should use `/skills-registry` and backend-derived usage where available.
- Observability should use persisted jobs, audit, parser usage, and quality reports.

## Before Handoff

Run at least:

```bash
PYTHONPYCACHEPREFIX=/tmp/mmpa-pycache python3 -m compileall backend/app
cd frontend
npm run typecheck
```

Then update [AI_HANDOFF.md](AI_HANDOFF.md) if behavior, setup, or known gaps changed.
