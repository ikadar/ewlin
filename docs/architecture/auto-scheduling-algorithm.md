# Auto-Scheduling Algorithm — Implementation Specification

## Purpose

This document specifies the multi-job automated scheduling algorithm for the Flux Print Shop Scheduling System. It is written as a step-by-step implementation guide that can be followed literally.

---

## Prerequisites & Existing Primitives

The following already exist in the codebase and MUST be reused — not reimplemented:

| Primitive | Location | What it does |
|-----------|----------|--------------|
| `getPredecessorConstraint()` | `apps/web/src/utils/precedenceConstraints.ts` | Computes **earliest valid start** for a task (respects intra-element sequence, cross-element dependencies, 4h dry time after offset printing, working hours). This is our **ASAP**. |
| `getSuccessorConstraint()` | same file | Computes **latest valid start** for a task (before successor would be violated). This is our **ALAP**. |
| `validateAssignment(proposed, snapshot)` | `@flux/schedule-validator` | Full constraint validation returning `ValidationResult` with typed conflicts. |
| `calculateEndTime(task, start, station)` | `apps/web/src/utils/timeCalculations.ts` | Computes `scheduledEnd` from `scheduledStart` + task duration, stretching across non-operating periods. |
| `snapToNextWorkingTime(time, station)` | `apps/web/src/utils/workingTime.ts` | Snaps a timestamp to the next valid operating slot for a station. |
| `applyPushDown()` | `apps/web/src/utils/pushDown.ts` | Resolves overlaps on capacity-1 stations by cascading shifts. |
| `compactTimeline()` | `apps/web/src/utils/compactTimeline.ts` | Removes gaps on stations while respecting precedence. |

### Domain Model Recap

```
Job
  ├── workshopExitDate        (deadline)
  ├── Element[]
  │     ├── prerequisiteElementIds[]   (cross-element finish-to-start deps)
  │     └── Task[]                     (ordered by sequenceOrder)
  │           ├── type: 'Internal' | 'Outsourced'
  │           ├── stationId            (target machine — CURRENTLY single, see §8)
  │           └── duration: { setupMinutes, runMinutes }
  │
TaskAssignment
  ├── taskId, targetId (stationId)
  ├── scheduledStart, scheduledEnd   (ISO 8601)
  └── isCompleted

Station
  ├── groupId, categoryId
  ├── capacity (typically 1)
  └── operatingSchedule + exceptions

StationGroup
  └── maxConcurrent
```

---

## Part 1 — Core Concepts

### 1.1 Freedom Interval

For any unplaced task `T` assigned to station `S`, given the current partial schedule:

```
freedomInterval(T) = {
  earliest: ASAP(T)    // getPredecessorConstraint → time
  latest:   ALAP(T)    // getSuccessorConstraint → time
}
```

- If `earliest > latest` → the task is **infeasible** under current placements.
- `width = latest - earliest` (in working minutes on station S).
- Narrow width = rigid task. Wide width = flexible task.

### 1.2 Critical Ratio (CR)

```
CR(T) = availableWorkingTime(ASAP(T), job.workshopExitDate, station)
        / totalMinutes(T.duration)
```

Where `totalMinutes = setupMinutes + runMinutes`.

- `CR < 1.0` → task cannot finish by deadline even starting ASAP. Critical.
- `CR = 1.0` → exactly on the edge.
- `CR > 1.0` → has slack. The higher, the more flexible.

CR is better than raw freedom interval width because it normalizes by workload.

### 1.3 Escalation Level

Every placement attempt has a level (0 = ideal, 6 = infeasible):

| Level | Strategy | Cost | When |
|-------|----------|------|------|
| 0 | ALAP on assigned station | None | Default — just-in-time |
| 1 | ALAP on alternative station | Machine change | Assigned station too loaded |
| 2 | ASAP on any eligible station | Early WIP | No ALAP slot anywhere |
| 3 | Split across time (same station) | Extra setup/makeready | No single contiguous slot |
| 4 | Split across stations | Setup + color risk | No single station has room |
| 5 | Parallel split (simultaneous) | Max setup cost | Urgent, need fastest completion |
| 6 | Infeasible | — | Escalate to planner |

**Rule: The scheduler MUST exhaust level N before trying level N+1.**

---

## Part 2 — Algorithm: Single Job Placement

This places all tasks of ONE job, respecting internal element order.

### Input
- `job: Job` with its `elements[]` and their `tasks[]`
- `snapshot: ScheduleSnapshot` (current state of all assignments)
- `maxLevel: EscalationLevel` (policy limit, default = 2 in early rounds)

