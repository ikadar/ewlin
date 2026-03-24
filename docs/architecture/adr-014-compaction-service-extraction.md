# ADR-014 — Extract Smart Compaction to Node.js Service

**Status:** Proposed
**Date:** 2026-03-24
**Relates to:** [ADR-009](decision-records.md#adr-009--hybrid-backend-architecture-php--nodejs), [ADR-010](decision-records.md#adr-010--isomorphic-validation-service-nodejs)

---

## Context

The Smart Compaction algorithm (V2) is currently implemented as `SmartCompactionService` in the PHP API (`services/php-api/src/Service/SmartCompactionService.php`). It optimizes the production schedule by reordering tasks on printing stations for similarity, propagating changes downstream, and compacting the timeline.

The system's scheduling constraint logic — the single source of truth for what constitutes a valid schedule — lives in the `@flux/schedule-validator` TypeScript package. This was an explicit architectural choice (ADR-010): one codebase, shared between the browser (for real-time drag-and-drop feedback) and the Node.js Validation Service (for authoritative server-side validation). ADR-010 specifically states:

> *"Zero risk of client/server rule divergence."*

The SmartCompactionService violates this principle. Because it runs in PHP, it cannot import `@flux/schedule-validator`. Instead, it **re-implements a subset of the constraint logic** in PHP:

| Constraint | Canonical source (`@flux/schedule-validator`) | SmartCompactionService (PHP) |
|---|---|---|
| **Station overlap** | `validators/station.ts` — `rangesOverlap()` | Implicit via `nextAvailable` tracking |
| **Group capacity** | `validators/group.ts` — sweep-line `getMaxConcurrent()` | **Not checked at all** |
| **Precedence + dry time** | `validators/precedence.ts` — predecessor + successor checks | Predecessor only (`getPrecedenceFloor`); **successor ceiling not checked** |
| **Operating hours** | `validators/availability.ts` — slots + exceptions | `snapToNextWorkingTime()` (partial; exception handling unclear) |
| **Deadline** | `validators/deadline.ts` — per-task end vs workshop exit | Job-level rollback (different granularity) |
| **Approval gates** | `validators/approval.ts` — Paper/BAT/Plates/Forme | Not checked (N/A for time-only moves) |
| **Station mismatch** | `validators/stationMatch.ts` — task → station | Not checked (impossible to violate) |

### Observed consequences

The constraint divergence produces **conflicts after compaction** that the compaction algorithm never detected:

1. **GroupCapacityConflict** — Compaction packs tasks tightly on individual stations without awareness of station group `maxConcurrent` limits. When tasks from multiple stations in the same group are compacted into overlapping time windows, the group capacity is exceeded.

2. **PrecedenceConflict (successor-side)** — Compaction respects predecessor floors (a task cannot start before its predecessors finish) but does not check successor ceilings. A task's effective end time — including 4-hour dry time for offset printing — can push past a successor's already-scheduled start time.

3. **DeadlineConflict (edge cases)** — The rollback mechanism catches jobs that transition from on-time to late at the job level, but operates at a different granularity than the per-task deadline check in the validator.

These conflicts surface in the frontend when the schedule snapshot is enriched via the Validation Service after compaction completes, but by that point the invalid schedule is already persisted.

### Root cause

The root cause is not a missing feature or a bug in the compaction algorithm. It is a **code organization problem**: an algorithm that must respect scheduling constraints is implemented in a language (PHP) that cannot access the canonical constraint implementation (TypeScript). This forces a parallel implementation that inevitably diverges.

---

## Decision

Extract the Smart Compaction algorithm from the PHP API into a **dedicated Node.js service** (or a module within the existing Validation Service) that can directly import `@flux/schedule-validator`.

### Proposed architecture

```
Current:

  @flux/schedule-validator (TS) ──→ Validation Service (Node.js)
                                          ↑ HTTP
  PHP API ──→ SmartCompactionService (PHP)
                  └── re-implemented constraints (divergent)


Proposed:

  @flux/schedule-validator (TS) ──→ Validation Service (Node.js)
                                ──→ Compaction Service (Node.js)
                                          ↑ HTTP
  PHP API ──→ POST /smart-compact endpoint
                  └── orchestration only: snapshot → call service → persist result
```

### Responsibility split

**PHP API retains:**
- SSE endpoint (`POST /api/v1/schedule/smart-compact`) — streams progress to the frontend
- Schedule snapshot construction via `SnapshotBuilder`
- Result persistence — applying the compaction result to the Schedule aggregate via Doctrine
- Domain event emission (`ScheduleUpdated`, etc.)

**Node.js Compaction Service owns:**
- The optimization algorithm (clustering, nearest-neighbor, 2-opt)
- Timeline compaction (earliest-start packing)
- Constraint enforcement — by calling `@flux/schedule-validator` functions directly
- Deadline validation and rollback logic
- Progress event generation

### Constraint integration strategy

Instead of re-implementing constraints, the compaction algorithm calls the validator at two levels:

1. **Per-tile placement** — Before placing a tile at a candidate time, call the relevant validator functions (precedence, group capacity, availability) to verify the placement is valid. If invalid, find the next valid slot.

2. **Post-compaction sweep** — After all tiles are placed, run a full schedule enrichment to detect any remaining conflicts. Roll back jobs that introduced conflicts, similar to the current deadline rollback.

This guarantees that the compaction algorithm can never produce a schedule state that the validator would flag as conflicting.

### Communication protocol

The PHP API sends the current `ScheduleSnapshot` to the Compaction Service via HTTP POST. The Compaction Service returns a stream of progress events and a final result containing the new assignment times. The PHP API applies these times to the Schedule aggregate and persists.

This follows the same pattern already established between the PHP API and the Validation Service (ADR-009): PHP orchestrates, Node.js computes.

---

## Alternatives considered

| Alternative | Pros | Cons | Decision |
|---|---|---|---|
| **Add missing checks to PHP** (patch gaps) | Minimal change, fast to implement | Perpetuates divergence; every new validator rule must be ported to PHP | Rejected |
| **Call Validation Service HTTP per tile** | No code duplication | 100+ HTTP calls per compaction run; unacceptable latency | Rejected |
| **Post-compaction enrichment + rollback only** | Simple; single HTTP call at end | Detects but doesn't prevent conflicts; rollback cascades may be complex | Rejected as standalone; useful as safety net |
| **Port validator to PHP** | Single language | Breaks isomorphic principle (ADR-010); two codebases to maintain | Rejected |
| **WASM compilation of validator** | Run TS logic in PHP process | Complex toolchain; debugging difficulty; no ecosystem support | Rejected |
| **Extract to Node.js service** | Single source of truth; direct validator import; aligns with ADR-009/010 | Migration effort; second Node.js service to operate | **Accepted** |

---

## Consequences

### Positive

- **Single source of truth for constraints** — The compaction algorithm uses the same validation code as the frontend and the Validation Service. When a new constraint is added to `@flux/schedule-validator`, the compaction automatically respects it.
- **Eliminates conflict generation** — GroupCapacityConflict, successor-side PrecedenceConflict, and edge-case DeadlineConflict are prevented by construction, not detected after the fact.
- **Aligns with ADR-009 and ADR-010** — Extends the established pattern: PHP for orchestration and persistence, Node.js for scheduling computation with shared TypeScript packages.
- **Testable** — The compaction algorithm can be unit-tested with the same fixtures used for validator tests.
- **Simpler PHP API** — The `SmartCompactionService.php` (~1100 lines) is replaced by a thin orchestration layer.

### Negative

- **Migration effort** — The algorithm must be rewritten in TypeScript. The clustering, nearest-neighbor, and 2-opt heuristics are language-agnostic, but the Doctrine-specific data access must be replaced with snapshot-based input.
- **Second Node.js service** — Adds operational complexity. Can be mitigated by hosting as a module within the existing Validation Service process.
- **Latency** — One additional HTTP round-trip (snapshot → compaction service → result). Acceptable because compaction is a bulk operation (seconds), not a real-time interaction.
- **Snapshot size** — Full schedule snapshot must be transmitted. For large schedules this could be several MB. Mitigated by the same serialization already used for validation enrichment.

---

## Implementation notes

- The Compaction Service can start as a new endpoint within the existing Validation Service (`POST /compact`) rather than a separate deployment, reducing operational overhead.
- The existing `SmartCompactionService.php` serves as the specification for the TypeScript rewrite — all phases, heuristics, and edge cases are documented in code and in `docs/architecture/smart-compaction-v2.md`.
- The PHP endpoint remains the SSE proxy: it calls the Compaction Service, relays progress events to the frontend, and persists the final result.
- Migration can be incremental: start with the compaction + constraint checking in Node.js, keep the SSE streaming and persistence in PHP.

---

## Related documents

- [ADR-009 — Hybrid Backend Architecture](decision-records.md#adr-009--hybrid-backend-architecture-php--nodejs)
- [ADR-010 — Isomorphic Validation Service](decision-records.md#adr-010--isomorphic-validation-service-nodejs)
- [Service Boundaries](service-boundaries.md)
- [Smart Compaction V2 Architecture](smart-compaction-v2.md)
- [`@flux/schedule-validator`](../../packages/validator/)
