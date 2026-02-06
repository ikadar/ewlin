# QA Tracker Guide

The QA Tracker is a standalone application (`apps/qa-tracker/`) for structured manual test tracking, bug reporting (KO logs), and fixture improvement requests — all wired into Claude Code skills for automated analysis and fixes.

## Architecture

The QA Tracker runs as an independent app, fully separated from the main Flux Scheduler (`apps/web/`):

| Component | Path | Port | Purpose |
|-----------|------|------|---------|
| QA Tracker UI | `apps/qa-tracker/` | 5174 | React frontend for test tracking |
| QA API | `apps/qa-api/` | 3002 | Express backend serving QA data |
| Scheduler | `apps/web/` | 5173 | Main Flux Scheduler (no QA code) |

The QA Tracker has its own Vite dev server, Redux store (only `qaApi` + `qaSlice`), and `package.json`. It does **not** appear in the scheduler's production bundle.

## Starting the QA Tracker

From the monorepo root (`ewlin/`):

```bash
# Start QA API + QA Tracker together
pnpm dev:qa

# Or start individually
pnpm --filter qa-api dev       # port 3002
pnpm --filter qa-tracker dev   # port 5174
```

The QA Tracker requires the QA API to be running. The Vite dev server proxies `/qa-api` requests to `http://localhost:3002`.

## Environment variables

Configured in `apps/qa-tracker/.env`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_SCHEDULER_URL` | `http://localhost:5173` | Base URL of the Flux Scheduler, used for fixture links and "Back to Scheduler" navigation |

## Panel layout

The tracker provides a 4-column drill-down:

1. **Folders** — QA test folders with per-folder progress bars
2. **Files** — Test files within the selected folder
3. **Tests** — Individual test scenarios with priority badges
4. **Test Viewer** — Full test details plus two sub-panels:
   - **KO Log** — report and track bugs (blocker / major / minor severity)
   - **Fixture Notes** — request fixture data improvements

Keyboard shortcuts: **Alt+P** (previous test), **Alt+N** (next test).

### Fixture links

Test scenarios can reference fixture data (e.g. `?fixture=elements-table`). The QA Tracker resolves these links to the scheduler app using `VITE_SCHEDULER_URL`, so clicking a fixture link opens the scheduler with the correct mock data loaded.

### Selection persistence

The currently selected folder/file/test is persisted to:
- `localStorage` (instant UI restore)
- `docs/qa/.tracking/selection.json` (readable by Claude Code skills)

## Related Claude Code skills

### `/qa-bug-fix`

Reads open KO reports and orchestrates analysis + fix for each bug.

**Workflow:**
1. Loads open KOs from `docs/qa/.tracking/ko-logs.json` (entries where `resolvedAt === null`)
2. Reads current page context from `docs/qa/.tracking/selection.json`
3. Presents open KOs in a table sorted by severity (blockers first)
4. Asks whether to scope to current page or all pages
5. For each KO:
   - Locates the QA scenario document and the relevant source code
   - Enters plan mode to trace root cause
   - Implements fix after user approval
6. Prints a summary of modified files

KOs are processed **sequentially** by severity. The skill does **not** auto-close KOs — the user verifies the fix in the UI and marks them resolved manually.

### `/qa-fixture-improve`

Reads pending fixture change requests and improves mock data files.

**Workflow:**
1. Loads pending requests from `docs/qa/.tracking/fixture-requests.json`
2. Reads current page context from `docs/qa/.tracking/selection.json`
3. Presents pending requests in a table
4. Asks whether to scope to current page or all pending
5. For each request:
   - Locates the relevant test scenario and fixture file in `apps/web/src/mock/fixtures/`
   - Enters plan mode to analyze needed changes
   - Implements fixture improvements after user approval
6. Prints a summary of modified fixture files

Requests are processed **sequentially** because fixtures can interact with each other. The skill does **not** auto-close requests.

## Tracking files

| File | Purpose |
|------|---------|
| `docs/qa/.tracking/selection.json` | Current panel selection (folder/file/test) |
| `docs/qa/.tracking/ko-logs.json` | Bug reports with severity and status |
| `docs/qa/.tracking/fixture-requests.json` | Fixture improvement requests |
| `docs/qa/.tracking/status.json` | Per-test pass/fail/skip status |
