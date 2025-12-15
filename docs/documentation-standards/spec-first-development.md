---
tags:
  - meta
  - standards
---

# Spec-First Development

This document defines the spec-first development philosophy and workflow.

---

## 1. Philosophy

In Spec-First Development, the **specification is the source of truth**, and code is a **generated artifact**. This is analogous to how compiled binaries are generated from source code.

```
Traditional:    Spec → Code → Code modification → Code modification → ...
Spec-First:     Spec → Code → Spec modification → Code regeneration → ...
```

**Core principle:** When behavior needs to change, modify the specification first, then regenerate the code. Never modify generated code directly.

---

## 2. Why Spec-First?

| Benefit | Explanation |
|---------|-------------|
| Domain-level thinking | Humans work at "what" level, not "how" |
| Documentation = specification | Never outdated, it IS the source |
| Leverages LLM strengths | Good at spec→code, weak at understanding large codebases |
| No code drift | Implementation cannot diverge from intent |
| Platform agnostic | Same spec → PHP, TypeScript, Go... |
| Lower token usage | Specs are more compact than code |
| Built-in modularity | Complex apps naturally break into component specs |

---

## 3. Specification Hierarchy

For this project, the specification hierarchy is:

```
Domain Level (specifications originate here)
├── User Stories (US)           ← What users want
├── Acceptance Criteria (AC)    ← How to verify behavior
└── Business Rules (BR)         ← Domain constraints/invariants
                    ↓
                    ↓  Specs flow DOWN
                    ↓
            Backend path              Frontend path
                 ↓                         ↓
    API Interface Drafts (API)      UX/UI Specifications (UX)
                 ↓                         ↓
    Interface Contracts (IC)        Design System (DS)
                 ↓                         ↓
    Aggregate Design (AGG)          Frontend Components
                 ↓
    Service Boundaries (SB)
                 ↓
          Backend Code
```

### Primary Specs for Code Generation

| Path | Primary Spec | Constraints | Generated Artifact |
|------|--------------|-------------|-------------------|
| Backend | AC | BR | PHP code (services, entities) |
| Frontend | UX | DS | TypeScript/React components |

**AC is the primary specification for backend code generation** because:
- Right granularity for methods/functions
- Given/When/Then maps directly to tests
- Links up to US (intent) and down to BR (constraints)

**UX is the primary specification for frontend code generation** because:
- Defines component behavior and states
- Visual requirements map to styling
- Links up to US/AC (intent) and references DS (constraints)

---

## 4. Development Workflow

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

---

## 5. Workflow Rules

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

---

## 6. Prompt Template for Code Generation

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

---

## 7. Handling Bugs

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

---

## 8. Versioning

Specs and code are versioned together:

```
git commit -m "feat(gate): Add BAT approval validation

Spec: AC-GATE-001, BR-GATE-001
- Add BatApprovalValidator with @spec annotation
- Add PHPUnit test for Given/When/Then scenarios"
```

---

## 9. When to Regenerate vs Update

| Scenario | Action |
|----------|--------|
| New feature | Generate from spec |
| Bug in logic | Fix spec, regenerate |
| Performance issue | Add perf constraint to spec, regenerate |
| Refactoring | Update spec if interface changes, regenerate |
| Small typo in code | OK to fix directly (no spec impact) |
| Framework upgrade | Regenerate from same spec |

---

## 10. Metrics

Track spec-first compliance:

| Metric | Target |
|--------|--------|
| Code with @spec annotation | >80% of business logic |
| ACs with corresponding tests | 100% |
| Direct code modifications (without spec update) | <10% |
| Spec coverage of features | 100% |
