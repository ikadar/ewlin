---
tags:
  - draft
  - workflow
  - commands
---

# Spec-First Commands Proposal

This document outlines proposed slash commands for the spec-first AI-assisted development workflow.

---

## Overview

The commands are organized according to the 5 phases of the AI-assisted development workflow:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  1. REQUEST │ ──▶ │  2. SPEC    │ ──▶ │  3. GENERATE│ ──▶ │  4. VERIFY  │ ──▶ │  5. COMMIT  │
│   (Human)   │     │    (AI)     │     │    (AI)     │     │   (Both)    │     │   (Both)    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

**Key Principle:** Developers communicate in **natural language**. AI converts requirements to formal specifications for approval.

---

## 1. Request Phase (Natural Language Input)

No command needed - the developer simply describes the requirement in natural language.

**Examples:**
```
"Szeretnék egy funkciót, ami blokkolja a nyomtatási feladatokat amíg
a BAT jóváhagyás meg nem történik."

"A felhasználó tudjon szűrni a feladatok listájában státusz alapján."
```

---

## 2. Specification Phase Commands

### /create-spec

**Purpose:** Generate formal specifications from natural language requirement

**Usage:** `/create-spec "Szeretnék egy funkciót ami blokkolja a nyomtatást BAT jóváhagyás nélkül"`

**What it does:**
1. Analyzes the natural language requirement
2. Searches existing specs for related items
3. Generates formal specifications:
   - User Story (US) in "As a... I want... so that..." format
   - Acceptance Criteria (AC) in Given/When/Then format
   - References to existing Business Rules (BR) or proposes new ones
   - Technical spec outline (API/IC for backend, UX/DS for frontend)
4. Presents the generated spec for developer approval
5. STOP - Waits for approval before proceeding

**Output:**
```markdown
## Generated Specification

### User Story
#### US-GATE-001
> As a **production manager**, I want **printing tasks to be blocked until BAT approval**,
> so that **we don't waste resources on unapproved jobs**.

### Acceptance Criteria
#### AC-GATE-001
> **References:** [US-GATE-001](#us-gate-001), [BR-GATE-001](../domain-model/business-rules.md#br-gate-001)

> **Given** a job with BAT status "pending"
> **When** a printing task is scheduled for that job
> **Then** validation fails with error "BAT approval required"

### Business Rules
- BR-GATE-001: BAT approval is required before printing tasks can start
- BR-GATE-002: BAT approval can be bypassed with explicit manager override

### Technical Path: Backend
- API-GATE-001: POST /jobs/{id}/validate-bat
- IC-GATE-001: BatApprovalValidator interface

---
**Approve this specification? (yes/modify/reject)**
```

---

### /spec-check

**Purpose:** Verify the traceability chain for a specific AC

**Usage:** `/spec-check AC-GATE-001`

**What it does:**
- Finds the AC in documentation
- Verifies US reference exists
- Verifies BR references exist
- Verifies technical spec exists (API/IC for backend, UX/DS for frontend)
- Reports missing or broken links

**Output:**
```
AC-GATE-001 Traceability Report
├── US: US-GATE-001 ✅
├── BR: BR-GATE-001 ✅, BR-GATE-002 ✅
├── API: API-GATE-001 ✅
└── Status: Complete ✅
```

---

### /spec-status

**Purpose:** Overview of specification health

**Usage:** `/spec-status`

**What it does:**
- Scans all specification documents
- Identifies orphan specs (no references)
- Identifies missing references
- Reports coverage statistics

**Output:**
```
Specification Status Report
├── User Stories: 15 total
├── Acceptance Criteria: 42 total (3 missing US reference)
├── Business Rules: 28 total (2 orphan)
├── API Specs: 18 total
├── UX Specs: 12 total
└── Overall Health: 89%
```

---

## 3. Generation Phase Commands

### /generate-from-spec

**Purpose:** Generate code from AC with proper annotations

**Usage:** `/generate-from-spec AC-GATE-001`

**What it does:**
1. Reads the AC and all referenced specs (US, BR, API/IC or UX/DS)
2. Generates implementation code with @spec annotation
3. Generates unit test based on Given/When/Then
4. Presents code for review

**Output:**
- Source file with @spec annotation
- Test file with test case for AC
- Summary of what was generated

---

### /generate-test

**Purpose:** Generate test from AC Given/When/Then

