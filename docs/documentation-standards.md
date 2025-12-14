---
tags:
  - meta
  - standards
---

# Documentation Standards

This document defines the standards and conventions for the Flux project documentation.

---

## 1. Document Structure

### 1.1 YAML Front Matter
Every documentation file must include YAML front matter with tags:

```yaml
---
tags:
  - specification
  - requirements
---
```

### 1.2 ID Naming Convention

Each identifiable item uses a consistent ID format: `PREFIX-CATEGORY-NNN`

| Prefix | Document | Example |
|--------|----------|---------|
| US | User Stories | US-STATION-001 |
| AC | Acceptance Criteria | AC-STATION-001 |
| BR | Business Rules | BR-STATION-001 |
| WF | Workflow Definitions | WF-ASSIGN-001 |
| DM | Domain Model | DM-STATION-001 |
| API | API Interface Drafts | API-STATION-001 |
| IC | Interface Contracts | IC-STATION-001 |
| AGG | Aggregate Design | AGG-STATION-001 |
| SB | Service Boundaries | SB-STATION-001 |

### 1.3 ID Heading Format

IDs must be defined as h4 headings to enable Obsidian anchor links:

```markdown
### Register a Station
#### US-STATION-001
```

This allows linking with short anchors: `[US-STATION-001](user-stories.md#us-station-001)`

---

## 2. Cross-Reference Rules

### 2.1 Reference Format

Each item should include a References line immediately after the ID heading:

```markdown
#### AC-STATION-001
> **References:** [US-STATION-001](user-stories.md#us-station-001), [BR-STATION-001](../domain-model/business-rules.md#br-station-001)
```

### 2.2 Document Hierarchy

References flow from high-level to low-level documents:

```
User Stories (US)
    ↓ 1:n
Acceptance Criteria (AC)
    ↓
API Interface Drafts (API)
    ↓
Interface Contracts (IC)
    ↓
Aggregate Design (AGG)
    ↓
Service Boundaries (SB)
```

Cross-cutting references:
- Business Rules (BR) - referenced by all levels
- Domain Model (DM) - referenced by technical documents
- Workflow Definitions (WF) - referenced by API and implementation docs

### 2.3 Cardinality Rules

| Relationship | Cardinality | Rule |
|--------------|-------------|------|
| US → AC | 1:n | Every US must have at least one AC |
| AC → US | n:1 | Every AC must reference exactly one US |
| AC → BR | n:m | ACs may reference multiple BRs |
| API → AC | n:m | APIs reference relevant ACs |
| IC → API | 1:1 | Each IC implements one API |
| AGG → DM | 1:n | Aggregates reference domain entities |
| SB → AGG | 1:n | Services own multiple aggregates |

---

## 3. Content Standards

### 3.1 User Stories Format

```markdown
### {Title}
#### US-{CATEGORY}-{NNN}
> **References:** [BR-*](path#anchor)

> As a **{role}**, I want **{goal}**, so that **{benefit}**.

**Acceptance Criteria:**
- Criterion 1
- Criterion 2
```

### 3.2 Acceptance Criteria Format

```markdown
### AC-{CATEGORY}-{NNN}: {Title}
> **References:** [US-*](path#anchor), [BR-*](path#anchor)

**Given** {precondition}
**When** {action}
**Then** {expected result}
```

### 3.3 Business Rules Format

```markdown
### BR-{CATEGORY}-{NNN}: {Title}

{Rule description}

**Constraints:**
- Constraint 1
- Constraint 2
```

---

## 4. Link Conventions

### 4.1 Internal Links

Use relative paths with lowercase anchors:

```markdown
[US-STATION-001](user-stories.md#us-station-001)
[BR-STATION-001](../domain-model/business-rules.md#br-station-001)
```

### 4.2 Anchor Format

Anchors are auto-generated from h4 headings in lowercase:
- `#### US-STATION-001` → `#us-station-001`
- `#### BR-GATE-001` → `#br-gate-001`

---

## 5. Maintenance Rules