### Output
- `PlacementResult { assignments: ProposedAssignment[], level: EscalationLevel, cost: number }`
- or `InfeasibleResult { reason, diagnostics }`

### Steps

```
PLACE_SINGLE_JOB(job, snapshot, maxLevel):

    // Step 1: Determine task ordering.
    // Use BACKWARD scheduling: place last tasks first, working toward the start.
    // This is the existing workflow — it ensures deadline compliance.

    taskQueue = []
    for each element in job.elements (sorted by dependency depth, deepest first):
        for each task in element.tasks (sorted by sequenceOrder DESCENDING):
            if task.type == 'Internal' AND not assigned:
                taskQueue.push(task)

    // taskQueue is now ordered: last task of deepest element first.

    placedAssignments = []
    maxLevelUsed = 0

    // Step 2: Place each task using escalation ladder.
    for each task in taskQueue:
        result = PLACE_SINGLE_TASK(task, job, snapshot, maxLevel)

        if result.infeasible:
            return InfeasibleResult for this job

        // Apply the placement to the working snapshot
        snapshot = snapshot.withAssignment(result.assignment)
        placedAssignments.push(result.assignment)
        maxLevelUsed = max(maxLevelUsed, result.level)

    // Step 3: Validate the complete set of new assignments.
    for each assignment in placedAssignments:
        validation = validateAssignment(assignment, snapshot)
        if validation.hasBlockingConflicts:
            // Something went wrong — should not happen if escalation worked.
            return InfeasibleResult with validation.conflicts

    return PlacementResult {
        assignments: placedAssignments,
        level: maxLevelUsed,
        cost: sum of escalation costs
    }
```

### PLACE_SINGLE_TASK (the escalation ladder)

```
PLACE_SINGLE_TASK(task, job, snapshot, maxLevel):

    station = getStation(task.stationId)  // the task's assigned station

    // ── Level 0: ALAP on assigned station ──
    latestStart = computeALAP(task, snapshot, station)
    if latestStart != null:
        end = calculateEndTime(task, latestStart, station)
        proposed = { taskId: task.id, targetId: station.id,
                     scheduledStart: latestStart, scheduledEnd: end }
        validation = validateAssignment(proposed, snapshot)
        if not validation.hasBlockingConflicts:
            return { assignment: proposed, level: 0, cost: 0 }

    if maxLevel < 1: return infeasible

    // ── Level 1: ALAP on alternative station ──
    // (Only available when task has alternativeStationIds — see §8)
    for altStation in task.alternativeStationIds ?? []:
        altDuration = task.alternativeDurations[altStation.id]
        latestStart = computeALAP(task, snapshot, altStation, altDuration)
        if latestStart != null:
            end = calculateEndTime(taskWithDuration(altDuration), latestStart, altStation)
            proposed = { taskId: task.id, targetId: altStation.id,
                         scheduledStart: latestStart, scheduledEnd: end }
            validation = validateAssignment(proposed, snapshot)
            if not validation.hasBlockingConflicts:
                return { assignment: proposed, level: 1, cost: MACHINE_CHANGE_COST }

    if maxLevel < 2: return infeasible

    // ── Level 2: ASAP on any eligible station ──
    allStations = [station, ...(task.alternativeStationIds ?? [])]
    for s in allStations (sorted by current load ascending):
        dur = getDurationForStation(task, s)
        earliestStart = computeASAP(task, snapshot, s, dur)
        if earliestStart != null:
            end = calculateEndTime(taskWithDuration(dur), earliestStart, s)
            // Check deadline
            if end <= job.workshopExitDate:
                proposed = { taskId: task.id, targetId: s.id,
                             scheduledStart: earliestStart, scheduledEnd: end }
                validation = validateAssignment(proposed, snapshot)
                if not validation.hasBlockingConflicts:
                    return { assignment: proposed, level: 2, cost: EARLY_WIP_COST }

    if maxLevel < 3: return infeasible

    // ── Level 3: Split on single station ──
    // See §7 for splitting algorithm.
    splitResult = SPLIT_ON_STATION(task, station, snapshot, job.workshopExitDate)
    if splitResult.feasible:
        return { assignments: splitResult.pieces, level: 3,
                 cost: splitResult.pieces.length * SETUP_COST }

    if maxLevel < 4: return infeasible

    // ── Level 4: Split across stations ──
    splitResult = SPLIT_CROSS_STATION(task, allStations, snapshot, job.workshopExitDate)
    if splitResult.feasible:
        return { assignments: splitResult.pieces, level: 4,
                 cost: splitResult.pieces.length * SETUP_COST + COLOR_RISK_COST }

    if maxLevel < 5: return infeasible

    // ── Level 5: Parallel split ──
    splitResult = SPLIT_PARALLEL(task, allStations, snapshot, job.workshopExitDate)
    if splitResult.feasible:
        return { assignments: splitResult.pieces, level: 5,
                 cost: PARALLEL_SPLIT_COST }

    // ── Level 6: Infeasible ──
    return infeasible with diagnostics: {
        task,
        asapOnAllStations: [...],
        alapOnAllStations: [...],
        bottleneckResource: identifyBottleneck(allStations, snapshot)
    }
```

