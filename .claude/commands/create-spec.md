---
description: Generate formal specifications from natural language requirement
---

# Create Specification: $ARGUMENTS

Generate formal specifications from the provided natural language requirement.

## Step 1: Analyze & Propose

### 1.1 Read Documentation Standards

Read the following documents to understand the specification standards:
- `docs/documentation-standards/document-structure.md` - ID naming, formats
- `docs/documentation-standards/change-governance.md` - Category Decision Matrix (Sec. 9-10)
- `docs/domain-model/business-rules.md` - Existing business rules

### 1.2 Analyze the Requirement

Analyze the natural language input: **$ARGUMENTS**

1. Determine change category (based on Change Governance Sec. 9-10):
   - **Category A (Domain/Spec-First):** Changes user capabilities, system behavior, or user communication → continue
   - **Category B (Visual Polish):** Pure visual/aesthetic, no behavior change → suggest DS reference instead, exit
   - **Category C (Technical):** Infrastructure, security, refactoring → suggest commit justification instead, exit

2. If Category A, determine change type and required specs:

| Change Type | Indicators | Required Specs |
|-------------|------------|----------------|
| New backend feature | API, endpoint, service, validation | US + AC + API/IC |
| New frontend feature | UI, component, screen, panel | US + AC + UX |
| Business rule change | constraint, rule, validation, must/cannot | BR + AC |
| User interaction change | click, hover, select, input | AC + UX |
| Data model change | entity, field, relationship | AC + BR |

3. Search existing specs for related items using grep patterns.

### 1.3 Present Proposal

Present the proposal in this format and **STOP - wait for user confirmation**:

```markdown
## Spec Proposal

**Natural language input:**
> {original input}

**Classification:**
- Category: {A/B/C} - {name}
- Change type: {detected change type}
- Path: {Backend/Frontend/Both}

**Proposed specifications:**
- [ ] {spec type} - {reason}
- [ ] {spec type} - {reason}
...

**Related existing specs found:**
- {ID}: {title/summary}
...

---
**Proceed with these specs? (yes / modify selection / cancel)**
```

---

## Step 2: Generate (after approval)

Only proceed after user confirms the proposal.

### 2.1 Assign IDs

For each approved spec type, find the next available ID:
- Search `docs/` for existing IDs in the category
- Assign next sequential number (e.g., if US-GATE-002 exists, use US-GATE-003)

### 2.2 Generate Specifications

Generate each specification following `document-structure.md` standards:

**User Story (US):**
```markdown
### {Title}
#### US-{CATEGORY}-{NNN}
> **References:** [BR-*](path#anchor) (if applicable)

> As a **{role}**, I want **{goal}**, so that **{benefit}**.

**Acceptance Criteria:**
- {criterion 1}
- {criterion 2}
```

**Acceptance Criteria (AC):**
```markdown
### AC-{CATEGORY}-{NNN}: {Title}
> **References:** [US-*](path#anchor), [BR-*](path#anchor)

**Given** {precondition}
**When** {action}
**Then** {expected result}
```

**Business Rule (BR):**
```markdown
### BR-{CATEGORY}-{NNN}: {Title}

{Rule description}

**Constraints:**
- {constraint 1}
- {constraint 2}
```

**API Interface Draft (API):**
```markdown
### API-{CATEGORY}-{NNN}: {Title}
> **References:** [AC-*](path#anchor)

**Method:** {HTTP method}
**Endpoint:** {path}
**Description:** {what it does}
```

**UX Specification (UX):**
```markdown
### {Title}
#### UX-{CATEGORY}-{NNN}
> **References:** [US-*](path#anchor), [AC-*](path#anchor)

**Component:** {component name}
**Location:** {where in the UI}

**Behavior:**
- {behavior 1}
- {behavior 2}

**States:**
- Default state
- Hover state
- Active state
- Disabled state
```

### 2.3 Present Generated Specs

Present the generated specifications and **STOP - wait for save confirmation**:

```markdown
## Generated Specification

{all generated specs formatted as above}

---
**Save these specs to docs/? (yes / modify / cancel)**
```

### 2.4 Save to Files (after confirmation)

Only after user confirms:
1. Append each spec to the appropriate file in `docs/`
2. Report which files were modified
3. Suggest running `/spec-check {IDs}` to validate

---

## Important Rules

- **NEVER** generate specs without user approval at Step 1
- **NEVER** save specs without user approval at Step 2
- **ALWAYS** follow document-structure.md formats exactly
- **ALWAYS** use lowercase anchors in references
- **ALWAYS** check for existing IDs before assigning new ones
- Communication in the user's language (Hungarian for this project)
