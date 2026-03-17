# Smart Compaction V2 — Architecture Design

## 1. Problem Statement

**Given:** A schedule with N jobs placed across printing stations (offset, digital) and downstream stations (cutting, finishing, die-cutting), each station having similarity criteria for changeover optimization.

**Current behavior (V1):** Smart compaction reorders tiles on **every** station independently based on similarity. This can produce suboptimal results because downstream station reordering may contradict the printing order, leading to unnecessary WIP and precedence-driven rollbacks.

**Goal (V2):** Optimize printing stations first (they are the bottleneck and primary changeover cost driver), then let downstream stations **inherit** the printing order through natural precedence propagation.

**Design principle:** Printing stations are the primary optimization target; downstream stations receive their work order from printing completion times.

---

## 2. Evolution — V1 Recap

### Current Algorithm (4-phase, per-station)

| Phase | Name | Description |
|-------|------|-------------|
| 0 | Preparation | Partition assignments into immobile / movable / frozen sets; classify stations |
| 1 | Similarity Reorder | Greedy nearest-neighbor reordering on **every** station with similarity criteria |
| 2 | Time Assignment | `compactTimeline()` assigns synthetic start times respecting precedence, drying time, working hours, quarter-hour snapping |
| 3 | Deadline Validation | Rollback jobs that became late; re-run `compactTimeline()` on rolled-back snapshot |

### V1 Limitations

1. **Independent station optimization** — Each station is reordered in isolation. Downstream reordering can fight against the printing order, causing precedence conflicts that `compactTimeline()` must resolve by pushing tiles later.
2. **Wasted reorder effort** — Downstream stations get reordered, then `compactTimeline()` overrides much of the reorder due to precedence constraints from printing completion times.
3. **Increased rollback rate** — Independent reordering of downstream stations increases the chance that previously on-time jobs become late, triggering rollbacks that undo useful work.
4. **No station role awareness** — The algorithm treats offset presses and finishing tables identically, despite fundamentally different optimization profiles.

---

## 3. V2 Design — Hierarchical Optimization

### Core Insight

In a print shop, the production flow is:

```
Printing (offset/digital) → Drying (if offset) → Downstream (cutting, finishing, die-cutting)
```

Printing stations are where changeover cost is highest (plate changes, ink changes, paper changes). Downstream stations have lower changeover costs and their work arrival is dictated by when printing completes. Therefore:

- **Optimize printing stations aggressively** for similarity (minimize changeovers)
- **Let downstream stations fill naturally** from the printing completion order (precedence-driven slot filling)
- **Only reorder independently** on downstream stations when jobs have no printing step

### Station Classification

```
┌─────────────────────────────────────────────────┐
│                    All Stations                   │
├──────────────────────┬──────────────────────────┤
│   Printing Stations  │   Downstream Stations     │
│   (primary targets)  │   (precedence-driven)     │
├──────────────────────┼──────────────────────────┤
│ • Offset Printing    │ • Cutting                 │
│ • Digital Printing   │ • Finishing / Folding      │
│                      │ • Die-Cutting              │
│                      │ • (any non-printing)       │
└──────────────────────┴──────────────────────────┘
```

**Classification rule:** A station is a "printing station" if its category is in the printing category set (`offset`, `digital`). All other stations are "downstream."

```typescript
function isPrintingStation(
  snapshot: ScheduleSnapshot,
  stationId: string,
): boolean {
  const station = snapshot.stations.find((s) => s.id === stationId);
  const category = snapshot.categories.find(
    (c) => c.id === station?.categoryId,
  );
  if (!category) return false;
  const name = category.name.toLowerCase();
  return name.includes('offset') || name.includes('digital');
}
```

> **Note:** V1 only checks for `'offset'`. V2 expands this to include `'digital'` since digital presses also benefit from paper-type grouping and are upstream of all downstream operations.

---

## 4. Algorithm — Phase Flow