---

## Part 3 — Algorithm: Multi-Job Scheduling (FBI + CR)

This is the main entry point. It schedules multiple jobs concurrently.

### Input
- `jobs: Job[]` — all jobs to schedule
- `snapshot: ScheduleSnapshot` — current state (may contain already-assigned tasks)
- `policy: SchedulingPolicy` — per-job escalation limits and preferences

### Output
- `ScheduleResult { assignments[], qualityReport }`

### Steps

```
AUTO_SCHEDULE(jobs, snapshot, policy):

    // ════════════════════════════════════════════════
    // ROUND 1: FBI at Level 0 (preferred station, ALAP only)
    // ════════════════════════════════════════════════

    result = FBI_LOOP(jobs, snapshot, maxLevel: 0)

    if result.allPlaced:
        return result   // Clean schedule. No concessions needed.

    // ════════════════════════════════════════════════
    // ROUND 2: FBI at Level 0–1 (allow alternative stations)
    // ════════════════════════════════════════════════

    result = FBI_LOOP(jobs, snapshot, maxLevel: 1)

    if result.allPlaced:
        return result

    // ════════════════════════════════════════════════
    // ROUND 3: FBI at Level 0–2 (allow ASAP placement)
    // ════════════════════════════════════════════════

    result = FBI_LOOP(jobs, snapshot, maxLevel: 2)

    if result.allPlaced:
        return result

    // ════════════════════════════════════════════════
    // ROUND 4: Split unplaced tasks, then re-run FBI
    // ════════════════════════════════════════════════

    unplacedTasks = result.getUnplacedTasks()

    for each task in unplacedTasks:
        jobPolicy = policy.forJob(task.jobId)
        if jobPolicy.maxLevel < 3:
            continue  // This job forbids splitting (e.g., color-critical)

        pieces = SPLIT_TASK(task, result.snapshot, jobPolicy.maxLevel)
        if pieces:
            jobs = jobs.withTaskReplacedByPieces(task, pieces)

    result = FBI_LOOP(jobs, snapshot, maxLevel: 2)

    // ════════════════════════════════════════════════
    // ROUND 5: Report infeasibles
    // ════════════════════════════════════════════════

    stillUnplaced = result.getUnplacedTasks()

    return ScheduleResult {
        assignments: result.assignments,
        qualityReport: buildQualityReport(result),
        infeasibles: stillUnplaced.map(t => buildDiagnostics(t))
    }
```

---

## Part 4 — FBI Loop (Forward-Backward Improvement)

The core scheduling loop. Alternates between ASAP (forward) and ALAP (backward) passes.

### Input
- `jobs: Job[]`, `snapshot: ScheduleSnapshot`, `maxLevel: EscalationLevel`

### Output
- `FBIResult { assignments[], allPlaced, unplaced[], snapshot }`

### Steps

