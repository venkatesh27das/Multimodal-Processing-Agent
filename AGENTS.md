# AI Agent Instructions

Use this file as the repo-level operating guide for future AI coding agents. It contains both engineering rules and the priority architecture brief for the next major implementation.

## Project Intent

This repo is an enterprise multimodal parsing agent. Preserve the separation between deterministic platform controls and agentic decisioning:

- Deterministic: upload registration, checksum, storage, schema validation, persistence, governance checks, audit logs, and asset publishing.
- Agentic/intelligent: file profiling, parser selection, parsing strategy, fallback planning, skill selection, quality interpretation, review recommendation, and MCP/tool planning.

The next priority is to make the **Multimodal Parser Agent** the single public agent boundary. Design it as an A2A-style API with an Agent Card, task lifecycle, messages, artifacts, streaming/status, and explainable reasoning. Internally it may call parser services, skills, MCP tools, and focused subagents, but external clients should interact with one core parser agent.

## Target Agent Architecture

The product should be centered on one public agent:

```text
External users / apps / other agents
        |
        v
A2A-style Multimodal Parser Agent API
        |
        v
MultimodalParserAgent Orchestrator
Observe -> Plan -> Act -> Evaluate -> Repair -> Publish
        |
        +-- File profiling service
        +-- Parser registry and parser adapters
        +-- Skills runtime
        +-- MCP/tool gateway
        +-- Internal subagent registry
        +-- Governance and policy controls
        +-- Quality, review, audit, lineage, and asset publishing
```

The public abstraction is not "call parser X." The public abstraction is:

```text
Ask the Multimodal Parser Agent to transform one or more multimodal files into trusted, governed, structured assets.
```

## Public Agent Boundary

External clients should see one agent, not a collection of internal implementation services.

Required public capabilities:

- Discover the agent through an Agent Card.
- Create a parser-agent task.
- Attach or reference files.
- Provide target output contracts and governance constraints.
- Track task status.
- Read or stream agent messages.
- Read task artifacts.
- Cancel tasks where supported.
- Inspect reasoning, decisions, quality, fallback, review, and lineage.

Recommended route shape:

```text
GET  /.well-known/agent-card.json
GET  /api/v1/agent/card
POST /api/v1/agent/tasks
GET  /api/v1/agent/tasks
GET  /api/v1/agent/tasks/{task_id}
POST /api/v1/agent/tasks/{task_id}/cancel
GET  /api/v1/agent/tasks/{task_id}/messages
GET  /api/v1/agent/tasks/{task_id}/artifacts
GET  /api/v1/agent/tasks/{task_id}/events
```

Keep existing REST endpoints for UI and backwards compatibility, but new core work should flow toward this agent task model.

## Agent Card Design

The Agent Card should describe the Multimodal Parser Agent clearly enough for another agent or application to use it.

Include:

- `name`: `multimodal-parser-agent`
- `display_name`: `Multimodal Parser Agent`
- `description`: governed multimodal file parsing, extraction, validation, fallback, review, and asset publishing.
- `version`
- `provider`
- `capabilities`: file profiling, parser selection, parsing, OCR, VLM fallback, skill invocation, quality evaluation, review routing, asset publishing.
- `supported_modalities`: PDF, DOCX, HTML, image, audio placeholder, video placeholder.
- `input_modes`: uploaded file, file id, asset id, URL placeholder, text payload.
- `output_modes`: parsed text, tables, entities, relationships, chunks, metadata, transcript, embeddings placeholder, review request, lineage.
- `skills`: registered skill ids from the skills registry.
- `tools`: MCP/tool categories available to the agent.
- `streaming`: whether task event streaming is supported.
- `auth`: current local mode plus future auth scheme placeholders.
- `endpoints`: task create/get/list/cancel/messages/artifacts/events.

## Agent Task Lifecycle

Use one lifecycle for all parser-agent work.

Recommended statuses:

```text
submitted
accepted
observing
planning
executing
evaluating
repairing
awaiting_review
publishing
completed
cancelled
failed
```

The orchestrator loop should be explicit:

1. **Observe**: inspect file, profile modality, classify document type, detect layout/table/image/audio/video signals, identify risk.
2. **Plan**: choose parser strategy, skills, fallback, quality target, review threshold, tool/subagent use, and output contract.
3. **Act**: execute parser adapters, skills, MCP tools, and subagents as planned.
4. **Evaluate**: score confidence, completeness, schema validity, consistency, parser agreement, and policy compliance.
5. **Repair**: retry, fallback, normalize tables, invoke VLM/OCR, run additional skills, or route to review.
6. **Publish**: create governed assets with evidence, quality, lineage, parser/skill/tool traces, and audit events.

## Data Model Blueprint

Persist agent behavior rather than hiding it inside logs.

Add SQLAlchemy models and Pydantic schemas for:

