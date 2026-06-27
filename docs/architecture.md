# Architecture

## Goal

The Multimodal Parsing Agent is an orchestration platform for governed file intake, parser selection, parsing execution, quality evaluation, fallback planning, skills, and review workflows.

This scaffold implements the platform frame only. Parsing adapters, agentic planning, quality evaluation, and MCP tool calls are intentionally placeholders.

## Backend Layers

- `api/routes`: HTTP entry points for health, file intake, parse jobs, and parser registry.
- `schemas`: Pydantic request and response contracts.
- `models`: SQLAlchemy persistence models for file registry and parse jobs.
- `db`: database engine, base model, session dependency, and local table initialization.
- `services`: deterministic storage and parser registry placeholders.

## Deterministic Boundaries

The MVP keeps these concerns deterministic:

- File registration metadata
- MIME type and extension capture
- Size and SHA-256 checksum
- Local storage path
- Database persistence
- API response contracts

Future agentic modules should sit behind typed service boundaries and produce explainable plans rather than mutating registry records directly.

## Initial Data Flow

```mermaid
flowchart LR
  UI["Next.js Upload Card"] --> API["FastAPI Upload Route"]
  API --> Storage["Local File Storage"]
  API --> DB["File Registry Table"]
  DB --> Job["Parse Job Placeholder"]
  Job --> Registry["Parser Registry Placeholder"]
```

## Database

`DATABASE_URL` defaults to SQLite for local testing:

```text
sqlite:///./local.db
```

PostgreSQL is supported by setting:

```text
postgresql+psycopg://mpa:mpa@localhost:5432/mpa
```

Tables are created at API startup in this scaffold. A production version should add Alembic migrations before schema changes become meaningful.

## Frontend

The frontend uses Next.js App Router, TypeScript, and Tailwind CSS. It provides:

- Enterprise SaaS shell
- Sidebar navigation
- Header
- Home upload surface
- Jobs placeholder
- Parser Registry placeholder
- Skills Registry placeholder
- Review Queue placeholder
- Observability placeholder

The upload component is currently a UI surface. API wiring can be added once the parse-job workflow is ready.

## Near-Term Next Steps

- Add Alembic migrations.
- Wire frontend upload to `POST /api/v1/files/upload`.
- Implement parser adapter base classes.
- Add file profiling service.
- Add parser scoring and explainable selection.
- Add parse plan and execution state transitions.
- Add skills folder convention and registry loader.

