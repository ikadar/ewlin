# Smart Compaction V2 — Architecture Design

## 1. Problem Statement

**Given:** A schedule with N jobs placed across printing stations (offset, digital) and downstream stations (cutting, finishing, die-cutting), each station having similarity criteria for changeover optimization.

**Current behavior (V1):** Smart compaction runs entirely on the frontend, reordering tiles on every station independently using greedy nearest-neighbor. This misses global optimization opportunities and can't leverage server-side precedence validation.

**Goal (V2):** Move the algorithm to the PHP backend with SSE streaming. Optimize printing stations first (highest changeover cost) using cluster-based heuristics, then propagate downstream via precedence. Use smart heuristics instead of myopic greedy NN.

**Design principle:** Printing stations are the primary optimization target; downstream stations receive their work order from printing completion times. The backend owns the algorithm; the frontend consumes SSE events.

---

## 2. Architecture

```
Frontend (SmartCompactModal)     Backend (SmartCompactionService)
  ┌──────────────┐               ┌──────────────────────────┐
  │ Config view   │──POST SSE──▶ │ Phase 0: Analyze         │
  │ (horizon)     │               │ Phase 1: Cluster printing │
  │               │◀──events────  │ Phase 2: Propagate        │
  │ Running view  │               │ Phase 3: Print-free       │
  │ (phase log)   │               │ Phase 4: Validate         │
  │               │               │ Phase 5: Persist          │
  │ Complete view │               └──────────────────────────┘
  └──────────────┘
```

**Endpoint:** `POST /api/v1/schedule/smart-compact`
**Request:** `{ "horizonHours": 24 }`
**Response:** SSE stream (`text/event-stream`)

---

## 3. Station Classification

| Type | Criteria | Behavior |
|------|----------|----------|
| **Printing** | Category name contains `offset`, `numérique`, or `digital` | Cluster-first similarity reorder (Phase 1) |
| **Downstream** | Non-printing, but element chain has a printing task | Inherits order from printing via precedence propagation (Phase 2) |
| **Print-free** | Non-printing, element chain has zero printing tasks | Independent cluster-first reorder (Phase 3) |

`isOptimizableStation()` (offset + digital) is separate from `isPrintingStation()` (offset-only for drying time).

---

## 4. Algorithm — Cluster-First with Urgency Weighting

### Why not greedy nearest-neighbor?

Greedy NN picks the most similar **next** tile myopically. It can produce suboptimal global sequences — e.g., picking a slightly similar tile now may prevent a perfect similarity run later. It also doesn't consider deadline urgency.

### Cluster-First approach

For each printing station:

1. **Group tiles by primary criterion** (first `similarityCriterion.fieldPath`, typically `papier` for offset)
2. **Order clusters by urgency** — cluster whose earliest `workshopExitDate` is soonest goes first
3. **Anchor awareness** — first cluster maximizes similarity with last immobile tile
4. **Within each cluster** — greedy NN by remaining criteria (format, impression) for fine-grained ordering
5. **Respect intra-element ordering** — tiles from same element preserve `sequenceOrder`

This produces runs of identical paper → same format → same impression, ordered by urgency across runs.

### Phase Flow

```
Phase 0 — Analyze:
  Build PlacementContext (stations, assignments, element tasks, printing flags)
  Partition assignments: immobile (start < now) / movable (within horizon) / frozen
  Classify stations: printing / downstream / print-free

Phase 1 — Cluster & reorder printing stations:
  For each printing station with ≥2 movable tiles:
    Build clusters by primary criterion
    Order clusters by urgency (earliest deadline) with anchor-awareness
    Within clusters: greedy NN by secondary criteria
    Record reordered assignment list

Phase 2 — Propagate via compaction:
  Apply synthetic start times to reordered printing tiles
  Re-compact ALL stations ASAP:
    earliestStart = max(prevTileEnd, precedenceFloor, now)
    Snap to working time → calculate end time
  Downstream tiles naturally reorder via predecessor end times

Phase 3 — Print-free reorder:
  Same cluster-first algorithm for tiles with no printing dependency
  Re-compact affected stations

Phase 4 — Deadline validation:
  For each moved job: compare completion time before vs after
  If on-time → late: rollback to original positions
  Re-compact after rollbacks

Phase 5 — Persist:
  Schedule entity updated with new assignment times
  Single EntityManager flush
```

---

## 5. Progress Events (SSE)

```json
{"type":"progress","phase":"analyze","stepsCompleted":1,"message":"Analyzing schedule"}
{"type":"progress","phase":"reorder_printing","stationName":"Offset Press 1","stationIndex":0,"totalStations":3,"stepsCompleted":2}
{"type":"progress","phase":"propagate","stepsCompleted":5,"message":"Propagating to downstream stations"}
{"type":"progress","phase":"reorder_printfree","stationName":"Massicot 1","stationIndex":0,"totalStations":1,"stepsCompleted":6}
{"type":"progress","phase":"validate","stepsCompleted":7,"message":"Validating constraints"}
{"type":"complete","phase":"complete","result":{"movedCount":34,"reorderedCount":12,"similarityBefore":3,"similarityAfter":9,"rollbackCount":0,"printingStationsOptimized":2,"downstreamStationsPropagated":3,"printfreeStationsReordered":1,"computeMs":450}}
```

---

## 6. Hard Constraints (inviolable)

1. **No precedence violations** — intra-element sequence, cross-element prerequisites, drying time (240 min after offset)
2. **No deadline degradation** — if a job was on-time before compaction, it must remain on-time after (rollback otherwise)
3. **No past placement** — immobile tasks (`scheduledStart < now`) are never moved
4. **Frozen boundary** — tasks beyond the horizon are untouched
5. **Station assignment unchanged** — tiles stay on their current station

---

## 7. Key Reuse

| Need | Existing code | File |
|------|--------------|------|
| Precedence floor/ceiling | `SchedulingHelper::getPrecedenceFloor()` | `SchedulingHelper.php` |
| Working-time snapping | `SchedulingHelper::snapToNextWorkingTime()` | `SchedulingHelper.php` |
| End time calculation | `EndTimeCalculator::calculateForInternalTask()` | `EndTimeCalculator.php` |
| Printing station check | `SchedulingHelper::isPrintingStation()` | `SchedulingHelper.php` |
| PlacementContext | `PlacementContext` VO | `PlacementContext.php` |
| SSE streaming | `autoPlaceAll()` controller pattern | `ScheduleController.php` |

---

## 8. File Map

| File | Role |
|------|------|
| `services/php-api/src/Service/SmartCompactionService.php` | Core algorithm — phases 0–5 |
| `services/php-api/src/ValueObject/SmartCompactProgress.php` | SSE progress event VO |
| `services/php-api/src/ValueObject/SmartCompactResult.php` | Final result VO |
| `services/php-api/src/Service/SchedulingHelper.php` | Shared scheduling utilities (+ `isOptimizableStation()`) |
| `services/php-api/src/Controller/Api/V1/ScheduleController.php` | `POST /smart-compact` SSE endpoint |
| `services/php-api/tests/Unit/Service/SmartCompactionServiceTest.php` | Backend unit tests |
| `apps/web/src/components/SmartCompactModal.tsx` | Frontend — consumes SSE, displays progress |