### V2 Phase Overview

```
Phase 0: Preparation (unchanged)
    │
    ├── Partition assignments: immobile / movable / frozen
    ├── Classify stations: printing vs. downstream
    └── Build tile blocks (group split parts)

Phase 1: Printing Station Optimization (NEW — replaces old Phase 1)
    │
    ├── For each PRINTING station with similarity criteria:
    │   ├── Build tile blocks from movable assignments
    │   ├── Extract anchor spec from last immobile tile
    │   ├── Greedy nearest-neighbor reorder (maximize similarity)
    │   ├── Respect intra-element ordering constraint
    │   └── Tie-break by earlier workshopExitDate
    │
    └── Apply synthetic start times to printing tiles

Phase 2: Propagate via compactTimeline (NEW — replaces old Phase 2)
    │
    ├── Run compactTimeline() on ALL stations
    │   ├── Printing stations: preserve Phase 1 reorder
    │   ├── Downstream stations: arrival-order slot filling
    │   │   (jobs arrive as their printing predecessors complete)
    │   └── Handle: precedence, drying time, working hours, quarter-hour snap
    │
    └── Downstream order emerges naturally from printing completion times

Phase 3: Downstream Similarity Tie-Breaking (NEW)
    │
    ├── For downstream stations where multiple jobs arrive simultaneously:
    │   ├── Among tiles with identical earliest-start (same predecessor completion)
    │   └── Apply similarity tie-breaking (secondary criterion, lower priority than precedence)
    │
    └── Jobs with NO printing step: reorder independently on their stations

Phase 4: Deadline Validation & Rollback (unchanged from V1 Phase 3)
    │
    ├── For each job that had tiles moved:
    │   ├── Was on-time before but late now? → Rollback to original positions
    │   └── Re-run compactTimeline() on rolled-back snapshot
    │
    └── Final snapshot
```

### Phase 0 — Preparation (unchanged)

Same as V1. Three partitions based on temporal position relative to `now`:

| Partition | Condition | Behavior |
|-----------|-----------|----------|
| **Immobile** | `scheduledStart < now` | Locked — already started or past |
| **Movable** | `now ≤ scheduledStart ≤ now + horizonHours` | Subject to reordering and compaction |
| **Frozen** | `scheduledStart > now + horizonHours` | Not touched — beyond optimization window |

Additionally: classify each station as printing or downstream using `isPrintingStation()`.

### Phase 1 — Printing Station Optimization

This is the **core change**. Similarity-based reordering runs **only** on printing stations.

**Algorithm per printing station:**

1. Collect movable tile blocks for this station
2. If station has no similarity criteria → skip (compact only)
3. Extract anchor spec from last immobile tile (starting point for greedy chain)
4. Greedy nearest-neighbor:
   - Start from anchor (or first available block if no immobile tiles)
   - At each step, pick the unvisited block with highest similarity to current block
   - Tie-break: earlier `workshopExitDate` wins (respect urgency)
   - Constraint: intra-element sequence order must be preserved (blocks from the same element cannot be reordered relative to each other)
5. Assign synthetic start times in reordered sequence (monotonically increasing)

**Similarity scoring** (unchanged from V1):

```typescript
// Per criterion: 1 if values match, 0 if not
// Total: sum of matching criteria / total criteria count
function similarityScore(
  specA: ElementSpec,
  specB: ElementSpec,
  criteria: SimilarityCriterion[],
): number {
  let matches = 0;
  for (const c of criteria) {
    const valA = getNestedValue(specA, c.fieldPath);
    const valB = getNestedValue(specB, c.fieldPath);
    if (valA !== undefined && valB !== undefined && valA === valB) matches++;
  }
  return matches / criteria.length;
}
```

**Similarity criteria per station category:**

