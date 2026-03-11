# Intelligent Compaction: Similarity-Aware Tile Reordering

## Context

The current `compactTimeline()` removes gaps between tiles by pushing them earlier while **preserving the existing sequence**. It never reorders. The scheduler displays similarity indicators (filled/hollow circles) between consecutive tiles, but operators must manually reorder tiles (via drag-drop or swap) to group similar work together and reduce changeover time.

**Goal**: Design an algorithm that **reorders** tiles on each station to maximize similarity between consecutive tiles, subject to:
- No job finishes after its `workshopExitDate` (no delays)
- No constraint violations (precedence, station conflict, operating hours, group capacity)
- Immobile tiles (already started) stay put

---

## 1. Formal Problem Definition

### 1.1 Classification

This is a **Single-Machine Scheduling with Sequence-Dependent Setup Times, Precedence Constraints, and Deadlines** — in Graham notation:

> **Jm | prec, d_j, s_{ij} | max(s_{ij})**

Where:
- **Jm**: m unrelated parallel machines (stations, each processing its own tile set)
- **prec**: intra-element (sequenceOrder) + cross-element (prerequisiteElementIds)
- **d_j**: job deadlines (workshopExitDate)
- **s_{ij}**: sequence-dependent dissimilarity cost between tile i and tile j
- **Objective**: maximize total similarity (= minimize total dissimilarity between consecutive tiles)

### 1.2 Complexity

**NP-hard.** Even the single-machine version without precedence is equivalent to the Asymmetric Traveling Salesman Problem (ATSP). Each tile is a "city"; dissimilarity is the "distance." Finding an optimal permutation is NP-hard.

**Practical implication**: For typical print shop sizes (10-50 tiles/station), greedy heuristics with local improvement produce solutions within 5-15% of optimal and run in milliseconds.

### 1.3 Decision Variables

For each station s, find a permutation pi_s of its movable tiles such that when tiles are placed in order pi_s (with gaps removed), all constraints remain satisfied and similarity is maximized.

---

## 2. Time Window Computation

The key enabler for safe reordering is computing **time windows** `[earliestStart, latestEnd]` for each tile. A tile can be placed anywhere within its window without violating constraints.

### 2.1 Dependency Graph (DAG)

Build over all assigned tasks:
```
Edges:
  1. Intra-element:  task[seq=k] -> task[seq=k+1]   (same element)
  2. Cross-element:  lastTask(prereqElem) -> firstTask(dependentElem)
  3. Edge weight:    +DRY_TIME_MS (240 min) if source is on offset press station
```

### 2.2 Forward Pass — earliestStart(t)

Process in topological order:
```
earliestStart(t) = max(
    now,
    predecessorEnd(intra-element) + dryTime?,
    max(predecessorEnd(cross-element_i) + dryTime?) for all cross-element predecessors,
    snapToNextWorkingTime(result, t.station)
)
```

### 2.3 Backward Pass — latestEnd(t)

Process in reverse topological order:
```
latestEnd(t) = min(
    workshopExitDate(job),
    latestStart(successor_intra) - dryTime?,
    min(latestStart(successor_cross_i) - dryTime?) for all cross-element successors
)

latestStart(t) = latestEnd(t) - duration(t)   // in working time
```

### 2.4 Slack

```
slack(t) = latestStart(t) - earliestStart(t)
```

- `slack <= 0` -> **critical**: must be placed at earliest position, no room for reordering
- `slack > 0` -> **flexible**: can be repositioned to improve similarity

### 2.5 Outsourced Tasks

Treated as **immovable anchors** — they have fixed departure/return times, unlimited provider capacity, and are not candidates for reordering. They contribute to `earliestStart` computation for successors but are never moved.

---

## 3. The Algorithm

### 3.1 Architecture: Segment-Based Decomposition

Immobile tiles (already started) partition each station's timeline into independent **segments**:

```
Station timeline:
  [FROZEN_A] [mobile_1, mobile_2, mobile_3] [FROZEN_B] [mobile_4, mobile_5]
              \_____ segment 1 _____/                   \____ segment 2 ___/
```