### 5.1 Adding New Items

1. Assign the next available ID in the category
2. Add h4 heading with the ID
3. Add References line with relevant links
4. Update referenced documents if needed (e.g., add AC reference to US)

### 5.2 Removing Items

1. Search for all references to the item
2. Update or remove references
3. Remove the item
4. Document the removal in CHANGELOG if significant

### 5.3 Validation Checklist

- [ ] Every US has at least one AC
- [ ] Every AC references exactly one US
- [ ] All internal links are valid
- [ ] IDs follow naming convention
- [ ] YAML front matter present

---

## 6. Source Code Traceability

### 6.1 Purpose

Source code should reference specification items to enable:
- **Traceability**: understand why code exists
- **Impact analysis**: know what code to update when specs change
- **Code review**: verify implementation matches specification

### 6.2 Primary Reference: Acceptance Criteria

Use **AC** (Acceptance Criteria) as the primary spec reference because:
- Appropriate granularity (one method ≈ one AC)
- Testable and verifiable
- Transitive traceability (AC links to US and BR)

```php
/**
 * Validates that BAT approval is granted before printing tasks can start.
 *
 * @spec AC-GATE-001
 */
public function validateBatApproval(Job $job): ValidationResult
{
    // Implementation
}
```

### 6.3 Layer-Specific References

When AC is not applicable, use layer-appropriate references:

| Layer | Primary Ref | Secondary Ref | Example |
|-------|-------------|---------------|---------|
| Controller/API | API-* | AC-* | `@spec API-STATION-001` |
| Application/UseCase | AC-* | - | `@spec AC-GATE-001` |
| Domain/Entity | BR-* | AGG-* | `@spec BR-SCHED-001` |
| Domain Service | IC-* | AC-* | `@spec IC-ASSIGN-001` |

### 6.4 Annotation Format

**PHP (PHPDoc):**
```php
/**
 * Brief description of what the method does.
 *
 * @spec AC-GATE-001
 * @spec BR-GATE-001
 */
public function methodName(): ReturnType
```

**TypeScript (JSDoc):**
```typescript
/**
 * Brief description of what the function does.
 *
 * @spec AC-PERF-001
 */
function functionName(): ReturnType
```

### 6.5 What to Annotate

**DO annotate:**
- Business logic methods
- Validation methods
- API endpoint handlers
- Domain operations
- State transitions

**DO NOT annotate:**
- Getters/setters
- Utility/helper methods
- Framework boilerplate
- Infrastructure code (repositories, mappers)
- Constructors (unless they enforce invariants)

### 6.6 Multiple Specs

When a method implements multiple specs, list all:

```php
/**
 * Assigns a task to a station with conflict detection.
 *
 * @spec AC-SCHED-003
 * @spec AC-CONFLICT-001
 * @spec BR-ASSIGN-001
 */
public function assignTask(Task $task, Station $station): Assignment
```

### 6.7 Spec Coverage Goals

| Code Type | Coverage Target |
|-----------|-----------------|
| Domain layer | 90%+ of public methods |
| Application layer | 80%+ of use case methods |
| API layer | 100% of endpoints |
| Infrastructure | Not required |

### 6.8 Maintenance

When specs change:
1. Search codebase for `@spec {OLD-ID}`
2. Update or remove annotations
3. Verify implementation still matches spec

---

## 7. Spec-First Development

### 7.1 Philosophy

In Spec-First Development, the **specification is the source of truth**, and code is a **generated artifact**. This is analogous to how compiled binaries are generated from source code.

```
Traditional:    Spec → Code → Code modification → Code modification → ...
Spec-First:     Spec → Code → Spec modification → Code regeneration → ...
```

**Core principle:** When behavior needs to change, modify the specification first, then regenerate the code. Never modify generated code directly.

### 7.2 Why Spec-First?

