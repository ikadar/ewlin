# QA Panel Guide

The QA Panel is a sidebar tool integrated into the Flux Scheduler UI. It provides structured manual test tracking, bug reporting (KO logs), and fixture improvement requests — all wired into Claude Code skills for automated analysis and fixes.

## Enabling the QA Panel

The panel is controlled by a Vite environment variable:

```env
# apps/web/.env.local
VITE_QA_SIDEBAR=true
```

When enabled, the `<QASidebarPanel />` component renders on the left edge of the scheduler layout. It auto-collapses on narrow viewports (<1200px) and can be toggled manually.

The check happens in `App.tsx`:

```ts
const showQASidebar = import.meta.env.VITE_QA_SIDEBAR === 'true';
```

### Backend requirement

The panel communicates with a dedicated QA API server on `http://localhost:3002` (proxied through Vite at `/qa-api`). The API serves QA test documents from `docs/qa/`, manages test status, KO logs, fixture requests, and selection persistence.

## Panel layout

The sidebar opens into a 4-column drill-down:

1. **Folders** — QA test folders with per-folder progress bars
2. **Files** — Test files within the selected folder
3. **Tests** — Individual test scenarios with priority badges
4. **Test Viewer** — Full test details plus two sub-panels:
   - **KO Log** — report and track bugs (blocker / major / minor severity)
   - **Fixture Notes** — request fixture data improvements

Keyboard shortcuts: **Alt+P** (previous test), **Alt+N** (next test).

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