Each segment is bounded by:
- **Left**: end of previous frozen tile (or `now`)
- **Right**: start of next frozen tile (or horizon end)

Segments are reordered independently.

### 3.2 Three-Phase Algorithm

```
Phase 1: Preparation
  - Compute time windows (forward + backward pass)
  - Partition each station into segments around immobile tiles

Phase 2: Greedy Construction (per segment)
  - Build sequence one tile at a time using nearest-neighbor
  - Score = alpha * similarity + (1-alpha) * urgency
  - Only place feasible tiles (respect time windows)

Phase 3: Local Improvement (per segment)
  - Adjacent-swap improvement: try swapping consecutive tiles
  - Accept swap if similarity improves AND feasibility preserved

Phase 4: Compaction
  - Apply existing gap-removal logic to the reordered sequence

Phase 5: Cascade Repair
  - Recompute cross-station precedence; push affected tiles forward
  - Iterate until stable (typically 1-2 rounds, max 3)
```

### 3.3 Phase 2 Detail: Greedy Nearest-Neighbor with Urgency

```typescript
function greedyConstruct(segment, criteria, earliestStart, latestStart, alpha = 0.7):
    remaining = new Set(segment.tiles)
    sequence = []
    currentTime = segment.leftBound
    currentSpec = segment.anchorSpec   // spec of tile just before segment

    while remaining.size > 0:
        // 1. Find feasible candidates
        candidates = [...remaining].filter(t => {
            const start = max(currentTime, earliestStart[t.id])
            const end = start + duration(t)
            return end <= latestEnd(t)
        })

        if candidates.length === 0:
            // SAFETY: no tile fits -> abort reordering, return original order
            return segment.originalOrder

        // 2. Check for critical tiles that MUST go now
        critical = candidates.filter(t => latestStart[t] <= currentTime)

        if critical.length > 0:
            // Place most urgent critical tile (earliest deadline first)
            best = argmin(critical, t => latestEnd[t])
        else:
            // 3. Score by similarity + urgency
            best = argmax(candidates, t => {
                sim = similarityScore(currentSpec, spec(t), criteria)  // [0,1]
                urg = urgencyScore(t, latestStart, horizonMs)          // [0,1]
                return alpha * sim + (1 - alpha) * urg
            })

        // 4. Place the tile
        sequence.push(best)
        remaining.delete(best)
        currentTime = max(currentTime, earliestStart[best]) + duration(best)
        if isPrintingStation(best.station): currentTime += DRY_TIME
        currentSpec = spec(best)

    return sequence
```

**Why alpha = 0.7?** Favor similarity (the primary optimization goal) but give enough weight to urgency to prevent near-deadline tiles from being pushed dangerously late. Configurable per invocation.

### 3.4 Similarity Score Function

Reuses existing `compareSimilarity()` from `similarityUtils.ts`:

```typescript
function similarityScore(specA: ElementSpec | undefined, specB: ElementSpec | undefined,
                          criteria: SimilarityCriterion[]): number {
    if (!specA || !specB || criteria.length === 0) return 0;
    const results = compareSimilarity(specA, specB, criteria);
    return results.filter(r => r.isMatched).length / results.length;  // normalized [0,1]
}
```

**Uniform weights** for now — no empirical basis for differential weights. Future extension: accept per-criterion weights from `StationCategory` configuration.

### 3.5 Urgency Score Function

```typescript
function urgencyScore(tile, latestStart, horizonMs): number {
    const slack = latestStart[tile.id] - now;
    if (slack <= 0) return 1.0;          // critical
    return 1.0 - Math.min(slack / horizonMs, 1.0);  // normalized [0,1]
}
```

### 3.6 Phase 3 Detail: Adjacent-Swap Improvement

