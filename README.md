# Multimodal Processing Agent

Enterprise MVP for multimodal file intake, parser selection, synchronous parsing orchestration, quality scoring, human review routing, asset publishing, skills, MCP tool wrappers, governance, audit, and observability.

Full production parsing is intentionally out of scope for this MVP. External OCR, VLM, speech, and document-intelligence adapters use mock or lightweight behavior unless their dependencies are available.

## Local Setup

### Backend

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev,postgres]"
cp .env.example .env
uvicorn backend.app.main:app --reload --port 8000
```

The default database is SQLite at `./local.db`. PostgreSQL is supported by setting `DATABASE_URL`.

Health check:

```bash
curl http://localhost:8000/api/v1/health
```

### Frontend

```bash
cd frontend
npm install
npm run dev -- --port 3000
```

Open `http://localhost:3000` or `http://127.0.0.1:3000`.

### Docker Compose

```bash
docker compose up --build
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
- `LOG_LEVEL`: backend logging level.
- `NEXT_PUBLIC_API_BASE_URL`: frontend API base URL.

## Sample Files

Use files in [sample_files](sample_files) for manual testing:

- `invoice.html`: supported HTML invoice sample.
- `contract.html`: supported HTML contract sample.
- `low_confidence_image_placeholder.png.txt`: instructions for image review testing.

## End-to-End Flow

1. Upload a file from Home.
2. Backend stores it locally, calculates checksum, and creates a `FileRecord`.
3. File profiling detects file type, modalities, text/scanned signals, layout complexity, and recommended strategy.
4. Parser selector creates an explainable plan.
5. Orchestration runs the parser, evaluates quality, optionally triggers fallback, publishes a unified parsed asset, and creates review items when confidence is low.
6. Audit and observability endpoints expose operational signals.

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

View observability:

```bash
curl http://localhost:8000/api/v1/observability/summary
curl http://localhost:8000/api/v1/observability/parser-usage
curl http://localhost:8000/api/v1/observability/quality
curl http://localhost:8000/api/v1/audit/events
```

More examples are in [docs/api_examples.md](docs/api_examples.md).

## Current UI

- Home / Upload
- Jobs
- Job Detail
- Parser Registry
- Skills Registry
- Human Review Queue
- Asset Viewer
- Observability

## Tests

```bash
pytest
python -m ruff check backend tests
cd frontend
npm run typecheck
npm run lint
npm run build
```

## Known Limitations

- Parsing is synchronous for MVP ergonomics; no queue worker is included yet.
- External parser adapters are placeholders unless dependencies and credentials are added.
- PII detection and restricted document detection are heuristic placeholders.
- SQLite dev migrations are intentionally lightweight; production should use Alembic.
- Review approve/reject UI is local-only until persisted review actions are implemented.
- Authentication, authorization, tenant isolation, and secrets management are not implemented.