```
FBI_LOOP(jobs, snapshot, maxLevel):

    MAX_ITERATIONS = 6
    previousMakespan = Infinity

    for iteration = 1 to MAX_ITERATIONS:

        // ── FORWARD PASS (ASAP) ──────────────────────
        // Place all tasks as early as possible.
        // Ordering: lowest CR first (most urgent jobs first).

        workingSnapshot = snapshot.clone()  // start fresh each iteration

        allTasks = flattenAndSortByCR(jobs, workingSnapshot)
        // flattenAndSortByCR:
        //   1. Collect all unassigned internal tasks across all jobs
        //   2. For each task, compute CR(task) using current workingSnapshot
        //   3. Sort ascending by CR (lowest = most critical = placed first)
        //   4. Tiebreak: earlier job.workshopExitDate wins

        forwardAssignments = []

        for each task in allTasks:
            station = getStation(task.stationId)

            // Try ASAP on assigned station first
            earliestStart = computeASAP(task, workingSnapshot, station)

            if earliestStart == null AND maxLevel >= 1:
                // Try alternative stations
                for altStation in task.alternativeStationIds ?? []:
                    earliestStart = computeASAP(task, workingSnapshot, altStation)
                    if earliestStart != null:
                        station = altStation
                        break

            if earliestStart == null:
                continue  // skip, will be reported as unplaced

            end = calculateEndTime(task, earliestStart, station)
            assignment = { taskId: task.id, targetId: station.id,
                           scheduledStart: earliestStart, scheduledEnd: end }

            workingSnapshot = workingSnapshot.withAssignment(assignment)
            forwardAssignments.push(assignment)

        makespan = max(forwardAssignments.map(a => a.scheduledEnd))

        // ── BACKWARD PASS (ALAP) ─────────────────────
        // Within the makespan envelope from the forward pass,
        // shift everything as late as possible.

        workingSnapshot = snapshot.clone()  // start fresh again

        // Reverse order: least critical first → most critical last
        // (most critical tasks get the "final say" on positioning)
        reversedTasks = allTasks.reverse()

        backwardAssignments = []

        for each task in reversedTasks:
            station = getStation(task.stationId)

            // ALAP within the makespan envelope
            latestStart = computeALAP(task, workingSnapshot, station, deadline: makespan)

            if latestStart == null AND maxLevel >= 1:
                for altStation in task.alternativeStationIds ?? []:
                    latestStart = computeALAP(task, workingSnapshot, altStation,
                                              deadline: makespan)
                    if latestStart != null:
                        station = altStation
                        break

            if latestStart == null AND maxLevel >= 2:
                // Fall back to ASAP
                latestStart = computeASAP(task, workingSnapshot, station)

            if latestStart == null:
                continue  // unplaced

            end = calculateEndTime(task, latestStart, station)
            assignment = { taskId: task.id, targetId: station.id,
                           scheduledStart: latestStart, scheduledEnd: end }

            workingSnapshot = workingSnapshot.withAssignment(assignment)
            backwardAssignments.push(assignment)

        newMakespan = max(backwardAssignments.map(a => a.scheduledEnd))

        // ── CONVERGENCE CHECK ─────────────────────────

        if |newMakespan - previousMakespan| < 30 minutes:
            // Stable. Use backward pass result (ALAP = JIT preference).
            return FBIResult {
                assignments: backwardAssignments,
                allPlaced: backwardAssignments.length == allTasks.length,
                unplaced: allTasks.filter(t => not in backwardAssignments),
                snapshot: workingSnapshot
            }

        previousMakespan = newMakespan

        // ── DAMPENING ─────────────────────────────────
        // Lock tasks that had the same station in both passes.
        // This prevents oscillation.
        for each task in allTasks:
            fwd = forwardAssignments.find(a => a.taskId == task.id)
            bwd = backwardAssignments.find(a => a.taskId == task.id)
            if fwd AND bwd AND fwd.targetId == bwd.targetId:
                task._lockedStation = fwd.targetId  // prefer this in next iteration

    // Max iterations reached. Return best result (backward pass).
    return FBIResult { ... }
```

---

## Part 5 — computeASAP and computeALAP

These wrap the existing primitives to return **timestamps** (not Y-positions).

### computeASAP

```
computeASAP(task, snapshot, station, duration?):

    // Step 1: Get precedence-based earliest start.
    // Reuse getPredecessorConstraint() logic:
    //   - Find the latest scheduledEnd among all predecessors
    //     (intra-element: previous task by sequenceOrder)
    //     (cross-element: last task of each prerequisiteElementId)
    //   - Add 4h dry time if predecessor is on an offset printing station
    //   - snapToNextWorkingTime() on target station

    predecessorEnd = getLatestPredecessorEnd(task, snapshot)

    if predecessorEnd != null:
        dryTime = isDryTimeRequired(task, snapshot) ? 4 hours : 0
        earliest = snapToNextWorkingTime(predecessorEnd + dryTime, station)
    else:
        earliest = snapToNextWorkingTime(now(), station)

    // Step 2: Check that the task fits on this station starting at `earliest`.
    // Walk forward through station's timeline to find first slot where:
    //   - No existing assignment overlaps (or push-down is acceptable)
    //   - Group capacity not exceeded
    //   - Task finishes by job deadline

    dur = duration ?? { setupMinutes: task.duration.setupMinutes,
                        runMinutes: task.duration.runMinutes }

    candidateStart = earliest

    while candidateStart < job.workshopExitDate:
        candidateEnd = calculateEndTime(taskWithDuration(dur), candidateStart, station)

        if candidateEnd > job.workshopExitDate:
            return null  // can't meet deadline from here

        proposed = { taskId: task.id, targetId: station.id,
                     scheduledStart: candidateStart, scheduledEnd: candidateEnd }
        validation = validateAssignment(proposed, snapshot)

        if not validation.hasBlockingConflicts:
            return candidateStart  // found valid ASAP position

        if validation.hasConflict('StationConflict'):
            // Jump past the blocking assignment
            blocker = getBlockingAssignment(station, candidateStart, candidateEnd, snapshot)
            candidateStart = snapToNextWorkingTime(blocker.scheduledEnd, station)
            continue

        if validation.hasConflict('GroupCapacityConflict'):
            // Jump past the group capacity violation window
            capacityFreeAt = getNextGroupCapacityOpening(station.groupId,
                                                         candidateStart, snapshot)
            candidateStart = snapToNextWorkingTime(capacityFreeAt, station)
            continue

        // Other blocking conflict (shouldn't happen for valid input)
        return null

    return null  // no valid slot before deadline
```