```typescript
function improveBySwaps(sequence, criteria, earliestStart, latestStart, segment):
    let improved = true
    while improved:
        improved = false
        for i = 0 to sequence.length - 2:
            const a = sequence[i], b = sequence[i+1]

            // Compute similarity gain from swapping a,b
            const prevSpec = i > 0 ? spec(sequence[i-1]) : segment.anchorSpec
            const nextSpec = i+2 < sequence.length ? spec(sequence[i+2]) : null

            const oldScore = sim(prevSpec, spec(a)) + sim(spec(a), spec(b))
                           + (nextSpec ? sim(spec(b), nextSpec) : 0)
            const newScore = sim(prevSpec, spec(b)) + sim(spec(b), spec(a))
                           + (nextSpec ? sim(spec(a), nextSpec) : 0)

            if newScore > oldScore:
                // Verify feasibility after swap
                const candidate = [...sequence]
                candidate[i] = b; candidate[i+1] = a
                if isFeasible(candidate, earliestStart, latestStart, segment):
                    sequence = candidate
                    improved = true
                    break  // restart scan
    return sequence
```

### 3.7 Feasibility Check

```typescript
function isFeasible(sequence, earliestStart, latestStart, segment): boolean {
    let currentTime = segment.leftBound
    for (const tile of sequence) {
        const start = max(currentTime, earliestStart[tile.id])
        const snapped = snapToNextWorkingTime(start, tile.station)
        const end = addWorkingTime(snapped, duration(tile), tile.station)

        if (end > latestEnd(tile)) return false       // deadline violation
        if (end > segment.rightBound) return false     // overlap with next frozen tile

        currentTime = end
        if (isPrintingStation(tile.station)) currentTime += DRY_TIME
    }
    return true
}
```

---

## 4. Cross-Station Cascade Effects

Reordering on station A can shift a tile later, affecting its successor on station B.

**Solution**: Iterative cascade repair:
```
1. After all stations reordered, recompute earliestStart for all tiles
2. For each tile whose new earliestStart > current scheduledStart:
   - Push tile to new earliestStart (snap to working hours)
   - Propagate to its successors
3. Repeat until stable (max 3 iterations -- convergence is fast because
   each iteration can only push tiles forward, never backward)
```

**Station processing order**: Process in topological order of the station dependency graph (offset press -> finishing -> binding -> packaging). This minimizes cascade iterations.

---

## 5. Feasibility Guarantees

### Theorem: The algorithm never introduces deadline violations.

**Argument**:
1. **Time windows are sound**: Forward/backward passes compute tight bounds from immutable constraints (now, immobile tiles, deadlines, outsourced anchors).
2. **Greedy respects windows**: Only places tiles where `tileEnd <= latestEnd(tile)`. If no feasible placement exists -> falls back to original order (known feasible).
3. **Swaps preserve feasibility**: Every swap is checked before acceptance; infeasible swaps are rejected.
4. **Cascade only pushes forward**: Cascade repair moves tiles later, never earlier. If it creates a deadline violation, the original schedule was already infeasible.
5. **Immobility preserved**: Frozen tiles are never moved, by construction.

### Group Capacity Safety

For stations in groups with `maxConcurrent != null`: **skip reordering** (apply only standard compaction). Group capacity conflicts are cross-station and harder to verify during local moves. This is a safe conservative choice — can be enhanced later.

---

## 6. Edge Cases

| Case | Handling |
|------|----------|
| All tiles critical (slack ~ 0) | Urgency dominates -> EDF ordering (correct; no room for similarity) |
| Same-job tiles interleaved | Valid — precedence within element is checked via earliestStart |
| Circular dependencies | Impossible by domain invariant (DAG enforced in UI). Topological sort would detect -> abort with no changes |
| Outsourced tasks in chain | Immovable anchors — contribute to time windows but never reordered |
| No similarity criteria for station category | Skip reordering for that station entirely |
| Single tile in segment | Nothing to reorder — skip |
| Segment too tight (all tiles back-to-back with zero slack) | Greedy finds no improvement -> returns original order |

---

## 7. Computational Complexity

| Phase | Complexity | Typical (30 tiles, 4 criteria) |
|-------|-----------|-------------------------------|
| Time windows (DAG) | O(V + E) | ~100 tasks, ~150 edges -> <1ms |
| Segment partitioning | O(n) per station | <1ms |
| Greedy construction | O(n^2 * k) | 900 * 4 = 3,600 ops -> <1ms |
| Adjacent-swap improvement | O(n^2 * I), I ~ 2-5 | ~4,500 ops -> <1ms |
| Cascade repair | O(S * n * 3) | 10 * 30 * 3 = 900 -> <1ms |
| **Total for 10 stations** | **O(S * n^2 * k)** | **< 50ms** |

