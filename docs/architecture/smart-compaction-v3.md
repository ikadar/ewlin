# Smart Compaction V3 — Architecture Design

**Supersedes:** [Smart Compaction V2](smart-compaction-v2.md) (PHP implementation)
**Related:** [ADR-014 — Extract Smart Compaction to Node.js](adr-014-compaction-service-extraction.md)

---

## 1. Problem Statement

**Given:** A schedule with N jobs placed across printing stations (offset, digital) and downstream stations (cutting, finishing, die-cutting), each station having similarity criteria for changeover optimization.

**V2 problem:** The V2 implementation lives in PHP and re-implements scheduling constraints (precedence, operating hours, timeline packing) separately from the canonical `@flux/schedule-validator`. This causes the compaction to produce conflicts that the validator later detects — particularly GroupCapacityConflict and successor-side PrecedenceConflict. See ADR-014 for the full gap analysis.

**Goal (V3):** Rewrite the compaction algorithm in TypeScript as a Node.js service that directly imports `@flux/schedule-validator`. The algorithm logic (clustering, nearest-neighbor, 2-opt, compaction, rollback) remains the same; only the implementation language and constraint integration change.

**Design principles:**
- Printing stations are the primary optimization target; downstream stations receive their work order from printing completion times.
- **Every tile placement is validated** by the same constraint logic used by the frontend and the Validation Service — no parallel implementation, no divergence.
- The PHP API orchestrates (SSE streaming, persistence); the Node.js service computes.

---

## 2. Architecture

```
Frontend                  PHP API                        Node.js
(SmartCompactModal)       (ScheduleController)           (Compaction Service)
┌──────────────┐          ┌───────────────┐              ┌──────────────────────┐
│ Config view   │──POST──▶│ Build snapshot │──POST /───▶  │ Phase 0: Analyze     │
│ (horizon)     │         │               │  compact      │ Phase 1: Cluster     │
│               │◀──SSE───│ Relay progress │◀─events──── │ Phase 2: Propagate   │
│ Running view  │         │               │              │ Phase 3: Print-free  │
│ (phase log)   │         │ Persist result│◀─result───── │ Phase 4: Validate    │
│               │         └───────────────┘              │                      │
│ Complete view │                                        │ @flux/schedule-      │
└──────────────┘                                         │   validator (direct) │
                                                         └──────────────────────┘
```

**External API (unchanged):**
- **Endpoint:** `POST /api/v1/schedule/smart-compact`
- **Request:** `{ "horizonHours": 24 }`
- **Response:** SSE stream (`text/event-stream`)

**Internal API (PHP → Node.js):**
- **Endpoint:** `POST /compact`
- **Request:** `{ "snapshot": ScheduleSnapshot, "horizonHours": 24 }`
- **Response:** SSE stream of progress events + final result with new assignment times

The PHP API builds the `ScheduleSnapshot` (via `SnapshotBuilder`), sends it to the compaction service, relays SSE progress events to the frontend, and persists the result to the Schedule aggregate.

---

## 3. Station Classification

| Type | Criteria | Behavior |
|------|----------|----------|
| **Printing** | Category name contains `offset`, `numérique`, or `digital` | Cluster-first similarity reorder (Phase 1) |
| **Downstream** | Non-printing, but element chain has a printing task | Inherits order from printing via precedence propagation (Phase 2) |
| **Print-free** | Non-printing, element chain has zero printing tasks | Independent cluster-first reorder (Phase 3) |

Note: `isOptimizableStation()` (offset + digital) is separate from `isPrintingTask()` (offset-only, used for drying time). The latter is already exported from `@flux/schedule-validator` (`validators/precedence.ts`).

### Downstream vs print-free determination

A station is **downstream** if any of its tasks belong to an element whose prerequisite chain contains a printing task. The check is recursive:

```
elementHasPrintingTask(elementId):
  1. Check direct tasks on the element — if any task's stationId is an optimizable station → return true
  2. Recurse into element.prerequisiteElementIds (upstream chain)
  3. Cycle detection via visited set
  4. Return false if no printing task found in chain
```

Per-tile classification on non-printing stations:
- If a tile's element chain has a printing task → the tile is **downstream** (excluded from print-free reordering)
- If a tile's element chain has no printing task → the tile is **print-free**
- A non-printing station with ≥2 print-free tiles gets independent reordering (Phase 3)

Note: the traversal follows `prerequisiteElementIds` only — not cross-job `requiredJobIds`.

---

## 4. Algorithm — Cluster-First with Urgency Weighting

The algorithm is identical to V2. This section is the authoritative description.

### Why not greedy nearest-neighbor?