### computeALAP

```
computeALAP(task, snapshot, station, duration?, deadline?):

    // Step 1: Get successor-based latest end.
    // Reuse getSuccessorConstraint() logic:
    //   - Find the earliest scheduledStart among all successors
    //   - Subtract dry time if this task is on offset printing station
    //   - This gives the latest end time for this task

    effectiveDeadline = deadline ?? job.workshopExitDate

    successorStart = getEarliestSuccessorStart(task, snapshot)
    if successorStart != null:
        dryTime = isDryTimeRequired(successor, snapshot) ? 4 hours : 0
        latestEnd = successorStart - dryTime
    else:
        latestEnd = effectiveDeadline

    // Step 2: From latestEnd, subtract task duration backward through working time.
    dur = duration ?? task.duration
    totalMinutes = dur.setupMinutes + dur.runMinutes
    latestStart = subtractWorkingTime(latestEnd, totalMinutes, station)

    // Step 3: Walk backward to find valid slot.
    candidateStart = latestStart

    while candidateStart >= computeASAP(task, snapshot, station, duration):
        candidateEnd = calculateEndTime(taskWithDuration(dur), candidateStart, station)

        proposed = { taskId: task.id, targetId: station.id,
                     scheduledStart: candidateStart, scheduledEnd: candidateEnd }
        validation = validateAssignment(proposed, snapshot)

        if not validation.hasBlockingConflicts:
            return candidateStart  // found valid ALAP position

        if validation.hasConflict('StationConflict'):
            // Jump before the blocking assignment
            blocker = getBlockingAssignment(station, candidateStart, candidateEnd, snapshot)
            candidateEnd = blocker.scheduledStart
            candidateStart = subtractWorkingTime(candidateEnd, totalMinutes, station)
            continue

        if validation.hasConflict('GroupCapacityConflict'):
            capacityFreeAt = getPreviousGroupCapacityOpening(station.groupId,
                                                              candidateStart, snapshot)
            candidateStart = subtractWorkingTime(capacityFreeAt, totalMinutes, station)
            continue

        return null

    return null  // no valid ALAP slot
```

---

## Part 6 — CR Computation

```
computeCR(task, snapshot, station?):

    s = station ?? getStation(task.stationId)
    job = getJob(task)

    // Earliest this task can start
    earliest = computeASAP(task, snapshot, s)
    if earliest == null:
        return 0  // completely blocked → maximally critical

    // Available working time between earliest start and deadline
    available = countWorkingMinutes(earliest, job.workshopExitDate, s)

    // Work required
    required = task.duration.setupMinutes + task.duration.runMinutes

    return available / required
```

For **job-level CR** (used in multi-job ordering):

```
computeJobCR(job, snapshot):

    // Sum of remaining work across all unassigned tasks
    totalWork = sum(
        job.elements
            .flatMap(e => e.tasks)
            .filter(t => t.type == 'Internal' AND not assigned)
            .map(t => t.duration.setupMinutes + t.duration.runMinutes)
    )

    // Available time = from now to deadline, on the most constrained station
    // Simplified: use earliest ASAP across all remaining tasks
    earliestASAP = min(
        job.unassignedTasks.map(t => computeASAP(t, snapshot, getStation(t.stationId)))
    )

    available = countWorkingMinutes(earliestASAP, job.workshopExitDate,
                                    getMostConstrainedStation(job))

    return available / totalWork
```

---

## Part 7 — Task Splitting

Splitting is a **rescue strategy**, only used at escalation Level 3+.