---

## 8. Interface & Integration

### 8.1 Public API

```typescript
// apps/web/src/utils/intelligentCompact.ts

export interface IntelligentCompactOptions {
    snapshot: ScheduleSnapshot;
    horizonHours: CompactHorizon;
    now?: Date;
    calculateEndTime: (task: InternalTask, start: string, station: Station | undefined) => string;
    /** Similarity vs urgency weight. 0.0 = urgency only, 1.0 = similarity only. Default: 0.7 */
    alpha?: number;
}

export interface IntelligentCompactResult {
    snapshot: ScheduleSnapshot;
    movedCount: number;
    reorderedCount: number;       // tiles that changed position (not just shifted)
    skippedCount: number;
    similarityBefore: number;     // total similarity score before
    similarityAfter: number;      // total similarity score after
}

export function intelligentCompact(options: IntelligentCompactOptions): IntelligentCompactResult;
```

### 8.2 Files to Create

| File | Purpose | ~Lines |
|------|---------|--------|
| `apps/web/src/utils/intelligentCompact.ts` | Main algorithm | ~300 |
| `apps/web/src/utils/intelligentCompact.test.ts` | Tests | ~800 |
| `apps/web/src/utils/timeWindows.ts` | Forward/backward pass | ~120 |
| `apps/web/src/utils/timeWindows.test.ts` | Tests | ~250 |

### 8.3 Existing Code to Reuse

| Function | Source | Used For |
|----------|--------|----------|
| `compareSimilarity()`, `valuesMatch()`, `getFieldValue()` | `components/Tile/similarityUtils.ts` | Similarity scoring |
| `snapToNextWorkingTime()`, `addWorkingTime()` | `utils/workingTime.ts` | Operating hours handling |
| `isPrintingStation()` | `utils/precedenceConstraints.ts` | Dry time detection |
| `getElementTasks()`, `getJobIdForTask()` | `utils/taskHelpers.ts` | Task graph traversal |
| `snapToQuarterHour()`, `isTaskImmobile()`, `isWithinHorizon()` | `utils/compactTimeline.ts` | Reuse or extract shared helpers |
| `DRY_TIME_MS`, `PRINTING_CATEGORY_ID` | `@flux/types/constants` | Constants |

### 8.4 UI Integration

Add alongside the existing compact buttons (4h/8h/24h/48h/72h) — either as a toggle ("Simple" vs "Smart") or a separate button. Same trigger flow via the scheduling store, same result format for the UI to diff and apply.

---

## 9. Test Suite

Tests follow existing patterns from `compactTimeline.test.ts` and `swap.test.ts` — same helpers (`createSnapshot`, `createStation`, `createJob`, `createElement`, `createTask`, `createAssignment`, `mockCalculateEndTime`), augmented with spec and category helpers.

### 9.1 Additional Test Helpers

```typescript
// Category with similarity criteria (offset press)
function createOffsetCategory(id = 'cat-offset'): StationCategory {
  return {
    id, name: 'Presse offset', description: '',
    similarityCriteria: [
      { name: 'Meme papier', fieldPath: 'papier' },
      { name: 'Meme format', fieldPath: 'format' },
      { name: 'Meme encrage', fieldPath: 'impression' },
      { name: 'Meme surfacage', fieldPath: 'surfacage' },
    ],
  };
}

// Category without similarity criteria (finishing)
function createFinishingCategory(id = 'cat-finishing'): StationCategory {
  return { id, name: 'Finition', description: '', similarityCriteria: [] };
}

// Station group (unlimited by default)
function createGroup(id = 'grp-1', maxConcurrent: number | null = null): StationGroup {
  return { id, name: id, maxConcurrent, isOutsourcedProviderGroup: false };
}

// Element with spec
function createElementWithSpec(
  jobId: string, taskIds: string[],
  spec: Partial<ElementSpec>, prereqs: string[] = []
): Element {
  return {
    ...createElement(jobId, taskIds),
    spec: { ...spec },
    prerequisiteElementIds: prereqs,
  };
}

// Assert: no tile finishes after its job's deadline
function assertNoDeadlineViolations(result: IntelligentCompactResult) { ... }

// Assert: no two tiles overlap on same station
function assertNoStationConflicts(result: IntelligentCompactResult) { ... }

// Assert: precedence respected (no task starts before its predecessor ends)
function assertNoPrecedenceViolations(result: IntelligentCompactResult) { ... }

// Compute total similarity score for a snapshot
function computeTotalSimilarity(snapshot: ScheduleSnapshot): number { ... }
```

