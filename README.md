# Multimodal Processing Agent

Enterprise MVP for multimodal file intake, parser selection, synchronous parsing orchestration, quality scoring, human review routing, asset publishing, skills, MCP tool wrappers, governance, audit, and observability.

The MVP now includes real local parsing for HTML, DOCX, native-text PDFs, image OCR,
and optional LM Studio VLM/embedding calls. Azure Document Intelligence and speech/video
adapters remain placeholders.

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

For local image OCR on macOS, install the system Tesseract binary:

```bash
brew install tesseract
```

Python parser dependencies are declared in `pyproject.toml`:

- `pymupdf` for native PDF text extraction and PDF page rendering.
- `python-docx` for DOCX paragraphs and tables.
- `beautifulsoup4` for clean HTML text/tables/images.
- `pillow` and `pytesseract` for local image/PDF OCR.
- `httpx` for LM Studio OpenAI-compatible calls.

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
- `TESSERACT_CMD`: optional path to the `tesseract` binary.
- `LM_STUDIO_ENABLED`: enable local VLM parsing.
- `LM_STUDIO_BASE_URL`: OpenAI-compatible LM Studio base URL, usually `http://localhost:1234/v1`.
- `LM_STUDIO_VLM_MODEL`: your local VLM model, for example `google/gemma-4-12b`.
- `LM_STUDIO_EMBEDDING_ENABLED`: enable local embeddings.
- `LM_STUDIO_EMBEDDING_MODEL`: your embedding model, for example `text-embedding-nomic-embed-text-v1.5`.

Example local model configuration:

```env
LM_STUDIO_ENABLED=true
LM_STUDIO_BASE_URL="http://localhost:1234/v1"
LM_STUDIO_VLM_MODEL="google/gemma-4-12b"
LM_STUDIO_EMBEDDING_ENABLED=true
LM_STUDIO_EMBEDDING_MODEL="text-embedding-nomic-embed-text-v1.5"
```

## Local Parser Support

| Input | Primary local parser | Real behavior |
|---|---|---|
| PDF with text layer | `pdf_native_text` | Extracts page text and layout blocks with PyMuPDF. |
| Scanned PDF | `tesseract_ocr` or `mock_vlm` fallback | Renders PDF pages with PyMuPDF for local OCR/VLM. |
| DOCX | `docx_text` | Extracts paragraphs and tables with python-docx. |
| HTML | `html_text` | Extracts clean text, tables, and image metadata with BeautifulSoup. |
| Image | `image_ocr` | Runs local Tesseract OCR when available; falls back to review/VLM. |
| Local VLM | `mock_vlm` | Calls LM Studio chat completions when `LM_STUDIO_ENABLED=true`. |

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
- Azure Document Intelligence, speech, and video parser adapters are still placeholders.
- Legacy `.doc` files are not parsed directly; convert them to DOCX/PDF first.
- Tesseract OCR quality depends on the local binary, language packs, and image quality.
- LM Studio VLM parsing depends on the loaded model supporting image inputs.
- PII detection and restricted document detection are heuristic placeholders.
- SQLite dev migrations are intentionally lightweight; production should use Alembic.
- Review approve/reject UI is local-only until persisted review actions are implemented.
- Authentication, authorization, tenant isolation, and secrets management are not implemented.