### 7.1 When to Split

A task needs splitting when:
1. `computeASAP(task) != null` (task CAN start somewhere)
2. But no single contiguous slot exists between ASAP and the deadline
3. The total available gap time on the station ≥ task duration

### 7.2 Gap Analysis

```
FIND_GAPS(station, earliest, deadline, snapshot):

    // Get all existing assignments on this station in [earliest, deadline]
    assignments = snapshot.getAssignmentsForStation(station.id)
        .filter(a => a.scheduledEnd > earliest AND a.scheduledStart < deadline)
        .sortBy(a => a.scheduledStart)

    gaps = []
    cursor = earliest

    for each assignment in assignments:
        gapStart = snapToNextWorkingTime(cursor, station)
        gapEnd = assignment.scheduledStart
        gapMinutes = countWorkingMinutes(gapStart, gapEnd, station)

        if gapMinutes > 0:
            gaps.push({ start: gapStart, end: gapEnd, minutes: gapMinutes })

        cursor = assignment.scheduledEnd

    // Final gap after last assignment
    gapStart = snapToNextWorkingTime(cursor, station)
    gapMinutes = countWorkingMinutes(gapStart, deadline, station)
    if gapMinutes > 0:
        gaps.push({ start: gapStart, end: deadline, minutes: gapMinutes })

    return gaps
```

### 7.3 Split on Single Station (Level 3)

```
SPLIT_ON_STATION(task, station, snapshot, deadline):

    MIN_RUN_MINUTES = 60   // Below this, setup waste dominates. Configurable.
    SETUP_PER_PIECE = task.duration.setupMinutes  // each piece needs full setup

    earliest = computeASAP(task, snapshot, station)
    if earliest == null: return infeasible

    gaps = FIND_GAPS(station, earliest, deadline, snapshot)

    // Filter gaps too small for even minimum piece
    usableGaps = gaps.filter(g => g.minutes >= MIN_RUN_MINUTES + SETUP_PER_PIECE)

    // Total usable time (accounting for setup per piece)
    // Each piece costs one full setup. So N pieces cost N * setup.
    // Total run time needed = task.duration.runMinutes
    // We need: sum(gap_i - setup) >= runMinutes, for the gaps we use

    remainingRun = task.duration.runMinutes
    pieces = []

    // Greedy: use largest gaps first to minimize number of pieces
    for gap in usableGaps.sortBy(g => g.minutes, descending):
        if remainingRun <= 0: break

        availableRun = gap.minutes - SETUP_PER_PIECE
        pieceRun = min(remainingRun, availableRun)

        if pieceRun < MIN_RUN_MINUTES AND remainingRun > MIN_RUN_MINUTES:
            continue  // skip too-small gap unless it's the last piece

        pieces.push({
            parentTaskId: task.id,
            stationId: station.id,
            duration: { setupMinutes: SETUP_PER_PIECE, runMinutes: pieceRun },
            scheduledStart: gap.start,
            pieceIndex: pieces.length,
            // Precedence: piece N+1 must start after piece N ends
        })

        remainingRun -= pieceRun

    if remainingRun > 0:
        return infeasible  // not enough gap space

    // Compute scheduledEnd for each piece
    for each piece in pieces:
        piece.scheduledEnd = calculateEndTime(piece, piece.scheduledStart, station)

    return { feasible: true, pieces }
```

### 7.4 Split Across Stations (Level 4)

Same as 7.3 but collects gaps from ALL eligible stations and fills across them.

```
SPLIT_CROSS_STATION(task, stations, snapshot, deadline):

    allGaps = []
    for station in stations:
        gaps = FIND_GAPS(station, computeASAP(task, snapshot, station),
                         deadline, snapshot)
        for gap in gaps:
            allGaps.push({ ...gap, stationId: station.id })

    // Sort by size descending, fill greedily
    // Same algorithm as SPLIT_ON_STATION but across allGaps
    // Each piece records its stationId
    ...
```

### 7.5 Parallel Split (Level 5)

Unlike Level 3-4 which are sequential pieces, Level 5 runs pieces **simultaneously** on multiple stations. No precedence between pieces.

```
SPLIT_PARALLEL(task, stations, snapshot, deadline):

    // Divide quantity proportionally to available time on each station
    // All pieces start ASAP and run concurrently
    // Total output = sum of piece quantities = job quantity
    ...
```

### 7.6 Split Constraints