---

### 9.2 `timeWindows.test.ts` — Forward/Backward Pass

```
describe('computeTimeWindows')

  describe('forward pass -- earliestStart')
    - single task with no predecessors -> earliestStart = now
    - linear chain A->B->C -> B.earliest = A.end, C.earliest = B.end
    - printing predecessor adds DRY_TIME (240 min) to earliest
    - cross-element predecessor: first task of dependent element
      waits for last task of prerequisite element
    - diamond dependency: element C depends on both A and B ->
      C.earliest = max(A.lastTask.end, B.lastTask.end)
    - outsourced predecessor: successor earliest = outsourced.returnDate
    - outsourced with manualReturn: uses manual override as anchor
    - snaps to station operating hours (predecessor ends 15:00,
      station closes 14:00 -> successor earliest = next day 06:00)
    - ignores unassigned predecessor tasks (no assignment = no constraint)

  describe('backward pass -- latestEnd')
    - leaf task (no successors) -> latestEnd = workshopExitDate
    - linear chain: latestEnd propagates backward from deadline
    - printing task: latestEnd reduced by DRY_TIME before successor
    - cross-element: last task of prereq element constrained by
      first task of dependent element's latestStart
    - diamond dependency: task feeding two successors ->
      latestEnd = min(successor1.latestStart, successor2.latestStart)
    - multiple jobs with different deadlines on same station ->
      each task gets its own latestEnd from its job
    - outsourced successor: latestEnd = successor's departureTime

  describe('slack computation')
    - slack = latestStart - earliestStart (positive = flexible)
    - critical task: slack <= 0 when deadline is tight
    - identifies which tiles in a mixed set are critical vs flexible
```

---

### 9.3 `intelligentCompact.test.ts` — Main Algorithm

#### A. Single-Station Basic Reordering

```
describe('single station -- basic reordering')
  - two tiles: swaps to improve similarity
    Setup: station-1 (offset), tiles [T1: papier=Offset:170, T2: papier=Couche:135]
           anchor before them has papier=Couche:135
    Before: [T1, T2] -> similarity = 0 (anchor->T1 mismatch) + partial
    After:  [T2, T1] -> similarity = 1.0 (anchor->T2 match) + ...
    Assert: T2 now precedes T1, similarityAfter > similarityBefore

  - three tiles: groups matching specs together
    Setup: [A: papier=Couche, B: papier=Offset, C: papier=Couche]
    After:  [A, C, B] or [C, A, B] -- both Couche tiles adjacent
    Assert: similarity improved

  - already optimal order -> no changes (reorderedCount = 0)
    Setup: [A: papier=X, B: papier=X, C: papier=Y] -- already grouped
    Assert: sequence unchanged, reorderedCount = 0

  - five tiles with mixed specs -> optimal or near-optimal grouping
    Setup: [A:X, B:Y, C:X, D:Y, E:X]
    After:  X-group and Y-group clustered
    Assert: similarityAfter >= similarityBefore, no violations
```

#### B. Constraint Respect