Greedy NN picks the most similar **next** tile myopically. It can produce suboptimal global sequences — e.g., picking a slightly similar tile now may prevent a perfect similarity run later. It also doesn't consider deadline urgency.

### Similarity scoring

Two tiles are compared by their element's `spec` fields, using the station's `similarityCriteria`:

```
tileSpecSimilarity(specA, specB, criteria) → int:
  matches = 0
  for each criterion in criteria:
    valA = specA[criterion.fieldPath]
    valB = specB[criterion.fieldPath]
    if valA !== null AND valB !== null AND valA === valB:
      matches++
  return matches
```

- Each matching field contributes +1 (no per-field weighting)
- Both values must be non-null for a match
- `scoreSimilarity(tiles, criteria)` sums consecutive-pair similarity: `tiles[0]↔tiles[1]` + `tiles[1]↔tiles[2]` + ...

### Cluster-First approach

For each printing station:

1. **Group tiles by primary criterion** (first `similarityCriterion.fieldPath`, typically `papier` for offset)
2. **Order clusters** with two-level sort:
   - **Primary: anchor match** — if an anchor spec exists, the cluster whose group key matches the anchor's field value sorts first
   - **Secondary: earliest deadline** — among remaining clusters, sort by earliest `workshopExitDate` (nulls last)
3. **Within each cluster** — greedy NN by remaining criteria (format, impression) for fine-grained ordering
4. **Recursion** — clustering is hierarchical: after grouping by the primary criterion, each group is recursively sub-grouped by secondary criteria, then tertiary, etc. At each level the anchor propagates: the last tile placed in the previous cluster becomes the anchor spec for the next cluster.
5. **Respect intra-element ordering** — tiles from same element preserve `sequenceOrder`

This produces runs of identical paper → same format → same impression, ordered by urgency across runs.

### Anchor awareness

The **anchor** is the last immobile tile on the station (where `scheduledStart < now`). Its element's spec is extracted. If no immobile tile exists, anchor is empty (no anchor preference in cluster ordering).

The anchor influences cluster ordering at every recursion level:
- Level 0 (paper): cluster matching anchor's paper value goes first
- Level 1 (format): sub-cluster matching anchor's format value goes first within each paper group
- After each cluster is fully placed, the last tile's spec becomes the new anchor for the next cluster

### Greedy nearest-neighbor with deadline penalty

Within each terminal cluster (no further sub-grouping), tiles are ordered by greedy NN:

```
Constants:
  SIMILARITY_WEIGHT = 100
  DEADLINE_PENALTY_WEIGHT = 1

For each position in the output sequence:
  lastSpec = spec of previously placed tile (or anchor spec for first)
  cumulativeDuration = total minutes of all tiles placed so far

  For each remaining candidate tile:
    Skip if precedence constraints not satisfied (canPlaceTile check)

    similarity = tileSpecSimilarity(lastSpec, candidate.spec, criteria)

    deadlinePenalty = 0
    if candidate has deadline:
      estimatedEndMinutes = cumulativeDuration + candidate.totalMinutes
      estimatedEnd = now + estimatedEndMinutes
      if estimatedEnd > deadline:
        deadlinePenalty = (estimatedEnd - deadline) in minutes

    score = 100 × similarity - 1 × deadlinePenalty

  Pick candidate with highest score
```

The formula means: each matching spec field is worth tolerating up to 100 minutes of additional lateness.

### 2-opt Local Improvement

After greedy NN ordering, apply 2-opt swaps:

1. For each pair (i, j) in the ordered list, try reversing the sub-sequence [i+1..j]
2. Accept if `scoreSimilarity(newOrder)` > `scoreSimilarity(currentOrder)`
3. Reject if any precedence constraint would be violated (intra-element sequence must be preserved)
4. Up to 100 iterations, restart from beginning on each improvement

---

## 5. Phase Flow

```
Phase 0 — Analyze:
  Parse ScheduleSnapshot into working data structures
  Partition assignments: immobile (start < now) / movable (within horizon) / frozen
  Classify stations: printing / downstream / print-free
  Build per-station sorted assignment lists

Phase 1 — Cluster & reorder printing stations:
  For each printing station with ≥2 movable tiles:
    Build clusters by primary criterion
    Order clusters by urgency (earliest deadline) with anchor-awareness
    Within clusters: greedy NN by secondary criteria
    2-opt improvement
    Record reordered assignment list

Phase 2 — Propagate via compaction:
  Apply reordered printing tiles with synthetic start times
  Compact ALL stations (see §6 Compaction with Constraint Integration):
    For each movable tile on each station:
      Calculate earliest valid start (see §6)
      Validate placement via @flux/schedule-validator
      If conflict → find next valid slot
  Downstream tiles naturally reorder via predecessor end times
  Multi-pass convergence (max 5 passes, stop when 0 tiles moved)

Phase 3 — Print-free reorder:
  Same cluster-first + 2-opt algorithm for tiles with no printing dependency
  Re-compact affected stations

Phase 4 — Validate & rollback:
  For each moved job: compare completion time before vs after
  If on-time → late: rollback entire job to original assignments
  If any conflict remains on job's tiles: rollback entire job
  Re-compact after rollbacks

Phase 5 — Return result:
  Return new assignment times to PHP API for persistence
  PHP API applies to Schedule aggregate and flushes
```