When a task is split into pieces:
- **Sequential split (Level 3-4):** Piece N+1 has a precedence dependency on Piece N (finish-to-start). The original task's predecessors apply to Piece 1. The original task's successors depend on the LAST piece.
- **Parallel split (Level 5):** No inter-piece precedence. The original task's successors depend on ALL pieces completing (join constraint).

---

## Part 8 — Machine Alternatives Data Model Extension

Currently, `InternalTask.stationId` is a single value. To support alternatives:

### Option A: Extend the Task model (recommended)

```typescript
interface InternalTask {
    // ... existing fields ...
    stationId: string;                    // preferred station (unchanged)
    alternativeStations?: {               // NEW
        stationId: string;
        durationOverride?: {              // different speed on this machine
            setupMinutes: number;
            runMinutes: number;
        };
    }[];
}
```

If `durationOverride` is null, use the task's default duration. The preferred station is always tried first (Level 0). Alternatives are tried at Level 1+.

### Option B: Station equivalence via StationCategory

Stations in the same category are considered alternatives. Duration is scaled by a station speed factor. This requires no Task model change but is less flexible.

**Recommendation: Option A.** It gives per-task control over which alternatives are valid and at what speed. A finishing task might run on two cutters but not on a folder, even if they're in the same category.

---

## Part 9 — Scheduling Policy (Per-Job Configuration)

```typescript
interface SchedulingPolicy {
    defaultMaxLevel: EscalationLevel;     // default: 2

    jobOverrides?: {
        [jobId: string]: {
            maxLevel: EscalationLevel;    // e.g., 1 for color-critical jobs
            preferredPlacement: 'ALAP' | 'ASAP';  // override JIT default
            allowParallelSplit: boolean;  // default: false
            splitMinRunMinutes?: number;  // override global minimum
        };
    };
}
```

Examples:
- Premium brand job: `maxLevel: 1` (never split, allow alt station at most)
- Internal test prints: `maxLevel: 5` (split freely, parallelize, anything goes)
- Rush job: `preferredPlacement: 'ASAP'` (override JIT, place earliest possible)

---

## Part 10 — Quality Report

After scheduling completes, generate a report:

```typescript
interface ScheduleQualityReport {
    totalTasks: number;
    placed: number;
    infeasible: number;

    byLevel: {
        level0_alapPreferred: number;    // ideal
        level1_alternativeStation: number;
        level2_asapFallback: number;
        level3_splitSameStation: number;
        level4_splitCrossStation: number;
        level5_parallelSplit: number;
    };

    totalSetupCostMinutes: number;       // extra setup from splitting
    averageCR: number;                   // schedule tightness
    bottleneckStation: {                 // most loaded station
        stationId: string;
        utilization: number;             // 0.0 – 1.0
    };

    // Per-job diagnostics
    jobs: {
        jobId: string;
        maxLevelUsed: EscalationLevel;
        allTasksPlaced: boolean;
        cr: number;
        infeasibleTasks?: {
            taskId: string;
            reason: string;
            suggestion: string;          // e.g., "Extend deadline by 4h"
                                         //       "Free 2h on Press KBA 106"
        }[];
    }[];
}
```

---

## Part 11 — Integration Points

### 11.1 Where This Lives

```
apps/web/src/
  utils/
    autoScheduler/
      index.ts              — AUTO_SCHEDULE entry point
      fbiLoop.ts            — FBI_LOOP
      computeASAP.ts        — computeASAP (wraps getPredecessorConstraint)
      computeALAP.ts        — computeALAP (wraps getSuccessorConstraint)
      computeCR.ts          — CR calculation
      placeSingleJob.ts     — PLACE_SINGLE_JOB + escalation ladder
      taskSplitter.ts       — FIND_GAPS, SPLIT_ON_STATION, etc.
      qualityReport.ts      — buildQualityReport
      types.ts              — PlacementResult, FBIResult, SchedulingPolicy, etc.
```

### 11.2 API Surface

The auto-scheduler is a **pure function**:

```typescript
function autoSchedule(
    jobs: Job[],
    snapshot: ScheduleSnapshot,
    policy: SchedulingPolicy
): ScheduleResult
```

It returns `ProposedAssignment[]`. The caller decides whether to:
1. Show them as a preview (dry run)
2. Apply them via the existing `POST /tasks/{taskId}/assign` API
3. Let the planner review and cherry-pick assignments

### 11.3 UI Integration

- **Trigger:** Button "Auto-schedule selected jobs" or "Auto-schedule all unplanned"
- **Preview:** Show proposed assignments as ghost tiles on the grid, color-coded by escalation level
- **Confirm:** Planner approves → assignments are created via existing API
- **Reject/Edit:** Planner can drag-adjust individual tiles before confirming
- **Report:** Show quality report in a sidebar panel

