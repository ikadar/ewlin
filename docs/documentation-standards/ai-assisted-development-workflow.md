---
tags:
  - meta
  - standards
  - workflow
---

# AI-Assisted Development Workflow

This document defines the strict, mandatory workflow for AI-assisted development in this project. It ensures spec-first compliance, traceability, and consistent quality.

---

## 1. Overview

Every development task follows this workflow:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  1. REQUEST │ ──▶ │  2. SPEC    │ ──▶ │  3. GENERATE│ ──▶ │  4. VERIFY  │ ──▶ │  5. COMMIT  │
│   (Human)   │     │    (AI)     │     │    (AI)     │     │   (Both)    │     │   (Both)    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │                   │                   │
      ▼                   ▼                   ▼                   ▼                   ▼
  Natural            Formal specs        Generated code      Validated code      Traced commit
  language           US, AC, BR          with @spec          passing tests       with spec refs
  requirement        (+ approval)
```

**Key Principle:** Developers communicate in **natural language**. AI converts requirements to formal specifications, which the developer reviews and approves before code generation.

**Strict Rules:**
- NO code generation without approved specification
- NO code modification without spec reference
- NO commit without traceability
- EVERY iteration follows this workflow

---

## 2. Phase 1: REQUEST (Natural Language Input)

### 2.1 What the Developer Provides

The developer describes the requirement in **natural language**. No formal format required.

**Examples of valid requests:**

```
"Szeretnék egy funkciót, ami blokkolja a nyomtatási feladatokat amíg
a BAT jóváhagyás meg nem történik."

"A felhasználó tudjon szűrni a feladatok listájában státusz alapján."

"Kell egy új API endpoint ami visszaadja a station-ök kapacitását."
```

### 2.2 What the Developer Can Include

Optional additional context:
- **Priority/urgency** - how important is this feature
- **Constraints** - technical or business limitations
- **Related features** - what existing functionality it connects to
- **Examples** - concrete scenarios or use cases

### 2.3 What Happens Next

The AI will:
1. Analyze the natural language request
2. Identify related existing specifications (if any)
3. Generate formal specifications (US, AC, BR)
4. Present for developer approval

---

## 3. Phase 2: SPEC (AI-Generated Specification)

### 3.1 AI Responsibility

The AI converts natural language to formal specifications:

1. **Create User Story (US)** - captures the user need
2. **Create Acceptance Criteria (AC)** - defines verifiable behavior in Given/When/Then
3. **Identify Business Rules (BR)** - references existing or proposes new rules
4. **Determine technical path** - Backend (API/IC) or Frontend (UX/DS)
5. **Create technical spec** - if needed

### 3.2 Generated Specification Template

```markdown
## Generated Specification for [Feature Name]

### Domain Level
- **User Story:** US-{CATEGORY}-{NNN}
  > As a {role}, I want {goal}, so that {benefit}.

- **Acceptance Criteria:** AC-{CATEGORY}-{NNN}
  > **Given** {precondition}
  > **When** {action}
  > **Then** {expected result}

- **Business Rules:**
  - BR-{CATEGORY}-{NNN}: {rule description}
  - BR-{CATEGORY}-{NNN}: {rule description}

### Technical Level (Backend)
- **API:** API-{CATEGORY}-{NNN} - {endpoint description}
- **Interface Contract:** IC-{CATEGORY}-{NNN} - {contract description}

### Technical Level (Frontend)
- **UX Spec:** UX-{CATEGORY}-{NNN} - {component/behavior description}
- **Design System:** DS-{CATEGORY}-{NNN} - {visual constraints}
```

### 3.3 Spec Verification Checklist

Before presenting to developer, AI verifies:

- [ ] **US exists or created** - User Story defines what user wants
- [ ] **AC exists or created** - Acceptance Criteria defines verifiable behavior
- [ ] **BR referenced** - All relevant Business Rules identified
- [ ] **Path determined** - Backend (API/IC/AGG/SB) or Frontend (UX/DS)
- [ ] **Technical spec exists** - API/IC for backend, UX/DS for frontend
- [ ] **Traceability complete** - US → AC → BR → technical spec

### 3.4 Spec-to-Spec Traceability

Verify the specification chain:

```
US-XXX-NNN
    ↓ (referenced by)
AC-XXX-NNN
    ↓ (constrained by)
BR-XXX-NNN
    ↓ (implemented by)