| Category | Criteria | Fields compared |
|----------|----------|-----------------|
| Offset Printing | papier, format, impression | `spec.papier`, `spec.format`, `spec.impression` |
| Digital Printing | papier | `spec.papier` |
| Cutting | format | `spec.format` |
| Finishing | papier, format | `spec.papier`, `spec.format` |
| Die-Cutting | formeSize | `spec.formeSize` |

In V2, only **Offset Printing** and **Digital Printing** criteria are used in Phase 1. The downstream criteria (Cutting, Finishing, Die-Cutting) are used only for Phase 3 tie-breaking.

### Phase 2 — Propagate via compactTimeline

After printing stations are reordered, `compactTimeline()` processes **all** stations to assign valid start/end times.

**Key behavior for downstream stations:**

- A downstream task's `earliestStart` is constrained by its predecessor's completion:
  - Intra-element: previous task in sequence must complete
  - Cross-element: all tasks of prerequisite element(s) must complete
  - Drying time: +20 minutes after offset printing predecessor
- Because printing reorder changes when predecessors complete, downstream tasks naturally reorder to match the new printing sequence
- No explicit downstream reordering needed — `compactTimeline()` handles it

**compactTimeline processing per station:**

```
For each station (in display order):
  Get movable assignments, sorted by scheduled start
  For each assignment:
    earliestStart = max(
      previousTaskEndOnStation,     // station capacity
      predecessorEnd,               // intra-element sequence
      prerequisiteElementLastEnd,   // cross-element dependency
      predecessorEnd + dryTime,     // if predecessor is offset
      now                           // no past placement
    )
    snap to next working time slot
    snap to quarter-hour boundary
    calculate end time
```

### Phase 3 — Downstream Similarity Tie-Breaking

When multiple jobs complete printing at the same time (or close enough that their downstream tasks have identical `earliestStart` values), a secondary similarity pass breaks the tie:

1. Identify downstream stations with ≥2 tiles sharing the same `earliestStart`
2. Within each group of tied tiles, apply similarity scoring using the downstream station's criteria
3. Reorder the tied tiles by similarity (greedy nearest-neighbor within the tied group)
4. Do NOT reorder across groups (precedence boundaries are respected)

**Special case — jobs with no printing step:**

Some jobs may only have downstream operations (e.g., cutting-only jobs). These jobs have no printing predecessor to inherit order from. For these:

- Collect their tile blocks on each downstream station
- Apply full similarity-based reordering (same as Phase 1 does for printing)
- This ensures they are still optimized, just independently

### Phase 4 — Deadline Validation & Rollback (unchanged)

Same as V1 Phase 3:

1. For each job with moved tiles, compare new end times against `workshopExitDate`
2. If a job was on-time before compaction but is now late → rollback all its tiles to original positions
3. After all rollbacks, re-run `compactTimeline()` to close any gaps left by rolled-back tiles
4. This guarantees compaction never makes things worse

---

## 5. Progress Reporting & UI

### Phase Progress Events

V2 enhances progress reporting to distinguish printing vs. downstream phases:

```typescript
export interface SmartCompactProgress {
  phase:
    | 'analyze'           // Phase 0
    | 'reorder-printing'  // Phase 1 (NEW — was 'reorder')
    | 'propagate'         // Phase 2 (NEW)
    | 'tie-break'         // Phase 3 (NEW)
    | 'validate'          // Phase 4
    | 'apply'
    | 'complete';
  stationName?: string;
  stationIndex?: number;
  totalStations?: number;
  result?: SmartCompactResult;
  message?: string;
}
```

### Phase Labels (SmartCompactModal)

```typescript
const PHASE_LABELS: Record<string, string> = {
  'analyze':          'Analyzing schedule',
  'reorder-printing': 'Optimizing printing station',   // NEW
  'propagate':        'Propagating downstream',          // NEW
  'tie-break':        'Tie-breaking downstream',         // NEW
  'validate':         'Validating constraints',
  'apply':            'Applying changes',
};
```

### Modal Phase Log Examples