| Benefit | Explanation |
|---------|-------------|
| Domain-level thinking | Humans work at "what" level, not "how" |
| Documentation = specification | Never outdated, it IS the source |
| Leverages LLM strengths | Good at spec→code, weak at understanding large codebases |
| No code drift | Implementation cannot diverge from intent |
| Platform agnostic | Same spec → PHP, TypeScript, Go... |
| Lower token usage | Specs are more compact than code |
| Built-in modularity | Complex apps naturally break into component specs |

### 7.3 Specification Hierarchy

For this project, the specification hierarchy is:

```
User Stories (US)          ← What users want (high-level intent)
        ↓ 1:n
Acceptance Criteria (AC)   ← How to verify (testable behaviors) ← PRIMARY SPEC
        ↓                                                          FOR CODE GEN
Business Rules (BR)        ← Domain constraints (invariants)
        ↓
API Interface Drafts (API) ← External contracts
        ↓
Interface Contracts (IC)   ← Internal service contracts
```

**AC is the primary specification for code generation** because:
- Right granularity for methods/functions
- Given/When/Then maps directly to tests
- Links up to US (intent) and down to BR (constraints)

### 7.4 Development Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. SPECIFY                                                     │
│     ├── Create or modify AC (acceptance criteria)               │
│     ├── Reference relevant BR (business rules)                  │
│     └── Link to parent US (user story)                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. GENERATE                                                    │
│     ├── Provide spec (AC + BR) to LLM                           │
│     ├── LLM generates code with @spec annotations               │
│     └── Code includes test stubs derived from AC                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. VERIFY                                                      │
│     ├── Run tests (derived from AC Given/When/Then)             │
│     ├── Run static analysis (PHPStan level 8)                   │
│     └── Review @spec annotations match implementation           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────┐
                    │  Tests pass?    │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              ↓                             ↓
         YES: Commit                   NO: Go to step 1
    (spec + code + tests)           (modify spec, not code)
```

### 7.5 Workflow Rules

**DO:**
- Start every feature with AC definition
- Include relevant BR references in the AC
- Let LLM generate code from spec
- Write tests that verify AC criteria
- Commit spec and code together

**DO NOT:**
- Modify generated code directly (modify spec instead)
- Skip the specification step
- Generate code without @spec annotations
- Commit code without corresponding spec

### 7.6 Prompt Template for Code Generation

When requesting code generation from LLM:

```markdown
## Specification

**Acceptance Criteria:** AC-GATE-001
> Given a job with BAT status "pending"
> When a printing task is scheduled
> Then validation fails with "BAT approval required"

**Business Rules:**
- BR-GATE-001: BAT approval blocks printing tasks
- BR-GATE-002: BAT can be bypassed with explicit flag

**References:**
- User Story: US-GATE-001
- Related ACs: AC-GATE-002

## Request

Generate a PHP method that implements AC-GATE-001.
Include @spec annotation and PHPUnit test.
```

### 7.7 Handling Bugs

When a bug is discovered:

```
1. Identify which AC the bug violates
   └── If no AC exists, the spec is incomplete → create AC first

2. Determine root cause
   ├── Spec is wrong → Fix AC/BR, regenerate code
   ├── Spec is incomplete → Extend AC/BR, regenerate code
   └── Code doesn't match spec → Regenerate code (spec is correct)

3. Never fix code without updating spec (if spec was wrong)
```

### 7.8 Versioning

Specs and code are versioned together:

```
git commit -m "feat(gate): Add BAT approval validation

