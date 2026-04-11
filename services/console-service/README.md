# console-service

Natural-language ALT+I console + MCP server for the Flux scheduler.

## What it does

Two surfaces, one shared catalog of "scheduling tools":

1. **HTTP console** at `http://localhost:3004/console/execute` — the React frontend posts a French-language prompt + conversation history, the service runs a multi-turn LLM loop with function calling against Ollama, and returns a structured "proposed plan" that the user confirms before applying.
2. **MCP server** at `http://localhost:3004/mcp` (HTTP) and via `node dist/main.js mcp-stdio` (stdio) — exposes the same scheduling tools to any external MCP-compatible client (Claude Code, Claude Desktop, custom). Calls are direct WET-mode mutations (no propose-then-confirm).

## Tools catalog

- `resolve_operator(name)` — find an operator by first/last name
- `resolve_station(name)` — find a station by name or abbreviation
- `resolve_job(reference)` — find a job by its reference number
- `resolve_task_in_job(jobId, stationName?)` — list a job's tasks, optionally filtered by station
- `add_operator_absence(operatorId, fromDate, toDate, reason?)`
- `add_station_maintenance(stationId, fromDate, fromTime, toDate, toTime, reason?)`
- `cancel_constraint(constraintId)`
- `list_active_constraints(fromDate?)`
- `update_job_deadline(jobId, newDeadline | shiftDays)`
- `add_operator_overtime(operatorId, date, fromTime, toTime, reason?)`
- `update_task_duration(taskId, setupMinutes?, runMinutes?)`
- `replace_task_station(taskId, newStationId, newSetupMinutes?, newRunMinutes?)`
- `pin_task_at_time(taskId, stationId, date, time)`
- `unpin_task(taskId)`

Two **internal** tools (LLM only, never exposed via MCP):
- `propose_plan(narration, actions[])` — terminal step, returns the plan to the frontend
- `ask_user(question, options[])` — terminal step, asks for clarification

## Run modes

```bash
# HTTP server (default — port 3004)
node dist/main.js          # equivalent to: node dist/main.js http
node dist/main.js http

# MCP stdio (for Claude Code / Desktop)
MCP_JWT="$(cat ~/.flux/jwt)" node dist/main.js mcp-stdio
```

## Configuration

All config via environment variables. See `src/config.ts` for the full list.

| Variable | Default | Purpose |
|---|---|---|
| `HTTP_PORT` | `3004` | Port for the Fastify HTTP server |
| `PHP_API_URL` | `http://localhost:8080` | Base URL of the PHP/Symfony API |
| **`ANTHROPIC_API_KEY`** | (required) | Your Anthropic API key — get one at https://console.anthropic.com/settings/keys |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` | Override the API endpoint (only useful for proxies / self-host) |
| `LLM_MODEL` | `claude-haiku-4-5-20251001` | Claude model id. Haiku is fast + cheap; switch to `claude-sonnet-4-5` for harder prompts. |
| `LLM_TEMPERATURE` | `0` | Sampling temperature. Keep at 0 for deterministic plans. |
| `LLM_MAX_TURNS` | `8` | Max LLM turns per execute call. |
| `LLM_TOTAL_TIMEOUT_MS` | `60000` | Total wall-clock timeout per execute call. |
| `MCP_JWT` | (none) | For stdio mode: the JWT to forward to the PHP API. |
| `MCP_JWT_FILE` | (none) | Alternative: path to a file containing the JWT. |

## Local development

The console-service drives the LLM via the Anthropic Messages API (Claude Haiku 4.5 by default). You only need an API key — no local model download.

Add the key to the repo's root `.env`:

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env
```

Run the service in watch mode (re-compiles on save):

```bash
cd services/console-service
npm install
npm run dev               # starts http on port 3004
```

Health check:

```bash
curl -s http://localhost:3004/health | jq .
```

## Tests

```bash
npm test                                 # all tests
npm test -- tools                        # tool unit tests only (no LLM)
ANTHROPIC_API_KEY=sk-ant-... npm test -- llm-integration  # live Anthropic, auto-skipped if no key
```

The LLM integration suite is **live** — it sends real Messages API calls
to verify the configured model is pulled, and skips itself if not. This
matches the project rule "no mocks for live infra." Tool unit tests fake
the PHP client so they're fast and offline.

## Connecting Claude Code to the MCP server

Stdio transport (recommended for local Claude Code):

```bash
# Build first
cd services/console-service && npm run build

# Register with Claude Code
claude mcp add scheduler -- node $(pwd)/dist/main.js mcp-stdio \
  --env MCP_JWT_FILE=/Users/$(whoami)/.flux/jwt \
  --env PHP_API_URL=http://localhost:8080
```

HTTP transport (alternative for tools that prefer HTTP):

```
URL: http://localhost:3004/mcp
Auth: Bearer <your jwt>
```

Then in a Claude Code session you can ask things like:
- "Liste les contraintes de planning actives"
- "Quels opérateurs sont disponibles le 15 avril ?"

Claude will translate those into MCP `tools/call` invocations.

## Production via docker-compose

The service is wired into the root `docker-compose.yml` as `console-service`. From inside Docker it reaches the PHP API as `http://nginx` and Ollama as `http://host.docker.internal:11434` (using the `extra_hosts` mapping). Override these via environment variables in your `.env`.

```bash
docker compose up -d console-service
docker compose logs -f console-service
```

## Architecture

```
ALT+I → frontend → POST /console/execute → LLM loop ↔ Ollama
                                              ↓
                                      tool dispatch (dry-run)
                                              ↓
                                       PHP API (read only)
                                              ↓
                              return proposed plan to frontend
                                              ↓
                              user confirms → POST /console/apply
                                              ↓
                                       PHP API (mutations)
                                              ↓
                                       audit log → DB
```

The MCP server uses the same tool registry but bypasses the LLM loop and the propose-then-confirm flow (external MCP clients are assumed to know what they want).