```
describe('single station -- constraint respect')
  - does not reorder past deadline
    Setup: T1 (deadline tight, must go first), T2 (similar to anchor but flexible)
    Assert: T1 stays first despite lower similarity, no deadline violation

  - all tiles critical (slack = 0) -> preserves original order
    Setup: 3 tiles, all with workshopExitDate just barely reachable
    Assert: reorderedCount = 0, original sequence preserved

  - mixed critical + flexible -> critical placed at earliest, flexible reordered
    Setup: T1 (flexible, papier=A), T2 (critical, papier=B), T3 (flexible, papier=A)
    Assert: T2 placed in position that meets its deadline,
            T1 and T3 grouped by similarity around it

  - immobile (started) tiles are not moved
    Setup: T1 already started, T2 and T3 mobile
    Assert: T1 unchanged, T2/T3 may be reordered

  - segment boundaries respected: tiles don't leak past frozen tiles
    Setup: [FROZEN_A] [T1, T2] [FROZEN_B] [T3, T4]
    Assert: T1/T2 reordered within segment 1,
            T3/T4 reordered within segment 2,
            no tile crosses frozen boundary

  - respects intra-element precedence (sequenceOrder)
    Setup: T1 (seq=0) and T2 (seq=1) in same element, both on same station
    Assert: T1 always before T2, even if reversing would improve similarity
```

#### C. Printing & Dry Time

```
describe('single station -- printing dry time')
  - accounts for 240-min dry time between offset tiles
    Setup: offset press station with 3 tiles
    Assert: each tile starts >= 240 min after predecessor ends

  - dry time constraint limits reordering options
    Setup: tile A ends at 14:00, dry time to 18:00, station closes 22:00,
           tile B has deadline 19:00 -- B cannot follow A (would start 18:00, end 19:00)
    Assert: algorithm detects infeasibility and avoids placing B after A
```

#### D. Horizon

```
describe('horizon')
  - only reorders tiles within horizon (4h/8h/24h)
    Setup: 4 tiles, 2 within 4h horizon, 2 outside
    Assert: only first 2 may be reordered; last 2 unchanged

  - tiles outside horizon are not moved even if similarity would improve
```

#### E. Similarity Scoring

```
describe('similarity scoring')
  - returns correct similarityBefore and similarityAfter
    Setup: known suboptimal order
    Assert: similarityAfter > similarityBefore, exact values match manual calculation

  - station with no similarity criteria -> skip (no reordering)
    Setup: finishing station with empty similarityCriteria
    Assert: reorderedCount = 0 for that station

  - tiles with no ElementSpec -> similarity = 0 (treated as all-different)
    Setup: element without spec field
    Assert: no crash, treated as zero similarity

  - both specs undefined on a criterion -> matched (per BR-CATEGORY-003)
```

#### F. Safety Fallback

```
describe('safety fallback')
  - infeasible reordering -> returns original order
    Setup: all tiles have tight time windows such that only original order is feasible
    Assert: sequence unchanged, no violations

  - greedy finds no feasible candidate -> aborts to original
    Setup: artificially constrained windows where greedy can't place any tile
    Assert: original order preserved, no crash
```

---

### 9.4 Cross-Station Interactions (Multi-Column) -- CRITICAL SECTION

```
describe('cross-station interactions')
```

#### F1. Basic Cross-Station Precedence

```
  - reordering on station A shifts successor on station B forward
    Setup:
      Station A (offset): [T1(job1, papier=X), T2(job2, papier=Y)]
      Station B (finishing): [T3(job1, seq after T1), T4(job2, seq after T2)]
      T3 depends on T1 (same element), T4 depends on T2 (same element)
      Reordering A to [T2, T1] delays T1.end
    Assert: T3 on station B is pushed forward to respect T1's new end time
            T4 on station B may move earlier since T2 now finishes earlier
            No deadline violations on either station
```

#### F2. Three-Station Chain Cascade

```
  - cascade propagates through 3 stations: press -> finishing -> binding
    Setup:
      Station A (press):     [T_a1(job1), T_a2(job2)]
      Station B (finishing): [T_b1(job1, depends on T_a1), T_b2(job2, depends on T_a2)]
      Station C (binding):   [T_c1(job1, depends on T_b1), T_c2(job2, depends on T_b2)]
      Reordering on A swaps T_a1 and T_a2
    Assert: cascade propagates A->B->C
            T_b1 shifts because T_a1 moved later
            T_c1 shifts because T_b1 shifted
            All deadlines still met
            Algorithm converges in <= 3 iterations
```

#### F3. Diamond Dependency (Two Stations -> One)

