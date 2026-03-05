---
description: Read open KO reports and orchestrate analysis + fix for each bug
allowed-tools: Read, Glob, Grep, Task, Bash, EnterPlanMode, Edit, Write
---

# QA Bug Fix: Process Open KO Reports

You are a bug-fixing agent that reads open KO (failure) reports from the QA tracker and guides the user through fixing each one.

## Step 1: Load Context

1. Read `docs/qa/.tracking/ko-logs.json` — filter entries where `resolvedAt` is `null` (open bugs)
2. Read `docs/qa/.tracking/selection.json` — get the currently selected page (`selectedFolder`, `selectedFile`)
3. Read `docs/qa/.tracking/status.json` — get test status context

## Step 2: Present Summary

Show a table of open KO reports:

```
Open KO Reports
───────────────
Current page ({folder}/{file}): X open
All pages: Y open total

ID       | Severity | Test ID        | Description
---------|----------|----------------|---------------------------
{short}  | BLOCKER  | DS-001/R1      | The indicator is not visible...
```

If there are no open KO reports, inform the user and stop.

## Step 3: Ask Scope

Ask the user to choose:

- **Option A**: Fix KOs for the currently selected page only
- **Option B**: Fix all open KOs across all pages

## Step 4: Process Each KO (Sequential)

For each open KO report in the chosen scope:

### 4a. Present the KO
```
KO #{n}: [{severity}] {testId}
Description: {description}
Created: {createdAt}
```

### 4b. Locate the Test Scenario
- Parse the `testId` to extract folder and file (format: `{FOLDER}/{FILE}/{TEST_PREFIX}-{NNN}`)
- Read the corresponding QA document from `docs/qa/{folder}/{file}.md`
- Find the specific test scenario section
- Extract: steps, expected results, fixture references

### 4c. Enter Plan Mode
- **Enter plan mode** with `EnterPlanMode`
- Analyze the bug based on the KO description and test scenario
- Trace the relevant code:
  - For UI bugs: search in `apps/web/src/`
  - For API bugs: search in `services/php-api/`
  - For scheduling bugs: search in both
- Identify root cause with specific file:line references
- Propose a fix in the plan

### 4d. Implement Fix
After the user approves the plan, implement the fix.

### 4e. Continue
After fixing, ask the user if they want to continue to the next KO report.

## Step 5: Summary

After all KO reports are processed (or the user stops), show:

```
Bug Fix Summary
───────────────
Processed: N KO reports
Modified files:
  - path/to/file1.ts
  - path/to/file2.tsx

Note: KO entries are NOT auto-closed. Please verify fixes
in the QA panel and close them manually through the UI.
```

## Important Notes

- Process KOs **sequentially** — bugs often interact with each other
- Use **plan mode for each KO** — the user must approve each fix
- Do **NOT** auto-close KO entries — the user verifies and closes manually through the UI
- If a KO seems like a duplicate or is related to a previous fix, mention this to the user
- Sort KOs by severity: blockers first, then major, then minor
