---
tags:
  - meta
  - standards
---

# Source Code Traceability

This document defines how source code should reference specification items.

---

## 1. Purpose

Source code should reference specification items to enable:
- **Traceability**: understand why code exists
- **Impact analysis**: know what code to update when specs change
- **Code review**: verify implementation matches specification

---

## 2. Primary Reference: Acceptance Criteria

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

---

## 3. Layer-Specific References

When AC is not applicable, use layer-appropriate references:

| Layer | Primary Ref | Secondary Ref | Example |
|-------|-------------|---------------|---------|
| Controller/API | API-* | AC-* | `@spec API-STATION-001` |
| Application/UseCase | AC-* | - | `@spec AC-GATE-001` |
| Domain/Entity | BR-* | AGG-* | `@spec BR-SCHED-001` |
| Domain Service | IC-* | AC-* | `@spec IC-ASSIGN-001` |

---

## 4. Annotation Format

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

---

## 5. What to Annotate

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

---

## 6. Multiple Specs

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

---

## 7. Spec Coverage Goals

| Code Type | Coverage Target |
|-----------|-----------------|
| Domain layer | 90%+ of public methods |
| Application layer | 80%+ of use case methods |
| API layer | 100% of endpoints |
| Infrastructure | Not required |

---

## 8. Verification Checklist

### 8.1 Before Code Review/Merge

- [ ] All business logic methods have @spec annotations
- [ ] All @spec IDs are valid (exist in `docs/`)
- [ ] @spec IDs match the feature being implemented
- [ ] Multiple specs listed when method implements multiple requirements

### 8.2 Traceability Verification Commands

**Find all @spec annotations:**
```bash
# PHP
grep -rn "@spec" src/

# TypeScript
grep -rn "@spec" apps/web/src/
```

**Verify spec ID exists:**
```bash
# Search for spec ID in documentation
grep -rn "AC-GATE-001" docs/
```

**Find code implementing a specific spec:**
```bash
grep -rn "@spec AC-GATE-001" src/
```

**Coverage check (approximate):**
```bash
# Count methods with @spec vs total public methods
grep -c "@spec" src/**/*.php
grep -c "public function" src/**/*.php
```

### 8.3 Forward Traceability (Spec → Code)

For each AC, verify you can find implementing code:

| Spec ID | Code Location | Test Location | Status |
|---------|---------------|---------------|--------|
| AC-XXX-001 | `src/path:line` | `tests/path:line` | [ ] |
| AC-XXX-002 | `src/path:line` | `tests/path:line` | [ ] |

### 8.4 Backward Traceability (Code → Spec)

For each @spec annotation, verify:

- [ ] Spec ID exists in documentation
- [ ] Code behavior matches spec description
- [ ] Test exists that verifies spec

---

## 9. Maintenance

When specs change:
1. Search codebase for `@spec {OLD-ID}`
2. Update or remove annotations
3. Verify implementation still matches spec
4. Update tests if behavior changed