```
  - diamond: two stations feed into one downstream station
    Setup:
      Job1 has elements: cover (press A), interior (press B), binding (station C)
      Binding element depends on BOTH cover and interior (prerequisiteElementIds)
      Press A: [T_cover1, T_cover2]  -- cover task for job1, job2
      Press B: [T_int1, T_int2]      -- interior task for job1, job2
      Station C: [T_bind1(depends on T_cover1 AND T_int1)]
    After reordering press A, T_cover1 moves later
    Assert: T_bind1.earliestStart = max(T_cover1.end, T_int1.end)
            If T_cover1 now ends after T_int1, T_bind1 is pushed by the cover
            No deadline violation
```

#### F4. Reordering Blocked by Downstream Deadline

```
  - reordering on A would cause deadline miss on B -> reordering limited
    Setup:
      Station A: [T1(job1, papier=X), T2(job2, papier=Y, very similar to anchor)]
      Station B: [T3(job1, depends on T1, tight deadline)]
      Swapping T1/T2 on A would delay T1.end, making T3 miss deadline
    Assert: T1 stays before T2 (or reordering reverts to original)
            T3 does NOT miss its deadline
    Verification: assertNoDeadlineViolations(result)
```

#### F5. Cross-Element Dependencies with Dry Time

```
  - dry time on press propagates correctly to successor on different station
    Setup:
      Station A (offset press): [T_print(job1)]
      Station B (finishing):    [T_finish(job1, depends on T_print via cross-element)]
      T_print ends at 14:00, dry time = 240 min -> T_finish earliest = 18:00
      Reordering on A delays T_print end by 1 hour (to 15:00)
    Assert: T_finish.earliestStart = 15:00 + 240 min = 19:00
            Station B operating hours respected (if B closes 22:00, still OK)
            Deadline not violated

  - dry time + operating hours gap: press ends Friday 18:00
    Setup:
      T_print ends Friday 18:00, dry time 240 min -> 22:00
      Station B opens Monday 06:00 (weekend)
    Assert: T_finish earliest = Monday 06:00
            Cross-station cascade correctly spans weekend gap
```

#### F6. Multiple Jobs Sharing Two Stations

```
  - interleaved jobs: 4 jobs sharing press and finishing
    Setup:
      Press (offset): [J1_press, J2_press, J3_press, J4_press]
        J1: papier=Couche:300, J2: papier=Offset:170,
        J3: papier=Couche:300, J4: papier=Offset:170
      Finishing: [J1_fin, J2_fin, J3_fin, J4_fin]
        Each depends on corresponding press task
      Deadlines: J1 tight, J2/J3/J4 relaxed
    After smart compact on press: groups Couche together, Offset together
    Assert: press order might be [J1, J3, J2, J4] (Couche first due to J1 deadline)
            finishing tiles cascade-adjusted accordingly
            J1 still meets tight deadline
            Similarity improved on press
```

#### F7. Reordering Two Stations Independently

```
  - reordering on station A does not interfere with independent station B
    Setup:
      Station A: 3 tiles from jobs 1-3
      Station B: 3 tiles from jobs 4-6 (no dependency with A)
    Assert: both stations reordered independently for similarity
            No cross-contamination between orderings
            movedCount reflects both stations

  - two stations with SAME jobs but no precedence between their tasks
    Setup:
      Job1 has element-cover on press A and element-interior on press B
      (no prerequisiteElementIds between them -- they're parallel elements)
    Assert: reordering on A does not affect B and vice versa
```

#### F8. Cascade Convergence

```
  - cascade repair converges in 1 iteration for linear chain
    Setup: A->B->C linear chain, reorder A
    Assert: single forward pass fixes B and C

  - cascade repair converges in 2 iterations for diamond
    Setup: A->C and B->C, reorder both A and B
    Assert: first pass fixes C from A's perspective,
            second pass adjusts C if B's effect is later
            Stable after 2 iterations

  - cascade repair does NOT loop infinitely
    Setup: complex 5-station graph
    Assert: terminates within max 3 iterations
```

#### F9. Station Processing Order

```
  - stations processed in topological order (upstream first)
    Setup:
      Station A (press, upstream) -> Station B (finishing, downstream)
      Reordering A is processed BEFORE B
    Assert: when B is reordered, it uses A's already-updated end times
            Result is same as if done sequentially

  - independent stations can be processed in any order (result is same)
    Setup: two unrelated stations
    Assert: order doesn't matter -- deterministic result
```

