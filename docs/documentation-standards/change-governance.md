---
tags:
  - meta
  - standards
---

# Change Governance

This document defines the rules for managing changes to specifications and code.

---

## 1. Top-Down Change Principle

**All changes must originate at the domain level.** Technical specifications can only change as a consequence of domain-level changes.

```
Domain Level (change originates here)
├── User Stories (US)      ← "We need new capability"
├── Acceptance Criteria (AC) ← "This is how we verify it"
└── Business Rules (BR)    ← "These constraints apply"
        ↓
        ↓  Changes flow DOWN
        ↓
Technical Level (changes as consequence)
├── API Interface Drafts (API)
├── Interface Contracts (IC)
├── Aggregate Design (AGG)
└── Service Boundaries (SB)
        ↓
        ↓  Changes flow DOWN
        ↓
Implementation Level
└── Source Code
```

---

## 2. Prohibited Direct Changes

**NEVER** directly modify these without a domain-level trigger:

### Backend Documents

| Document | Requires |
|----------|----------|
| API Interface Drafts (API) | AC or US change first |
| Interface Contracts (IC) | AC or BR change first |
| Aggregate Design (AGG) | BR or DM change first |
| Service Boundaries (SB) | AGG or IC change first |
| Backend Code | AC or BR change first |

### Frontend Documents

| Document | Requires |
|----------|----------|
| UX/UI Specifications (UX) | AC or US change first |
| Design System (DS) | UX or BR change first |
| Frontend Components | UX or DS change first |

---

## 3. Valid Change Triggers

### Backend

| Change Type | Valid Trigger | Invalid Trigger |
|-------------|---------------|-----------------|
| New API endpoint | New US + AC | "We need this endpoint" |
| Modified IC | Changed BR or AC | "Better interface design" |
| New aggregate field | Changed DM or BR | "Database needs this" |
| Refactored service | Changed SB justified by BR | "Cleaner architecture" |

### Frontend

| Change Type | Valid Trigger | Invalid Trigger |
|-------------|---------------|-----------------|
| New UI component | New US + AC + UX | "Users might like this" |
| Modified UX spec | Changed AC or US | "Better user experience" |
| New DS token | UX requirement or BR | "I prefer this color" |
| Component refactor | UX change or tech-debt | "Cleaner code" |

---

## 4. Change Traceability Format

Every technical spec change must reference its domain trigger:

```markdown
### IC-ASSIGN-005: New Batch Assignment Contract
> **References:** [AC-SCHED-015](../requirements/acceptance-criteria.md#ac-sched-015)
> **Change trigger:** AC-SCHED-015 (Batch assignment of multiple tasks)

{contract definition}
```

---

## 5. Change Request Workflow

```
1. Identify need for change
   └── Express as domain requirement (US, AC, or BR)

2. Create/modify domain spec
   ├── New US if new user capability
   ├── New/modified AC if new behavior
   └── New/modified BR if new constraint

3. Derive technical changes

   Backend path:
   ├── Update API if external interface changes
   ├── Update IC if service contract changes
   ├── Update AGG if entity structure changes
   └── Update SB if service responsibility changes

   Frontend path:
   ├── Update UX if user interface changes
   └── Update DS if visual constraints change

4. Generate/update code
   ├── Backend: with @spec annotations pointing to AC/BR
   └── Frontend: with @spec annotations pointing to UX/DS

5. Commit with traceability
   └── Reference domain trigger in commit message
```

---

## 6. Exception: Technical Debt

Pure technical improvements (refactoring, performance) that don't change behavior:

1. **Still require justification** - document why in commit message
2. **No spec changes needed** if behavior unchanged
3. **Tag as technical debt** - `[tech-debt]` in commit message

```
git commit -m "[tech-debt] Optimize query performance

No spec change - behavior unchanged.
Justification: Query time reduced from 500ms to 50ms."
```

---

## 7. Review Checklist

Before approving any technical spec change:

- [ ] Is there a domain-level trigger (US, AC, BR)?
- [ ] Is the trigger referenced in the technical spec?
- [ ] Does the change actually address the domain requirement?
- [ ] Are downstream specs updated consistently?

---

## 8. Change Categories

Not all changes require domain-level triggers. Changes are categorized by their nature:

### Category A: Domain Changes (Spec-First)