---

## 6. Compaction with Constraint Integration

This is the core difference from V2. Instead of re-implementing constraints, the compaction loop calls `@flux/schedule-validator` functions directly.

### Per-tile placement

For each movable tile on a station, in chronological order:

```typescript
import { validateAssignment } from '@flux/schedule-validator';
import { snapToNextWorkingTime, addWorkingTime } from '@flux/schedule-validator/utils/workingTime';
import { getEffectivePredecessorEnd, isPrintingTask } from '@flux/schedule-validator/validators/precedence';
import { calculateEndTime } from '@flux/schedule-validator/validators/shared';

function findEarliestValidStart(tile, station, snapshot, stationNextAvailable): Date {
  // 1. Station continuity: no earlier than previous tile's end
  let earliest = stationNextAvailable;

  // 2. Precedence floor: no earlier than predecessors' effective end
  //    (includes dry time for printing predecessors)
  const predecessorEnd = getEffectivePredecessorEnd(tile, snapshot);
  if (predecessorEnd && predecessorEnd > earliest) {
    earliest = predecessorEnd;
  }

  // 3. Snap to operating hours
  earliest = snapToNextWorkingTime(earliest, station);

  // 4. Round up to quarter-hour (ceiling)
  //    e.g., 10:23:45 → 10:30:00, 10:15:00 → 10:15:00 (unchanged)
  //    Always rounds forward; zeroes seconds
  earliest = ceilToQuarterHour(earliest);

  // 5. Validate the full placement
  const proposed = {
    taskId: tile.taskId,
    targetId: station.id,
    isOutsourced: false,
    scheduledStart: earliest.toISOString(),
  };
  const result = validateAssignment(proposed, snapshot);

  // 6. If conflicts, handle:
  //    - PrecedenceConflict: use suggestedStart from result
  //    - GroupCapacityConflict: advance past the conflicting window
  //    - StationConflict: advance past the overlapping tile
  //    (loop until valid or no slot found within horizon)

  return earliest;
}
```

### Snapshot mutation

After each tile is placed, the in-memory `ScheduleSnapshot.assignments` array must be updated to reflect the new position. This ensures subsequent placements see the current state.

This is lightweight — it's an array splice on the snapshot object, not a database operation.

### Validator functions used

| Need | Function | Package path |
|------|----------|-------------|
| Full placement validation | `validateAssignment()` | `validate.ts` |
| Predecessor effective end (incl. dry time) | `getEffectivePredecessorEnd()` | `validators/precedence.ts` |
| Successor effective end (incl. dry time) | `getEffectiveTaskEnd()` | `validators/precedence.ts` |
| Is printing station (for dry time) | `isPrintingTask()` | `validators/precedence.ts` |
| Snap to operating hours | `snapToNextWorkingTime()` | `utils/workingTime.ts` |
| Calculate end time (internal/outsourced) | `calculateEndTime()` | `validators/shared.ts` |
| Add working time (skip non-operating) | `addWorkingTime()` | `utils/workingTime.ts` |
| Time range overlap | `rangesOverlap()` | `utils/time.ts` |
| Max concurrent in group | `getMaxConcurrent()` | `utils/time.ts` |
| Task ordering | `compareTaskOrder()` | `utils/helpers.ts` |
| Find predecessors/successors | `getPredecessorTask()`, `getCrossElementPredecessors()`, etc. | `utils/helpers.ts` |

---

## 7. Hard Constraints (inviolable)

All constraints are enforced by calling `@flux/schedule-validator` — not re-implemented.

1. **No station overlap** — `validateStationConflict()`
2. **No group capacity violations** — `validateGroupCapacity()` *(new in V3, was missing in V2)*
3. **No precedence violations** — `validatePrecedence()` — intra-element sequence, cross-element prerequisites, cross-job dependencies, drying time (240 min after offset)
4. **No deadline degradation** — if a job was on-time before compaction, it must remain on-time after (rollback via `validateDeadline()`)
5. **Operating hours respected** — `validateAvailability()` + `snapToNextWorkingTime()`
6. **No past placement** — immobile tasks (`scheduledStart < now`) are never moved
7. **Frozen boundary** — tasks beyond the horizon are untouched
8. **Station assignment unchanged** — tiles stay on their current station