#### F10. Group Capacity Interactions

```
  - station in limited-capacity group -> reordering skipped
    Setup: group with maxConcurrent=2, station belongs to it
    Assert: reorderedCount = 0 for that station (only standard compact)

  - station in unlimited group -> reordering proceeds normally
    Setup: group with maxConcurrent=null
    Assert: reordering happens, similarity improved
```

#### F11. Mixed Immobile + Cross-Station

```
  - frozen tile on station A splits segment; successor on B adjusts per segment
    Setup:
      Station A: [FROZEN_1, T2(mobile, job-X), T3(mobile, job-Y)]
      Station B: [T4(depends on T2), T5(depends on T3)]
      Reordering swaps T2 and T3 within segment
    Assert: T4 and T5 on station B adjust to new end times of T3, T2
            Frozen tile on A unchanged
```

#### F12. Outsourced Task as Cross-Station Anchor

```
  - outsourced task between two internal tasks: departure/return respected
    Setup:
      Element: T1(press A) -> T2(outsourced, 3 business days) -> T3(finishing B)
      T3.earliest depends on T2.returnDate, which depends on T1.end
      Reordering on press A delays T1
    Assert: T2 departure shifts with T1
            T3 earliest shifts with T2 return
            No deadline violation

  - outsourced task with manualReturn acts as fixed anchor
    Setup: T2 (outsourced, manualReturn set) -> T3 (finishing)
    Assert: T3.earliest = manualReturn regardless of predecessor changes
```

#### F13. End-to-End Integration Scenario

```
  - realistic print shop: 3 presses, 2 finishing stations, 8 jobs
    Setup:
      Offset press 1: 12 tiles (3 Couche:300/A4, 4 Offset:170/70x100, 5 Couche:135/A3)
      Offset press 2: 8 tiles (mixed specs)
      Finishing 1: 10 tiles (depends on press outputs)
      Finishing 2: 6 tiles (depends on press outputs)
      Binding: 4 tiles (depends on finishing outputs)
      Jobs: 8 jobs with varying deadlines (2 tight, 6 relaxed)
    Assert:
      - similarityAfter > similarityBefore for press stations
      - assertNoDeadlineViolations(result)
      - assertNoStationConflicts(result)
      - assertNoPrecedenceViolations(result)
      - reorderedCount > 0 (some improvement found)
      - result.snapshot.assignments.length === original count (no tiles lost)
      - all tile durations preserved (no stretching/shrinking)
```

---

### 9.5 Invariant Checks (Applied to EVERY Test)

Every test should verify these invariants on the result:

```typescript
function assertInvariants(result: IntelligentCompactResult, original: ScheduleSnapshot) {
  // 1. No tiles lost or duplicated
  expect(result.snapshot.assignments.length).toBe(original.assignments.length);

  // 2. All tile durations preserved
  for (const a of result.snapshot.assignments) {
    const origA = original.assignments.find(o => o.id === a.id)!;
    const origDuration = new Date(origA.scheduledEnd).getTime()
                       - new Date(origA.scheduledStart).getTime();
    const newDuration = new Date(a.scheduledEnd).getTime()
                      - new Date(a.scheduledStart).getTime();
    expect(newDuration).toBe(origDuration);
  }

  // 3. No station double-bookings
  assertNoStationConflicts(result);

  // 4. No precedence violations
  assertNoPrecedenceViolations(result);

  // 5. No deadline violations
  assertNoDeadlineViolations(result);

  // 6. Immobile tiles unchanged
  const now = result.now ?? new Date();
  for (const a of original.assignments) {
    if (new Date(a.scheduledStart) < now) {
      const newA = result.snapshot.assignments.find(o => o.id === a.id)!;
      expect(newA.scheduledStart).toBe(a.scheduledStart);
      expect(newA.scheduledEnd).toBe(a.scheduledEnd);
    }
  }

  // 7. Similarity never decreased
  expect(result.similarityAfter).toBeGreaterThanOrEqual(result.similarityBefore);
}
```
