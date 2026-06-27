# Multimodal Processing Agent

Enterprise-grade multimodal parsing orchestration platform. The current scaffold provides a runnable FastAPI backend, PostgreSQL-ready configuration with local SQLite fallback, and a Next.js TypeScript frontend shell for intake, jobs, registries, review, and observability.

Full parsing is intentionally not implemented yet. This first version establishes clean boundaries, typed contracts, and local development ergonomics.

## Project Structure

```text
backend/
  app/
    api/routes/          FastAPI route modules
    core/                application settings
    db/                  SQLAlchemy engine/session/base
    models/              SQLAlchemy persistence models
    schemas/             Pydantic API contracts
    services/            storage and registry placeholders
frontend/
  app/                   Next.js App Router pages
  components/            SaaS shell and shared UI
  lib/                   typed frontend helpers
docs/
  architecture.md
  api_contract.md
```

## Backend

Create an environment and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev,postgres]"
cp .env.example .env
uvicorn backend.app.main:app --reload --port 8000
```

The default `DATABASE_URL` is `sqlite:///./local.db`, so the API runs locally without PostgreSQL. Tables are created at startup for the MVP scaffold.

Health check:

```bash
curl http://localhost:8000/api/v1/health
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Docker Compose

```bash
docker compose up --build
```

Services:

- API: `http://localhost:8000`
- Web: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

## Current API Surface

- `GET /api/v1/health`
- `POST /api/v1/files/upload`
- `POST /api/v1/parse-jobs`
- `GET /api/v1/parse-jobs`
- `GET /api/v1/parser-registry`
- `GET /api/v1/parser-registry/{parser_id}`

See [docs/api_contract.md](docs/api_contract.md) for the initial contract details.
