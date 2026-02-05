---
description: Review a manual QA test scenario failure and investigate root cause
allowed-tools: Read, Glob, Grep, Task, EnterPlanMode, Edit, Write
---

# QA Scenario Review: $ARGUMENTS

You are investigating a QA test failure. The user has provided a scenario reference and problem description.

## Parse Input

The input format is: `{SCENARIO_ID}: {Title} "{problem description}"`

Example: `DS-001: ViewportIndicator Display "the indicator is not visible when scrolling"`

Extract:
1. **Scenario ID** (e.g., `DS-001`)
2. **Problem description** (text in quotes)

## Workflow

### Step 1: Locate the Scenario

Search for the scenario ID in `docs/qa/**/*.md` files. Extract:
- Feature references
- Fixture URL
- Steps
- Expected Results

### Step 2: Investigate

1. **Enter plan mode** immediately with `EnterPlanMode`
2. **Find relevant code** based on the scenario and problem description:
   - For UI scenarios: search in `apps/web/src/`
   - For API scenarios: search in `services/php-api/`
3. **Trace the issue** using the problem description as guidance
4. **Identify root cause** with specific file:line references
5. **Propose a fix** in the plan

### Step 3: After Plan Approval

Implement the fix when the user approves the plan.

## Example Usage

```
/qa-scenario-review DS-002: Task Markers in DateStrip "markers appear one day after where they should be"
/qa-scenario-review AUTO-015: Imposition Autocomplete "dropdown doesn't close after selection"
/qa-scenario-review NAV-003: Zoom Control "zoom buttons are not responding to clicks"
```
