# MCP Design

The MVP MCP integration is a lightweight adapter layer. It does not require the MCP SDK yet; instead, it exposes parser-agent capabilities as Python callables with clean metadata and JSON-like input schemas.

The implementation lives in `backend/app/mcp/server.py`.

## Tool Registry

Each tool has:

- `name`
- `description`
- `input_schema`
- Python handler callable

The demo endpoint `GET /api/v1/mcp/tools` returns tool metadata so other agents can discover available capabilities.

## Tools

### `parse_document`

Maps to the orchestration engine.

Backend equivalent:

- `POST /api/v1/jobs`

Input:

- `file_id`
- optional parser strategy fields such as `quality_target`, `cost_profile`, `latency_profile`, `requested_output_contract`, and `governance_constraints`

### `parse_batch`

Runs `parse_document` for a list of file IDs.

### `get_parse_status`

Reads a `ParseJob`.

Backend equivalent:

- `GET /api/v1/jobs/{job_id}`

### `get_document_assets`

Reads all assets for a file.

Backend equivalent:

- `GET /api/v1/files/{file_id}/assets`

### `get_quality_report`

Reads the latest quality report for a job.

Backend equivalent:

- `GET /api/v1/jobs/{job_id}/quality`

### `compare_parser_outputs`

Executes selected parser adapters against a registered file and returns confidence comparisons.

This uses the existing `ExecutionEngine` and persists a lightweight comparison job.

### `reprocess_with_strategy`

Runs `parse_document` with an explicit strategy object.

### `submit_human_review`

Creates a `ReviewItem` for a parse job and writes an audit event.

## Future MCP SDK Integration

The current `MCPServer` can be wrapped by a real MCP SDK transport later. The tool registry already separates metadata from handler invocation, so a future SDK adapter only needs to translate protocol requests into `mcp_server.call_tool(db, name, arguments)`.