**Usage:** `/generate-test AC-GATE-001`

**What it does:**
1. Reads the AC
2. Extracts Given/When/Then scenarios
3. Generates PHPUnit or Jest test
4. Names test after AC ID

**Output:**
```php
/**
 * @spec AC-GATE-001
 */
public function test_AC_GATE_001_bat_approval_required(): void
{
    // Given: a job with BAT status "pending"
    // When: a printing task is scheduled
    // Then: validation fails with "BAT approval required"
}
```

---

## 4. Verification Phase Commands

### /verify-traceability

**Purpose:** Verify @spec annotations in codebase

**Usage:** `/verify-traceability`

**What it does:**
1. Scans codebase for @spec annotations
2. Validates each spec ID exists in documentation
3. Reports invalid or missing annotations
4. Calculates coverage metrics

**Output:**
```
Traceability Verification Report
├── Files with @spec: 45
├── Total @spec annotations: 128
├── Valid IDs: 125 ✅
├── Invalid IDs: 3 ❌
│   ├── src/Service/TaskService.php:42 - AC-TASK-999 (not found)
│   ├── src/Entity/Job.php:18 - BR-JOB-005 (not found)
│   └── src/Controller/StationController.php:55 - API-STAT-010 (not found)
└── Coverage: 92%
```

---

### /verify-ac

**Purpose:** Verify code implements AC correctly

**Usage:** `/verify-ac AC-GATE-001`

**What it does:**
1. Reads the AC Given/When/Then
2. Finds code with @spec AC-GATE-001
3. Analyzes if code covers all scenarios
4. Reports compliance

**Output:**
```
AC-GATE-001 Compliance Report
├── Given: "job with BAT status pending"
│   └── Handled in: BatApprovalValidator.php:25 ✅
├── When: "printing task is scheduled"
│   └── Handled in: BatApprovalValidator.php:32 ✅
├── Then: "validation fails with BAT approval required"
│   └── Handled in: BatApprovalValidator.php:38 ✅
└── Status: Compliant ✅
```

---

## 5. Commit Phase Commands

### /commit-with-spec

**Purpose:** Create commit with proper spec references

**Usage:** `/commit-with-spec`

**What it does:**
1. Analyzes staged changes
2. Extracts @spec annotations from changed files
3. Generates commit message with spec references
4. Creates the commit

**Output:**
```
feat(gate): Add BAT approval validation

Implements BAT approval check before printing tasks can start.

Spec: AC-GATE-001, BR-GATE-001, API-GATE-001

- Add BatApprovalValidator with @spec annotation
- Add PHPUnit test for Given/When/Then scenarios

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

## 6. Full Workflow Commands

### /implement-release (existing)

Full backend release workflow with all phases.

### /implement-ui-release (existing)

Full frontend release workflow with all phases.

### /spec-first-workflow

**Purpose:** Step-by-step spec-first implementation for a single feature

**Usage:** `/spec-first-workflow AC-GATE-001`

**What it does:**
1. Runs /spec-check to verify traceability
2. STOP - Wait for approval
3. Runs /generate-from-spec to create code
4. STOP - Wait for approval
5. Runs /verify-ac to check compliance
6. STOP - Wait for approval
7. Runs /commit-with-spec to commit

---

## Implementation Priority

| Priority | Command | Phase | Complexity | Value |
|----------|---------|-------|------------|-------|
| 1 | /create-spec | SPEC | High | Critical |
| 2 | /spec-check | SPEC | Medium | High |
| 3 | /generate-from-spec | GENERATE | High | High |
| 4 | /verify-traceability | VERIFY | Medium | High |
| 5 | /spec-status | SPEC | Medium | Medium |
| 6 | /commit-with-spec | COMMIT | Low | Medium |
| 7 | /verify-ac | VERIFY | High | Medium |
| 8 | /generate-test | GENERATE | Medium | Medium |
| 9 | /spec-first-workflow | Full | Medium | High |

**Note:** `/create-spec` is the most critical command as it enables the natural language → formal specification conversion that is fundamental to the workflow.

---

## Notes

- All commands should follow the strict workflow defined in `docs/documentation-standards/ai-assisted-development-workflow.md`
- Commands with STOP points require explicit user approval before continuing
- Commands should use TodoWrite to track progress
- Output should be in the user's language (Hungarian for this project)