### 11.4 Interaction with Existing Features

| Feature | Interaction |
|---------|-------------|
| Push-down | Not used during auto-scheduling (we find clean slots instead). Still works for manual adjustments after. |
| Quick placement mode | Remains available for manual override. Auto-scheduler is an alternative workflow, not a replacement. |
| Compact timeline | Can be run after auto-scheduling as a post-pass (equivalent to a single forward ASAP pass). |
| Validation | Used as safety net inside computeASAP/ALAP. Also used for final verification. |
| Precedence safeguard | Auto-scheduler respects all precedence constraints by construction. |
| Dry time | Handled inside computeASAP/ALAP via existing `isDryTimeRequired` logic. |

---

## Part 12 — Implementation Order

Implement in this order. Each step is independently testable and deployable.

### Step 1: computeASAP + computeALAP
- Wrap existing `getPredecessorConstraint()` / `getSuccessorConstraint()` to return timestamps
- Add forward/backward slot scanning (the `while` loop that skips blockers)
- **Test:** For a single task on an empty station, ASAP = earliest working time, ALAP = latest before deadline. For a task with predecessors, ASAP respects them. For a station with existing assignments, ASAP/ALAP skip over them.

### Step 2: computeCR
- Implement task-level and job-level CR
- **Test:** CR = 1.0 when available time exactly equals work. CR < 1.0 when overloaded. CR > 1.0 when slack exists.

### Step 3: PLACE_SINGLE_JOB (Level 0 only)
- Backward task ordering + ALAP placement on assigned station
- **Test:** Place a single job with 3 tasks on 3 stations. Verify backward order. Verify ALAP positions. Verify precedence respected.

### Step 4: FBI_LOOP (single iteration, Level 0)
- Forward pass (ASAP, CR-ordered) + backward pass (ALAP)
- Single iteration only, no convergence loop yet
- **Test:** 3 jobs competing for same station. Verify CR ordering. Verify no overlaps.

### Step 5: FBI_LOOP (full iteration with convergence)
- Add iteration loop + dampening + convergence check
- **Test:** Jobs that benefit from reordering across iterations converge to a better makespan.

### Step 6: Escalation Level 1 (alternative stations)
- Extend Task model with `alternativeStations`
- Add Level 1 to PLACE_SINGLE_TASK
- **Test:** Task can't fit on preferred station → placed on alternative.

### Step 7: Escalation Level 2 (ASAP fallback)
- **Test:** No ALAP slot on any station → ASAP placement used.

### Step 8: Escalation Levels 3–5 (splitting)
- Implement FIND_GAPS, SPLIT_ON_STATION, SPLIT_CROSS_STATION, SPLIT_PARALLEL
- **Test:** Task too large for any single gap → split into pieces that fill gaps.

### Step 9: Quality Report
- **Test:** Report accurately reflects escalation levels used, utilization, bottlenecks.

### Step 10: UI Integration
- Auto-schedule button, preview ghost tiles, confirm/reject flow, report panel.

---

## Appendix A — Glossary

| Term | Definition |
|------|-----------|
| ASAP | As Soon As Possible. Earliest valid start time for a task. |
| ALAP | As Late As Possible. Latest valid start time. JIT preference. |
| CR | Critical Ratio. `available_time / required_work`. Lower = more urgent. |
| FBI | Forward-Backward Improvement. Iterative scheduling that alternates ASAP and ALAP passes. |
| Freedom interval | `[ASAP, ALAP]` — the window within which a task can legally be placed. |
| Escalation level | How aggressive the scheduler is allowed to be (0=ideal → 6=infeasible). |
| Makespan | Latest `scheduledEnd` across all assignments. The total schedule duration. |
| Dampening | Locking a task's station assignment after it's stable across iterations, to prevent oscillation. |

## Appendix B — Constants (Tunable)

```typescript
const AUTO_SCHEDULE_DEFAULTS = {
    FBI_MAX_ITERATIONS: 6,
    CONVERGENCE_THRESHOLD_MINUTES: 30,
    MIN_SPLIT_RUN_MINUTES: 60,
    MACHINE_CHANGE_COST: 1,       // abstract cost units
    EARLY_WIP_COST: 2,
    SETUP_COST_PER_PIECE: 3,
    COLOR_RISK_COST: 5,
    PARALLEL_SPLIT_COST: 8,
    DRY_TIME_MINUTES: 240,        // 4 hours (already exists in codebase)
};
```