**Requires:** US, AC, or BR trigger (mandatory)

Applies to both backend and frontend development that follows the spec-first workflow.

| Scope | Backend Examples | Frontend Examples |
|-------|------------------|-------------------|
| New feature | New API endpoint, service | New UI component, screen |
| Behavior change | Workflow change, validation | User interaction, form behavior |
| Data/State | New entity, relationships | New state management, data display |
| User communication | Error messages, notifications | Error states, feedback messages |

**Commit format (backend):**
```
feat(gate): Add BAT approval validation

Spec: AC-GATE-001, BR-GATE-001
```

**Commit format (frontend):**
```
feat(ui): Add job list panel

Spec: AC-UI-001, UX-PANEL-001
```

### Category B: Visual Polish (Non-Behavioral)

**Requires:** Design system reference (DS-\*) OR product owner approval

Only for changes that do NOT affect behavior - pure visual/aesthetic adjustments.

| Scope | Examples |
|-------|----------|
| Styling tweaks | Spacing adjustments, shadow refinements |
| Animations | Transition timing, hover effects |
| Branding | Logo updates, color scheme refresh |
| Polish | Alignment fixes, responsive tweaks |

**Important:** If a visual change affects user communication or behavior (e.g., error states, success feedback), it is Category A, not Category B.

**Commit format:**
```
[ui] Adjust button shadow depth

Design system: DS-SHADOW-001
```

```
[ui] Update brand colors

PO: {Name} - approval {date}
```

### Category C: Technical/Infrastructure Changes

**Requires:** Justification in commit message

| Scope | Examples |
|-------|----------|
| Security | Library updates for CVE, auth hardening |
| Performance | Query optimization, caching (if no AC-PERF) |
| Infrastructure | CI/CD, logging, monitoring, deployment |
| Refactoring | Code cleanup without behavior change |
| Dependencies | Version updates, library migrations |

**Commit format:**
```
[security] Update symfony/http-kernel for CVE-2024-xxxx

[tech-debt] Refactor AssignmentService for readability

[infra] Add structured logging to API endpoints
```

---

## 9. Category Decision Matrix

### Backend Changes

| Change Type | Category | Trigger Required |
|-------------|----------|------------------|
| New API endpoint | A - Domain | US + AC |
| Business rule change | A - Domain | BR + AC |
| Data model change | A - Domain | AC + BR |
| Error message wording | A - Domain | AC (user communication) |
| Query optimization | C - Tech | Justification |
| Add logging | C - Tech | Justification |
| Security patch | C - Tech | CVE reference |

### Frontend Changes

| Change Type | Category | Trigger Required |
|-------------|----------|------------------|
| New UI component | A - Domain | US + AC + UX |
| User interaction change | A - Domain | AC + UX |
| Error/feedback states | A - Domain | AC (user communication) |
| Accessibility (WCAG) | A - Domain | US-ACCESS + AC |
| Button shadow tweak | B - Visual Polish | DS ref |
| Spacing adjustment | B - Visual Polish | DS ref |
| Brand color update | B - Visual Polish | PO approval |
| Animation timing | B - Visual Polish | DS ref |

---

## 10. Boundary Cases

Some changes fall between categories. Use this guide:

| Question | If YES | If NO |
|----------|--------|-------|
| Does it change what users can do? | Category A | → |
| Does it change how the system behaves? | Category A | → |
| Does it communicate meaning to users? | Category A | → |
| Is it purely visual/aesthetic (no behavior change)? | Category B | → |
| Is it infrastructure/tooling? | Category C | Category A |

**Key distinction for frontend:** If a UI change affects user interaction, feedback, or communication, it is Category A (spec-first). Category B is only for pure visual polish that doesn't change what the user experiences functionally.

---

## 11. Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| "Just add this field to the API" | No domain justification | Create AC first: why is this field needed? |
| "Refactor IC for cleaner design" | Technical preference, not domain need | Either justify via BR, or tag as tech-debt |
| "Database needs this column" | Implementation driving design | What BR or AC requires this data? |
| "Other systems do it this way" | External influence without domain validation | Validate against US: does user need this? |
| "Make the button green" (semantic) | Treating semantic change as styling | If green means "success", needs AC |
| "Just a small UI fix" | Hiding behavior change as UI | If it changes user flow, needs AC |
