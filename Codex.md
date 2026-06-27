# Multimodal Parsing Agent — Codex Instructions

## Product Goal

Build an enterprise-grade Multimodal Parsing Agent platform.

The platform should intelligently process different file modalities including:

- PDF
- DOCX
- images
- HTML
- audio
- video

The system should not be a single parser. It should be an orchestration platform that profiles each file, selects the best parser or parser combination, executes parsing, evaluates quality, applies fallback logic, invokes reusable skills, optionally calls MCP tools, and publishes governed parsing assets.

## Core Principle

Separate deterministic enterprise controls from agentic decisioning.

Deterministic:
- file registration
- checksum
- storage
- schema validation
- audit logging
- access policy checks
- output publishing

Agentic/intelligent:
- modality understanding
- parser selection
- parsing strategy
- fallback planning
- skill selection
- quality interpretation
- human review recommendation
- MCP tool usage planning

## Recommended Stack

Backend:
- Python
- FastAPI
- Pydantic
- SQLAlchemy
- PostgreSQL
- Local file storage for MVP

Frontend:
- Next.js
- TypeScript
- Tailwind CSS
- Clean enterprise SaaS UI

Parsing:
- PyMuPDF for native PDF text
- python-docx for DOCX
- BeautifulSoup/readability for HTML
- placeholder adapter for image OCR
- placeholder adapter for Azure Document Intelligence
- placeholder adapter for Tesseract
- placeholder adapter for audio transcription
- placeholder adapter for video parsing

MCP:
- Implement a basic MCP server wrapper exposing parsing capabilities as tools.
- MCP integration can initially be lightweight and mocked, but the code should be structured so real MCP tools can be added later.

Skills:
- Implement skills as folders with:
  - SKILL.md
  - schema.json
  - validation_rules.yaml
  - examples

## Main Platform Capabilities

### 1. File Intake

The system should support uploading a file through API and UI.

For each file, create a file registry record with:

- file_id
- original filename
- file type
- MIME type
- size
- checksum
- source
- storage path
- upload timestamp
- created by
- processing status

### 2. File Profiling

Create a file profile containing:

- file type
- modality profile
- whether text layer exists
- whether file is scanned
- number of pages if applicable
- table likelihood
- image likelihood
- language if detectable
- layout complexity
- estimated processing cost class
- recommended parsing strategy

### 3. Parser Registry

Build a parser registry where each parser declares:

- parser_id
- name
- supported file types
- supported modalities
- strengths
- weaknesses
- cost level
- latency level
- quality level
- deployment mode
- enabled/disabled status
- version

### 4. Parser Selection

Implement parser selection using a scoring function:

parser_score =
expected_quality_score
- cost_penalty
- latency_penalty
- risk_penalty
+ historical_success_bonus

The selector should choose:
- primary parser
- optional secondary parser
- fallback parser
- reason for the decision

Every decision must be explainable.

### 5. Parsing Plan

Before executing parsing, create a parsing plan.

A plan should include:

- file_id
- selected parser
- fallback parser
- selected skill if any
- output contract
- expected assets
- quality threshold
- cost profile
- human review policy

### 6. Execution Engine

The execution engine should:

- execute selected parser
- collect parser output
- apply skill-specific extraction if selected
- validate output
- calculate quality score
- trigger fallback if required
- publish assets
- write audit logs

### 7. Parser Adapters

Implement the following parser adapters:

- PDF native text parser
- DOCX parser
- HTML parser
- image OCR parser placeholder
- Azure Document Intelligence placeholder
- Tesseract placeholder
- audio parser placeholder
- video parser placeholder
- mock VLM parser placeholder

All parser adapters should inherit from a common BaseParser.

### 8. Skills Framework

Implement a skills registry.

Each skill should include:

- skill_id
- name
- description
- supported document types
- extraction schema
- validation rules
- examples
- post-processing hook if available

Initial skills:
- invoice extraction
- contract parsing
- research paper parsing
- audio meeting parsing
- table normalization
- knowledge graph preparation

### 9. Quality Evaluation

Implement quality evaluation with:

- parser confidence
- extraction confidence
- schema validation score
- completeness score
- consistency score
- human review required flag
- quality explanation

Quality should determine whether fallback or review is triggered.

### 10. Output Asset Contract

The platform should produce a unified parsed asset contract:

- document registry metadata
- parsed text
- layout blocks
- tables
- image descriptions
- audio transcript
- video transcript
- chunks
- embeddings placeholder
- entities
- relationships
- evidence spans
- quality scores
- lineage
- parser used
- skill used
- cost and latency
- audit trail

### 11. Human Review

Implement review queue records when:

- quality score is below threshold
- critical fields are missing
- parser outputs disagree
- document type is unknown
- fallback also fails

UI should show:
- document metadata
- parser used
- extracted output
- quality reason
- approve/reject buttons

### 12. Observability

Capture:

- job status
- parser used
- skill used
- cost estimate
- latency
- quality score
- fallback triggered
- human review triggered
- error details
- audit log

### 13. API Design

Implement APIs for:

- upload file
- get file profile
- create parse job
- get parse job status
- get parsing plan
- get parsed assets
- list parser registry
- register/update parser
- list skills
- get quality report
- list review queue
- approve/reject review item
- MCP tool endpoints

### 14. UI Design

Create a professional enterprise SaaS UI.

Theme:
- white background
- light grey panels
- dark text
- subtle borders
- rounded cards
- orange primary accent
- clean spacing
- no oversized components
- should look good on a 14-inch laptop

Pages:

1. Home / Upload
2. Jobs
3. Job Detail
4. Parser Registry
5. Skills Registry
6. Human Review Queue
7. Asset Viewer
8. Observability Dashboard

### 15. Development Rules

- Use strong typing everywhere.
- Keep business logic out of route files.
- Write tests for core modules.
- Add docstrings for important classes.
- Use clean separation of concerns.
- Do not hardcode parser decisions in API routes.
- Keep parser adapters pluggable.
- Use Pydantic models for request/response contracts.
- Add meaningful seed data for demo.
- Add README instructions to run locally.

## MVP Definition

The MVP is complete when:

1. A user can upload a PDF, DOCX, HTML, image, audio, or video placeholder file.
2. The system creates a file profile.
3. The parser selector chooses a parser and explains why.
4. A parsing job runs.
5. A parsed asset is generated.
6. Quality is scored.
7. Low-quality output is sent to review.
8. Assets are visible in UI.
9. Parser registry and skills registry are visible in UI.
10. API documentation is available through FastAPI Swagger.