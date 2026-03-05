---
description: Read pending fixture requests and improve mock fixtures
allowed-tools: Read, Glob, Grep, Task, Bash, EnterPlanMode, Edit, Write
---

# QA Fixture Improve: Process Pending Fixture Requests

You are a fixture-improvement agent that reads pending fixture change requests from the QA tracker and guides the user through improving each mock fixture file.

## Step 1: Load Context

1. Read `docs/qa/.tracking/fixture-requests.json` — filter entries where `status === 'pending'`
2. Read `docs/qa/.tracking/selection.json` — get the currently selected page (`selectedFolder`, `selectedFile`)
3. Read `apps/web/src/mock/testFixtures.ts` — fixture registry for name-to-file mapping

## Step 2: Present Summary

Show a table of pending fixture requests:

```
Pending Fixture Requests
────────────────────────
Current page ({folder}/{file}): X pending
All pages: Y pending total

ID       | Fixture            | Test ID        | Requested Change
---------|--------------------|-               |---------------------------
{short}  | datestrip-markers  | DS-001/R1      | Add a 3rd job with...
```

If there are no pending fixture requests, inform the user and stop.

## Step 3: Ask Scope

Ask the user to choose:

- **Option A**: Process requests for the currently selected page only
- **Option B**: Process all pending requests across all pages

## Step 4: Process Each Request (Sequential)

For each pending fixture request in the chosen scope:

### 4a. Present the Request
```
Request #{n}: {fixture} (Test: {testId})
Current Notes: {currentNotes}
Requested Change: {requestedChange}
Created: {createdAt}
```

### 4b. Locate Files
- Parse `testId` to extract folder and file — find the QA doc: `docs/qa/{folder}/{file}.md`
- Find the test scenario section to understand context
- Map fixture name to file: `apps/web/src/mock/fixtures/{fixture-name}.ts`
- Read the fixture file to understand current data structure
- Read `apps/web/src/mock/fixtures/shared.ts` for shared helpers

### 4c. Enter Plan Mode
- **Enter plan mode** with `EnterPlanMode`
- Analyze what changes are needed to the fixture
- Reference the test scenario's expected results
- Plan specific data modifications (jobs, tasks, assignments, etc.)
- Propose changes with specific details

### 4d. Implement Changes
After the user approves the plan, modify the fixture file.

### 4e. Continue
Ask the user if they want to continue to the next request.

## Step 5: Summary

After all requests are processed (or the user stops), show:

```
Fixture Improvement Summary
───────────────────────────
Processed: N fixture requests
Modified files:
  - apps/web/src/mock/fixtures/datestrip-markers.ts
  - apps/web/src/mock/fixtures/sidebar-drag.ts

Note: Requests are NOT auto-closed. Please verify
in the QA panel and close them manually through the UI.
```

## Important Notes

- Process requests **sequentially** — fixture changes may interact with each other
- Use **plan mode for each request** — the user must approve each change
- Do **NOT** auto-close fixture requests — the user verifies and closes manually through the UI
- If requests seem duplicated or related to each other, mention this to the user
- Sort requests by creation date (oldest first)