```
[Phase 0]  Analyzing schedule... 12 printing tiles, 28 downstream tiles
[Phase 1]  Optimizing printing station: Offset Press 1 (1/3)
[Phase 1]  Optimizing printing station: Offset Press 2 (2/3)
[Phase 1]  Optimizing printing station: Digital Press 1 (3/3)
[Phase 2]  Propagating downstream: 5 stations
[Phase 3]  Tie-breaking downstream: Cutting 1 (3 tied groups)
[Phase 4]  Validating constraints... 0 rollbacks
[Done]     Similarity: 42% → 78% | Moved: 34 tiles | Rollbacks: 0
```

---

## 6. Result Reporting

### StationCompactResult Enhancement

V2 adds a `role` field to distinguish station types in results:

```typescript
export interface StationCompactResult {
  stationId: string;
  stationName: string;
  role: 'printing' | 'downstream';   // NEW
  movableCount: number;
  reorderedCount: number;
  similarityBefore: number;
  similarityAfter: number;
}
```

### SmartCompactResult (unchanged structure)

```typescript
export interface SmartCompactResult {
  snapshot: ScheduleSnapshot;
  movedCount: number;
  reorderedCount: number;
  similarityBefore: number;          // weighted average across printing stations
  similarityAfter: number;           // weighted average across printing stations
  rollbackCount: number;
  stationResults: StationCompactResult[];
}
```

> **Note:** Similarity metrics in V2 focus on printing stations, as these are the primary optimization target. Downstream similarity improvement is a secondary effect.

---

## 7. Type Changes Summary

### New / Modified Types

| Type | Change | File |
|------|--------|------|
| `SmartCompactProgress.phase` | Add `'reorder-printing'`, `'propagate'`, `'tie-break'` phases | `smartCompaction.ts` |
| `StationCompactResult.role` | Add `'printing' \| 'downstream'` field | `smartCompaction.ts` |
| `PHASE_LABELS` | Update keys for new phase names | `SmartCompactModal.tsx` |

### Unchanged Types

| Type | Reason |
|------|--------|
| `SmartCompactResult` | Structure unchanged; semantics of similarity metrics shift to printing-focused |
| `TileBlock` | Internal structure unchanged |
| `SimilarityCriterion` | Unchanged; used by both printing and tie-breaking |
| `CompactHorizon` | Unchanged (24/48/72/96/168h) |

---

## 8. Key Constraints

### Hard Constraints (inviolable)

1. **No precedence violations** — intra-element sequence, cross-element prerequisites, drying time (20 min after offset) are never broken
2. **No deadline degradation** — if a job was on-time before compaction, it must remain on-time after (rollback otherwise)
3. **No past placement** — immobile tasks (`scheduledStart < now`) are never moved
4. **Frozen boundary** — tasks beyond the horizon are untouched

### Soft Objectives (optimized in priority order)

1. **Maximize printing similarity** — minimize changeovers on printing stations (primary)
2. **Maximize downstream similarity** — tie-break for simultaneously-arriving jobs (secondary)
3. **Minimize gaps** — tight packing within station availability
4. **Respect urgency** — earlier `workshopExitDate` wins similarity ties

---

## 9. Implementation Sequence

### Step 1: Station Classification Utility

- Expand `isPrintingStation()` to include digital presses
- Add station role classification to preparation phase
- Unit tests for classification logic

**Files:** `apps/web/src/utils/precedenceConstraints.ts`, `smartCompaction.ts`

### Step 2: Phase 1 — Printing-Only Reorder

- Modify `runSmartCompact()` Phase 1 to skip non-printing stations
- Update progress events to emit `'reorder-printing'` phase
- Existing greedy nearest-neighbor algorithm unchanged — just applied to fewer stations

**Files:** `apps/web/src/utils/smartCompaction.ts`

### Step 3: Phase 2 — Propagate via compactTimeline

