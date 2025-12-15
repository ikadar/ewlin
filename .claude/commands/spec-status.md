---
description: Overview of specification health across the documentation
---

# Spec Status: $ARGUMENTS

Generate a specification health report for the documentation.

**Input:** $ARGUMENTS (optional scope filter)

## Scope Options

| Scope Type | Example | What it checks |
|------------|---------|----------------|
| (none) | `/spec-status` | Full scan - all specs (slow) |
| Prefix | `/spec-status US` | Only User Stories |
| Prefix | `/spec-status AC` | Only Acceptance Criteria |
| Prefix | `/spec-status BR` | Only Business Rules |
| Category | `/spec-status GATE` | All specs with GATE category |
| Path | `/spec-status backend` | Backend specs (API, IC, AGG, SB) |
| Path | `/spec-status frontend` | Frontend specs (UX, DS) |
| Directory | `/spec-status docs/requirements/` | Only specific directory |

## Step 1: Scan & Validate

### 1.1 Collect Specs

Based on scope, find all spec IDs:

```bash
# All specs
grep -rn "#### [A-Z]*-[A-Z]*-[0-9]*" docs/

# By prefix (e.g., US)
grep -rn "#### US-" docs/

# By category (e.g., GATE)
grep -rn "#### [A-Z]*-GATE-" docs/

# Backend path
grep -rn "#### \(API\|IC\|AGG\|SB\)-" docs/

# Frontend path
grep -rn "#### \(UX\|DS\)-" docs/
```

### 1.2 Validation Rules

For each spec, validate against these rules:

**1.2.1 ID Format Rules** (document-structure.md Sec. 1.2)

| Rule | Pattern | Valid |
|------|---------|-------|
| Format | `PREFIX-CATEGORY-NNN` | US-GATE-001 ✅ |
| Prefixes | US, AC, BR, WF, DM, API, IC, AGG, SB, UX, DS | API-GATE-001 ✅ |
| Heading | Must be h4 | `#### US-GATE-001` ✅ |

**1.2.2 Cardinality Rules** (document-structure.md Sec. 2.3)

| Relationship | Rule | Error if violated |
|--------------|------|-------------------|
| US → AC | 1:n | US must have at least one AC |
| AC → US | n:1 | AC must reference exactly one US |
| AC → BR | n:m | (optional) |
| API → AC | n:m | API should reference AC |
| IC → API | 1:1 | IC should reference API |
| UX → AC/US | n:m | UX should reference AC or US |
| DS → UX | 1:n | DS should be referenced by UX |

**1.2.3 Reference Format Rules** (document-structure.md Sec. 2.1)

| Rule | Check |
|------|-------|
| References line | `> **References:**` after ID heading |
| Link format | `[ID](path#anchor)` |
| Anchor format | Lowercase: `US-GATE-001` → `#us-gate-001` |

**1.2.4 Orphan Detection**

| Type | Orphan if |
|------|-----------|
| US | No AC references this US |
| BR | No AC or technical spec references this BR |
| API | No IC implements this API |
| DS | No UX references this DS |

**1.2.5 Broken Link Detection**

- Check each reference link target exists
- Check anchor format is lowercase

### 1.3 Categorize Issues

- ❌ **Error** - Required rule violated (cardinality, missing required ref)
- ⚠️ **Warning** - Optional rule violated (orphan, missing optional ref)
- ℹ️ **Info** - Format issues (uppercase anchor, missing References line)

## Step 2: Generate Report

```markdown
## Specification Status Report

**Scope:** {scope or "Full scan"}
**Scanned:** {timestamp}

### Summary

| Type | Total | Valid | Errors | Warnings |
|------|-------|-------|--------|----------|
| User Stories (US) | {n} | {n} | {n} | {n} |
| Acceptance Criteria (AC) | {n} | {n} | {n} | {n} |
| Business Rules (BR) | {n} | {n} | {n} | {n} |
| API Specs | {n} | {n} | {n} | {n} |
| Interface Contracts (IC) | {n} | {n} | {n} | {n} |
| UX Specs | {n} | {n} | {n} | {n} |
| Design System (DS) | {n} | {n} | {n} | {n} |
| **Total** | {n} | {n} | {n} | {n} |

### Issues Found

**Cardinality Violations:**
- ❌ {ID}: {issue description}
- ❌ {ID}: {issue description}

**Orphan Specs:**
- ⚠️ {ID}: {issue description}
- ⚠️ {ID}: {issue description}

**Broken Links:**
- ❌ {ID}: Links to {target} which doesn't exist

**Format Issues:**
- ℹ️ {ID}: {issue description}

### Health Score: {percentage}%
({valid checks} / {total checks})

---
**Options:** (show details / fix auto-fixable / export / done)
```

## Step 3: Interactive Options

Based on user selection:

### "show details"
Show detailed information for each issue, one by one:
```markdown
## Issue Details

### {ID} ({Issue Type})
**Problem:** {description}
**Location:** {file}:{line}
**Content:**
> {spec content preview}

**Suggested fix:**
- {actionable suggestion}

---
**Next issue? (next / skip / done)**
```

### "fix auto-fixable"
Auto-fix issues that can be fixed safely:
- Lowercase anchor conversion
- Add missing References line (empty)

Report what was fixed and what requires manual action.

### "export"
Export the report to a file: `docs/reports/spec-status-{date}.md`

---

## Important Rules

- **ALWAYS** report file locations for issues
- **ALWAYS** provide actionable suggested fixes
- **NEVER** auto-fix without user confirmation
- Group issues by type for readability
- Calculate health score as: (total checks - errors) / total checks
- Communication in the user's language (Hungarian for this project)
