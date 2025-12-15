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

| Document | Requires |
|----------|----------|
| Interface Contracts (IC) | AC or BR change first |
| API Interface Drafts (API) | AC or US change first |
| Aggregate Design (AGG) | BR or DM change first |
| Service Boundaries (SB) | AGG or IC change first |
| Source Code | AC or BR change first |

---

## 3. Valid Change Triggers

| Change Type | Valid Trigger | Invalid Trigger |
|-------------|---------------|-----------------|
| New API endpoint | New US + AC | "We need this endpoint" |
| Modified IC | Changed BR or AC | "Better interface design" |
| New aggregate field | Changed DM or BR | "Database needs this" |
| Refactored service | Changed SB justified by BR | "Cleaner architecture" |

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
   ├── Update API if external interface changes
   ├── Update IC if service contract changes
   ├── Update AGG if entity structure changes
   └── Update SB if service responsibility changes

4. Generate/update code
   └── With @spec annotations pointing to AC/BR

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

### Category A: Domain Changes

**Requires:** US, AC, or BR trigger (mandatory)

| Scope | Examples |
|-------|----------|
| Business logic | New feature, workflow change, validation rule |
| API contracts | New endpoint, changed request/response |
| Data model | New entity, changed relationships |
| User-facing behavior | Error messages, form validation, notifications |

**Commit format:**
```
feat(gate): Add BAT approval validation

Spec: AC-GATE-001, BR-GATE-001
```

### Category B: UI/UX Changes

**Requires:** Design system reference (DS-\*) OR UX specification reference (UX-\*) OR product owner approval

| Scope | Examples |
|-------|----------|
| Styling | Colors, typography, spacing, shadows |
| Animations | Transitions, hover effects, loading states |
| Layout polish | Alignment, responsive tweaks |
| Branding | Logo, color scheme updates |

**Commit format:**
```
[ui] Update primary button color to brand green

Design system: DS-COLOR-001
```

```
[ui] Adjust panel layout spacing

UX spec: UX-PANEL-003
```

```
[ui] Change icon set to Lucide

PO: {Name} - verbal approval {date}
```

**Note:** If a UI change affects user communication (e.g., error states, success feedback), it may require Category A treatment with an AC.

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

| Change Type | Category | Trigger Required |
|-------------|----------|------------------|
| New user capability | A - Domain | US + AC |
| Business rule change | A - Domain | BR + AC |
| API endpoint change | A - Domain | AC + API spec |
| Error message wording | A - Domain | AC (user communication) |
| Button color (branding) | B - UI/UX | Design system ref |
| Loading spinner style | B - UI/UX | Design system ref |
| Red color for errors | A - Domain | AC (semantic meaning) |
| Security patch | C - Tech | CVE reference |
| Query optimization | C - Tech | Justification |
| Add logging | C - Tech | Justification |
| Accessibility (WCAG) | A - Domain | US-ACCESS + AC |

---

## 10. Boundary Cases

Some changes fall between categories. Use this guide:

| Question | If YES | If NO |
|----------|--------|-------|
| Does it change what users can do? | Category A | → |
| Does it change how the system behaves? | Category A | → |
| Does it communicate meaning to users? | Category A | → |
| Is it purely visual/aesthetic? | Category B | → |
| Is it infrastructure/tooling? | Category C | Category A |

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