- `AgentTask`: one public A2A-style task.
- `AgentMessage`: user, agent, tool, subagent, or system message attached to a task.
- `AgentArtifact`: typed output artifact attached to a task.
- `AgentPlan`: selected strategy for a task.
- `AgentStep`: ordered observe/plan/act/evaluate/repair/publish step.
- `AgentDecision`: explainable decision with alternatives and score breakdown.
- `AgentToolCall`: MCP/tool call request, response summary, timing, and errors.
- `AgentSkillInvocation`: skill id, input summary, output summary, validation result.
- `AgentSubtask`: internal subagent delegation record.
- `AgentQualityJudgement`: quality dimensions, thresholds, final judgement, review rationale.
- `AgentLineage`: source file, parsers, skills, tools, fallbacks, artifacts, and audit ids.

Minimum fields to include across these models:

- stable id
- `task_id`
- type/kind
- status
- title/summary
- structured JSON payload
- created/updated timestamps
- sequence/order for timeline display
- error fields where applicable

## Artifact Types

Agent artifacts should be first-class, typed records.

Required artifact kinds:

- `file_profile`
- `parsing_plan`
- `agent_reasoning`
- `parser_output`
- `skill_output`
- `quality_report`
- `fallback_report`
- `review_request`
- `parsed_asset`
- `lineage_report`
- `audit_summary`

Artifacts should support both human-readable summaries and machine-readable JSON payloads.

## Internal Subagents

Do not expose these as separate public products at first. Treat them as internal capabilities behind the main Multimodal Parser Agent.

Recommended internal subagents:

- `FileProfilerAgent`: file type, modality, layout, risk, and document class.
- `ParserStrategyAgent`: parser selection, fallback selection, skill selection, cost/latency/quality tradeoffs.
- `ExtractionAgent`: execution of parser adapters and extraction skills.
- `QualityAgent`: confidence, completeness, schema validity, consistency, and review threshold judgement.
- `RepairAgent`: fallback, retry, OCR/VLM escalation, table normalization, missing-field recovery.
- `ReviewAgent`: review item creation, review rationale, suggested human checks.
- `PublisherAgent`: governed asset creation, metadata, evidence, lineage, audit.

Each subagent should return structured observations, decisions, and artifacts to the core task trace.

## MCP And Tool Gateway

Use MCP/tools for external or specialized capabilities. Do not blur MCP and A2A:

- A2A-style API: public agent-to-agent task coordination.
- MCP/tools: internal tool/data/service access used by the parser agent.
- Skills: reusable domain extraction/validation capabilities selected by the parser agent.

The MCP/tool gateway should normalize:

- tool id
- input schema
- output schema
- timeout
- retry policy
- cost estimate
- data residency/security classification
- whether external service usage is allowed by task policy

Potential tool categories:

- OCR
- VLM parsing
- document intelligence
- speech transcription
- video understanding
- embeddings/vector search
- policy/PII checks
- schema validation
- table normalization
- knowledge graph extraction

## Skills Support

Skills must be planner-selectable capabilities, not only UI cards.

Each skill should declare:

- skill id and version
- description
- supported file types and document types
- required inputs
- produced outputs
- JSON schema
- validation rules
- confidence behavior
- cost/latency expectations
- compatible parsers
- examples

The agent planner should be able to choose skills based on file profile, user goal, output contract, and governance constraints.

## Agent Reasoning Requirements

The system must explain important decisions without leaking sensitive internals.

Capture:

- observed file signals
- selected parser and why
- rejected parser alternatives and why
- selected skill and why
- fallback policy
- whether external tools/MCPs were allowed
- quality thresholds
- confidence signals
- review rationale
- final publish decision

The UI should show this as an Agent Plan, Agent Timeline, and Agent Reasoning panel.

## UI Expectations For The Agentic Version

Add agent-centered surfaces instead of only dashboard metrics:

- Parse screen: agent task creation, observed profile, plan preview, selected parser/skills, policy controls.
- Running screen: streaming agent timeline and step status.
- Job Detail: final agent reasoning, artifacts, parser/skill/tool trace, quality judgement, lineage.
- Review Queue: review rationale generated by the agent, uncertain fields, evidence spans.
- Assets: published artifact plus lineage and confidence context.
- Home: start a real parser-agent task from upload/drag/drop.

## Migration Plan

Implement incrementally:

1. Add schemas and models for agent tasks, messages, artifacts, steps, decisions, tool calls, skill invocations, and quality judgements.
2. Add Agent Card and task endpoints.
3. Add `MultimodalParserAgent` service that delegates to existing profiling, planner, parser selector, orchestration, fallback, quality, review, and publishing services.
4. Wrap the existing synchronous job flow as one agent task execution path.
5. Persist every major decision and artifact.
6. Update Parse and Job Detail to read agent task traces.
7. Add event streaming once the persisted lifecycle is stable.
8. Add internal subagent and MCP gateway abstractions.
9. Move existing REST screens gradually to read agent-backed data.
10. Add async worker support after the agent task model is stable.

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

- Implement the A2A-style `MultimodalParserAgent` as the top-priority architecture work.
- Persist agent tasks, messages, artifacts, plans, steps, decisions, tool calls, skill invocations, quality judgements, and lineage.
- Make existing parser selection, execution, fallback, quality, review, and asset publishing run as explicit agent steps.
- Add Agent Plan, Agent Reasoning, and Agent Timeline UI surfaces.
- Make Home drag/drop create a real parser-agent task.
- Make global search functional across jobs, files, parsers, assets, skills, and agent tasks.
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