Spec: AC-GATE-001, BR-GATE-001
- Add BatApprovalValidator with @spec annotation
- Add PHPUnit test for Given/When/Then scenarios"
```

### 7.9 When to Regenerate vs Update

| Scenario | Action |
|----------|--------|
| New feature | Generate from spec |
| Bug in logic | Fix spec, regenerate |
| Performance issue | Add perf constraint to spec, regenerate |
| Refactoring | Update spec if interface changes, regenerate |
| Small typo in code | OK to fix directly (no spec impact) |
| Framework upgrade | Regenerate from same spec |

### 7.10 Metrics

Track spec-first compliance:

| Metric | Target |
|--------|--------|
| Code with @spec annotation | >80% of business logic |
| ACs with corresponding tests | 100% |
| Direct code modifications (without spec update) | <10% |
| Spec coverage of features | 100% |

---

## 8. Change Governance

### 8.1 Top-Down Change Principle

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

### 8.2 Prohibited Direct Changes

**NEVER** directly modify these without a domain-level trigger:

| Document | Requires |
|----------|----------|
| Interface Contracts (IC) | AC or BR change first |
| API Interface Drafts (API) | AC or US change first |
| Aggregate Design (AGG) | BR or DM change first |
| Service Boundaries (SB) | AGG or IC change first |
| Source Code | AC or BR change first |

### 8.3 Valid Change Triggers

| Change Type | Valid Trigger | Invalid Trigger |
|-------------|---------------|-----------------|
| New API endpoint | New US + AC | "We need this endpoint" |
| Modified IC | Changed BR or AC | "Better interface design" |
| New aggregate field | Changed DM or BR | "Database needs this" |
| Refactored service | Changed SB justified by BR | "Cleaner architecture" |

### 8.4 Change Traceability Format

Every technical spec change must reference its domain trigger:

```markdown
### IC-ASSIGN-005: New Batch Assignment Contract
> **References:** [AC-SCHED-015](../requirements/acceptance-criteria.md#ac-sched-015)
> **Change trigger:** AC-SCHED-015 (Batch assignment of multiple tasks)

{contract definition}
```

### 8.5 Change Request Workflow

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

### 8.6 Exception: Technical Debt

Pure technical improvements (refactoring, performance) that don't change behavior:

1. **Still require justification** - document why in commit message
2. **No spec changes needed** if behavior unchanged
3. **Tag as technical debt** - `[tech-debt]` in commit message

```
git commit -m "[tech-debt] Optimize query performance

No spec change - behavior unchanged.
Justification: Query time reduced from 500ms to 50ms."
```

### 8.7 Review Checklist

Before approving any technical spec change:

- [ ] Is there a domain-level trigger (US, AC, BR)?
- [ ] Is the trigger referenced in the technical spec?
- [ ] Does the change actually address the domain requirement?
- [ ] Are downstream specs updated consistently?

### 8.8 Change Categories

Not all changes require domain-level triggers. Changes are categorized by their nature:

#### Category A: Domain Changes

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

#### Category B: UI/UX Changes

**Requires:** Design system reference OR product owner approval

| Scope | Examples |
|-------|----------|
| Styling | Colors, typography, spacing, shadows |
| Animations | Transitions, hover effects, loading states |
| Layout polish | Alignment, responsive tweaks |
| Branding | Logo, color scheme updates |

**Commit format:**
```
[ui] Update primary button color to brand green

Design system: DS-COLOR-PRIMARY
```

**Note:** If a UI change affects user communication (e.g., error states, success feedback), it may require Category A treatment with an AC.

#### Category C: Technical/Infrastructure Changes

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

#### Category Decision Matrix

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

#### Boundary Cases

Some changes fall between categories. Use this guide:

| Question | If YES | If NO |
|----------|--------|-------|
| Does it change what users can do? | Category A | → |
| Does it change how the system behaves? | Category A | → |
| Does it communicate meaning to users? | Category A | → |
| Is it purely visual/aesthetic? | Category B | → |
| Is it infrastructure/tooling? | Category C | Category A |

### 8.9 Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| "Just add this field to the API" | No domain justification | Create AC first: why is this field needed? |
| "Refactor IC for cleaner design" | Technical preference, not domain need | Either justify via BR, or tag as tech-debt |
| "Database needs this column" | Implementation driving design | What BR or AC requires this data? |
| "Other systems do it this way" | External influence without domain validation | Validate against US: does user need this? |
| "Make the button green" (semantic) | Treating semantic change as styling | If green means "success", needs AC |
| "Just a small UI fix" | Hiding behavior change as UI | If it changes user flow, needs AC |