- After printing reorder, run `compactTimeline()` on all stations (this already exists)
- Emit `'propagate'` progress event
- No algorithmic changes to `compactTimeline()` itself — it already handles precedence correctly

**Files:** `apps/web/src/utils/smartCompaction.ts`

### Step 4: Phase 3 — Downstream Tie-Breaking

- New logic: identify tied tile groups on downstream stations
- Apply similarity scoring within tied groups using downstream station's criteria
- Handle no-printing-step jobs (independent reorder)

**Files:** `apps/web/src/utils/smartCompaction.ts`

### Step 5: UI Updates

- Update `PHASE_LABELS` in `SmartCompactModal`
- Update phase log rendering for new phase types
- Add `role` to station result display (optional — could show printing vs downstream breakdown)

**Files:** `apps/web/src/components/SmartCompactModal.tsx`

### Step 6: Tests

- Test: printing stations reordered by similarity, downstream stations not independently reordered
- Test: downstream tiles arrive in printing completion order
- Test: simultaneous arrivals tie-broken by similarity
- Test: no-printing-step jobs reordered independently
- Test: deadline rollback works across multi-station jobs
- Test: `isPrintingStation` correctly classifies offset and digital

**Files:** `apps/web/src/utils/smartCompaction.test.ts`

---

## 10. Comparison: V1 vs V2

| Aspect | V1 | V2 |
|--------|----|----|
| Station reorder scope | All stations with similarity criteria | Printing stations only (+ tie-breaking downstream) |
| Downstream order | Independent similarity reorder | Inherited from printing completion times |
| Phase count | 4 (0–3) | 5 (0–4) |
| `isPrintingStation` | Offset only | Offset + Digital |
| Progress phases | `analyze`, `reorder`, `validate` | `analyze`, `reorder-printing`, `propagate`, `tie-break`, `validate` |
| Rollback triggers | Any moved job that became late | Same (unchanged) |
| Similarity metric focus | All stations equally | Printing stations primary |
| Expected rollback rate | Higher (downstream reorder conflicts with precedence) | Lower (downstream order flows from printing) |
| Expected similarity gain | Moderate (spread across all stations) | Higher on printing (focused optimization) |

---

## 11. File Map

| File | Role |
|------|------|
| `apps/web/src/utils/smartCompaction.ts` | Core algorithm — phases 0–4 |
| `apps/web/src/utils/compactTimeline.ts` | Time assignment with precedence, drying, working hours |
| `apps/web/src/utils/precedenceConstraints.ts` | `isPrintingStation()`, precedence utilities |
| `apps/web/src/components/Tile/similarityUtils.ts` | Similarity scoring between element specs |
| `apps/web/src/utils/workingTime.ts` | Working hours snapping, quarter-hour rounding |
| `apps/web/src/components/SmartCompactModal.tsx` | UI modal with phase log and results |
| `packages/types/src/station.ts` | `SimilarityCriterion`, `StationCategory`, `StationGroup` |
| `packages/types/src/assignment.ts` | `TaskAssignment` |
| `packages/types/src/element.ts` | `Element`, `prerequisiteElementIds` |
| `apps/web/src/utils/smartCompaction.test.ts` | Test suite |

---

## 12. Open Questions

1. **Digital press drying time** — Currently only offset has drying time (20 min). Should digital presses also have configurable drying time? (Current answer: no — digital inks dry instantly.)

2. **Downstream similarity weight** — In Phase 3 tie-breaking, should similarity be the only tie-breaker, or should `workshopExitDate` urgency take precedence over similarity? (Current design: similarity first, then urgency as secondary tie-break.)

3. **Operator group constraints** — Station groups with `maxConcurrent` limits (e.g., "Offset Press Operators" with max 2 concurrent) affect which printing stations can run simultaneously. Should V2 consider group constraints during reordering? (Current answer: no — `compactTimeline()` handles this implicitly through capacity constraints.)