API/IC or UX/DS
```

### 3.5 STOP - Developer Approval Required

**Present the generated specification and WAIT for approval.**

The developer can:
- **Approve** - proceed to code generation
- **Request changes** - AI modifies the specification
- **Reject** - start over with clarified requirements

---

## 4. Phase 3: GENERATE (Code Generation)

### 4.1 Prerequisites

Before code generation:

- [ ] **Specification approved** (Phase 2 complete)
- [ ] **All specs accessible** - US, AC, BR, technical spec
- [ ] **Traceability verified** - spec chain complete

### 4.2 What the AI Generates

Based on the approved specification, AI generates:

1. **Source code** with @spec annotations
2. **Unit tests** based on AC Given/When/Then
3. **Integration tests** if applicable

### 4.3 Code Generation Requirements

All generated code must:

- Include `@spec AC-{ID}` annotation on business logic
- Include `@spec BR-{ID}` annotations where business rules are enforced
- Follow existing code patterns in the codebase
- Include tests that map to AC scenarios

### 4.4 Iterative Correction Protocol

If generated code doesn't meet requirements:

```
1. IDENTIFY the gap
   ├── Missing @spec annotation?
   ├── Doesn't match AC behavior?
   ├── Violates BR constraint?
   └── Missing test coverage?

2. PROVIDE specific correction
   └── "The code doesn't handle [specific case from AC].
        Please update to [specific requirement]."

3. REQUEST regeneration
   └── "Regenerate with the correction, maintaining @spec annotations."

4. REPEAT until all requirements met
```

**Important:** Do NOT manually fix AI-generated code. Always request regeneration with specific corrections.

---

## 5. Phase 4: VERIFY (Validation)

### 5.1 Mandatory Checklist

Before accepting ANY generated code:

#### Code Quality
- [ ] **Compiles/builds** without errors
- [ ] **Lint passes** (ESLint, PHPStan)
- [ ] **Type checks pass** (TypeScript, PHP type hints)
- [ ] **Tests pass** (unit, integration)

#### Traceability
- [ ] **@spec annotations present** on all business logic
- [ ] **@spec references valid** (IDs exist in specs)
- [ ] **Test names reference AC** (e.g., `test_AC_GATE_001_...`)

#### Spec Compliance
- [ ] **AC Given verified** - preconditions handled
- [ ] **AC When verified** - action triggers correct behavior
- [ ] **AC Then verified** - expected results occur
- [ ] **BR constraints verified** - all rules enforced

### 5.2 Verification Commands

Run these commands before proceeding:

**Backend (PHP):**
```bash
./vendor/bin/phpunit                    # Tests pass
./vendor/bin/phpstan analyse            # Static analysis
php -l src/Path/To/File.php             # Syntax check
```

**Frontend (TypeScript/React):**
```bash
pnpm test                               # Tests pass
pnpm run lint                           # ESLint
npx tsc --noEmit                        # Type check
```

### 5.3 Spec Compliance Verification

For each AC, manually verify:

| AC Clause | Code Location | Verified |
|-----------|---------------|----------|
| Given: {precondition} | `file:line` | [ ] |
| When: {action} | `file:line` | [ ] |
| Then: {result} | `file:line` | [ ] |

### 5.4 STOP - Developer Approval Required

**Present verification results and WAIT for approval.**

---

## 6. Phase 5: COMMIT (Traceability)

### 6.1 Mandatory Checklist

Before committing:

- [ ] **All Phase 4 checks pass**
- [ ] **Specification saved to docs/** - US, AC, BR, technical specs
- [ ] **Commit message includes spec refs**
- [ ] **Changed files include @spec annotations**
- [ ] **Tests included in commit**

### 6.2 Commit Message Template

```
feat({scope}): {Short description}

{Longer description of what was implemented}

Spec: AC-{ID}, BR-{ID}, [API-{ID} / UX-{ID}]

- {Bullet point of what was added/changed}
- {Bullet point of what was added/changed}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### 6.3 Post-Commit Verification

After committing, verify traceability:

```bash
# Find all @spec annotations in committed files
git show --name-only HEAD | xargs grep -l "@spec"

# Verify spec IDs are valid (manual check against docs/)
```

---

## 7. Integration with Release Commands

### 7.1 /implement-release (Backend)

The `/implement-release` command follows this workflow automatically:

| Command Phase | Workflow Phase | What Happens |
|---------------|----------------|--------------|
| Phase 1: Preparation | REQUEST + SPEC | Read specs, create release doc |
| Phase 2: Implementation | GENERATE + VERIFY | Generate code, run tests |
| Phase 3: PR | COMMIT | Create commit with traceability |
| Phase 4: Release | - | Tag, release notes |

### 7.2 /implement-ui-release (Frontend)

The `/implement-ui-release` command follows the same workflow for frontend:

| Command Phase | Workflow Phase | What Happens |
|---------------|----------------|--------------|
| Phase 1: Preparation | REQUEST + SPEC | Read UX specs, create release doc |
| Phase 2: Implementation | GENERATE + VERIFY | Generate components, run tests |
| Phase 3: Merge | COMMIT | Merge to ux-ui-development |
| Phase 4: Documentation | - | Update release docs |

### 7.3 Manual Development

When NOT using release commands, follow the workflow manually:

1. **REQUEST** - Developer describes requirement in natural language
2. **SPEC** - AI generates formal specifications, developer approves
3. **GENERATE** - AI generates code with @spec annotations
4. **VERIFY** - Run all verification checks
5. **COMMIT** - Use commit message template with spec references

---

## 8. Traceability Matrix

Maintain traceability across all levels:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TRACEABILITY FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  US-XXX-NNN ◄─────────────────────────────────────────────────┐    │
│      │                                                         │    │
│      ▼                                                         │    │
│  AC-XXX-NNN ◄──────────────────────────────────────────┐      │    │
│      │                                                  │      │    │
│      ├──────────▶ BR-XXX-NNN                           │      │    │
│      │                │                                 │      │    │
│      ▼                ▼                                 │      │    │
│  API/UX-XXX-NNN ◄────┘                                 │      │    │
│      │                                                  │      │    │
│      ▼                                                  │      │    │
│  Source Code ──────────────────────────────────────────┘      │    │
│  (@spec AC-XXX-NNN, BR-XXX-NNN)                               │    │
│      │                                                         │    │
│      ▼                                                         │    │
│  Test Code ───────────────────────────────────────────────────┘    │
│  (test_AC_XXX_NNN_...)                                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.1 Forward Traceability (Spec → Code)

From any spec, you should be able to find:
- All code that implements it (`grep "@spec {ID}"`)
- All tests that verify it (`grep "test.*{ID}"`)

### 8.2 Backward Traceability (Code → Spec)

From any code, you should be able to find:
- The spec it implements (`@spec` annotation)
- The user need it fulfills (follow spec chain to US)

---

## 9. Anti-Patterns

### 9.1 Workflow Violations

| Violation | Problem | Correct Approach |
|-----------|---------|------------------|
| "Quick fix without spec" | No traceability | Create AC first, then fix |
| "AI generated, I'll add @spec later" | Often forgotten | Require @spec in prompt |
| "Tests are passing, ship it" | No spec verification | Verify AC compliance |
| "Manually fixed AI code" | Breaks regeneration | Request AI correction |

### 9.2 Spec Violations

| Violation | Problem | Correct Approach |
|-----------|---------|------------------|
| "AC without US" | No user context | Create US first |
| "Code without AC" | Unverifiable | Create AC first |
| "Changed spec after code" | Inverted flow | Regenerate code from new spec |

---

## 10. Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AI-ASSISTED DEVELOPMENT                          │
│                       QUICK REFERENCE                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. REQUEST (Developer):                                            │
│     → Describe requirement in natural language                      │
│     → No formal format required                                     │
│                                                                     │
│  2. SPEC (AI generates, Developer approves):                        │
│     → AI creates: US, AC (Given/When/Then), BR refs                 │
│     → STOP: Wait for developer approval                             │
│                                                                     │
│  3. GENERATE (AI):                                                  │
│     → Code with @spec annotations                                   │
│     → Tests based on AC scenarios                                   │
│                                                                     │
│  4. VERIFY (Both):                                                  │
│     □ Builds?  □ Lint?  □ Types?  □ Tests?  □ @spec present?       │
│     → STOP: Wait for developer approval                             │
│                                                                     │
│  5. COMMIT (Both):                                                  │
│     □ Specs saved to docs?  □ Spec refs in commit message?          │
│                                                                     │
│  NEVER:                                                             │
│  ✗ Generate code without approved spec                              │
│  ✗ Manually fix AI code (request regeneration)                      │
│  ✗ Commit without @spec annotations                                 │
│  ✗ Skip approval steps                                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```