---

## 8. Compaction Service Contract

### Request (PHP → Node.js)

```typescript
POST /compact
Content-Type: application/json

{
  snapshot: ScheduleSnapshot,  // Full schedule state from SnapshotBuilder
  horizonHours: number         // e.g., 24
}
```

### Response (Node.js → PHP)

SSE stream (`text/event-stream`) with progress events, then a final result:

```typescript
interface CompactionResult {
  // New assignment times — the only data the PHP API needs to persist
  assignments: Array<{
    taskId: string;
    scheduledStart: string;  // ISO-8601
    scheduledEnd: string;    // ISO-8601
  }>;

  // Statistics (for the SSE complete event)
  movedCount: number;                    // Tiles whose scheduledStart changed
  reorderedCount: number;                // Tiles reordered by similarity algorithm
  similarityBefore: number;              // Sum of consecutive similarity matches before
  similarityAfter: number;               // Sum of consecutive similarity matches after
  rollbackCount: number;                 // Jobs rolled back (on-time → late)
  printingStationsOptimized: number;     // Printing stations where similarity reorder applied
  downstreamStationsPropagated: number;  // Downstream stations affected by propagation
  printfreeStationsReordered: number;    // Print-free stations with independent reorder
  computeMs: number;                     // Wall-clock compute time in milliseconds
}
```

The PHP API applies `assignments` to the Schedule aggregate via `rescheduleTask()` for each changed tile, then flushes. The frontend re-fetches the snapshot after receiving the SSE `complete` event.

---

## 9. Progress Events (SSE)


Unchanged from V2. The PHP API relays these from the compaction service to the frontend.

```json
{"type":"progress","phase":"analyze","stepsCompleted":1,"message":"Analyzing schedule"}
{"type":"progress","phase":"reorder_printing","stationName":"Offset Press 1","stationIndex":0,"totalStations":3,"stepsCompleted":2}
{"type":"progress","phase":"propagate","stepsCompleted":5,"message":"Propagating to downstream stations"}
{"type":"progress","phase":"reorder_printfree","stationName":"Massicot 1","stationIndex":0,"totalStations":1,"stepsCompleted":6}
{"type":"progress","phase":"validate","stepsCompleted":7,"message":"Validating constraints"}
{"type":"complete","phase":"complete","result":{"movedCount":34,"reorderedCount":12,"similarityBefore":3,"similarityAfter":9,"rollbackCount":0,"printingStationsOptimized":2,"downstreamStationsPropagated":3,"printfreeStationsReordered":1,"computeMs":450}}
```

---

## 10. File Map

| File | Role |
|------|------|
| `services/compaction/src/compact.ts` | Core algorithm — phases 0–4, returns new assignments |
| `services/compaction/src/cluster.ts` | Hierarchical clustering by similarity criteria |
| `services/compaction/src/reorder.ts` | Greedy NN + 2-opt within clusters |
| `services/compaction/src/timeline.ts` | Compaction loop — earliest valid start with validator integration |
| `services/compaction/src/rollback.ts` | Deadline + conflict rollback logic |
| `services/compaction/src/types.ts` | CompactionProgress, CompactionResult types |
| `services/compaction/src/server.ts` | HTTP endpoint (`POST /compact`) with SSE streaming |
| `packages/validator/` | `@flux/schedule-validator` — constraint logic (unchanged, imported directly) |
| `services/php-api/.../ScheduleController.php` | `POST /smart-compact` — SSE proxy, builds snapshot, persists result |
| `apps/web/src/components/SmartCompactModal.tsx` | Frontend — consumes SSE, displays progress (unchanged) |

---

## 11. Testing Strategy

V2 had minimal test coverage (4 smoke tests). V3 establishes proper coverage:

| Level | What | How |
|-------|------|-----|
| **Unit** | Clustering, NN ordering, 2-opt | Pure functions with fixture data, assert output order |
| **Unit** | Compaction loop | Given a snapshot + movable tiles, assert all placements pass `validateAssignment()` |
| **Integration** | Full compact cycle | Given a realistic snapshot, run all phases, assert zero conflicts in output |
| **Regression** | Conflict-free guarantee | After compaction, call `validateAssignments()` on every assignment — must return zero conflicts |
| **Property** | Invariant preservation | No assignment moves to the past, no frozen tile moves, no station change, no on-time→late transition |

The **conflict-free guarantee test** is the key addition: after every compaction run, validate the entire result with `@flux/schedule-validator` and assert zero conflicts. This is the test V2 could never have, because it would have required calling the validator it didn't use.
