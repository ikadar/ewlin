# General Auto-Place — Implementation Plan

## Context

The scheduler currently supports auto-placement per single job (ASAP/ALAP via `ALT+P S` / `ALT+P L`). The goal is to add a **global auto-placement** that places ALL unscheduled tiles across ALL jobs in a single operation, optimizing for minimum late jobs while guaranteeing zero precedence conflicts. The backend does the computation and streams progress to a frontend modal with a progress bar.

## Algorithm Design

### Ordering Strategies

This is a variant of the **Job Shop Scheduling Problem** (JSSP). Since JSSP is NP-hard, we use **greedy heuristics** with three ordering strategies:

#### EDD — Earliest Due Date (Alpha)
- Jobs sorted by `workshopExitDate ASC` — tightest deadlines placed first
- Simple and effective when all jobs have similar workloads
- **ASAP placement**: each job's tasks placed at earliest possible slot

#### CR — Critical Ratio (Beta)
- `CR = (time until deadline) / (remaining processing time)`
- More sophisticated than EDD: accounts for remaining work, not just deadline
- A job with 2 days until deadline and 1 day of work (CR=2) is less critical than a job with 3 days until deadline and 2.5 days of work (CR=1.2)
- Internal tasks: `setupMinutes + runMinutes`; outsourced tasks: `durationOpenDays × 480 min`

#### Dynamic CR (Beta)
- CR recalculated after each job placement
- After placing job A, `effectiveNow` advances to the latest end time of A's assignments
- Remaining ready jobs re-sorted by CR with updated time reference
- Captures how urgency shifts as earlier jobs consume station capacity and calendar time

All strategies respect **topological ordering** of cross-job dependencies (`requiredJobIds`) — a dependency is always placed before its dependents.

### Precedence Correctness Guarantee

The algorithm is precedence-safe by construction:
1. **Cross-job**: Jobs topologically sorted by `requiredJobIds` → dependencies placed first
2. **Cross-element**: Elements within each job topologically sorted by `prerequisiteElementIds`
3. **Intra-element**: Tasks processed in `sequenceOrder`
4. **Precedence floor**: `SchedulingHelper::getPrecedenceFloor()` enforces all three levels + drying time

### Algorithm Pseudocode

```
1. Load all non-cancelled jobs with unscheduled tasks
2. Build cross-job dependency graph from requiredJobIds
3. Topological sort (Kahn's) with strategy tie-breaking:
   - EDD: workshopExitDate ASC
   - CR: criticalRatio ASC (lowest = most critical)
   - Dynamic CR: CR re-evaluated after each job
4. Build ONE global PlacementContext (all stations, all existing assignments)
5. For each job in order:
   a. Topologically sort elements (reuse existing Kahn's logic)
   b. For each element's tasks in sequenceOrder:
      - Skip if already assigned or !canBeScheduled()
      - Get precedenceFloor (handles all 3 levels + drying)
      - Place via findEarliestGap (internal) or outsourced logic
      - Add to schedule + update context
   c. Yield progress event (SSE)
   d. [Dynamic CR only] Advance effectiveNow, re-sort ready queue
6. Single flush() at end (atomic)
7. Yield completion event
```

## Implementation

### Phase 1: Backend — Extract shared placement logic ✅

**File: `services/php-api/src/Service/PlacementTrait.php`** (CREATE)

Extract from `AsapPlacementService` into a trait:
- `placeInternalTask(Task, ScheduleReadInterface, DateTimeImmutable, PlacementContext): ?TaskAssignment`
- `placeOutsourcedTask(Task, ScheduleReadInterface, DateTimeImmutable, PlacementContext): ?TaskAssignment`
- `findEarliestGap(Task, Station, DateTimeImmutable, PlacementContext): DateTimeImmutable`
- `topologicalSortElements(Element[]): Element[]`
- `setTimeOnDate(DateTimeImmutable, string): DateTimeImmutable`

Requires using class to provide: `$schedulingHelper`, `$endTimeCalculator`, `$businessCalendar`, `$providerRepository`, `$businessTimezone`.

**File: `services/php-api/src/Service/AsapPlacementService.php`** (MODIFY)

Replace private methods with `use PlacementTrait`. Keep `autoPlace()` and `buildContext()` as-is. The `topologicalSort()` method becomes `topologicalSortElements()` from the trait.

### Phase 2: Backend — GeneralAutoPlaceService ✅

**File: `services/php-api/src/ValueObject/GeneralAutoPlaceProgress.php`** (CREATE)

Progress VO with `strategy` field added in beta.

**File: `services/php-api/src/Service/GeneralAutoPlaceService.php`** (CREATE)

Uses `PlacementTrait`. Accepts `PlacementStrategy` enum parameter. Key methods:
- `autoPlaceAll(PlacementStrategy)` — dispatches to sequential or dynamic CR path
- `placeJobTasks(Job)` — extracted shared logic for placing one job's tasks
- `topologicalSortJobs(jobs, strategy)` — Kahn's with strategy-specific comparator
- `autoPlaceAllDynamicCr(jobs)` — incremental Kahn's with CR re-evaluation
- `computeCriticalRatio(Job)` — CR = (deadline - now) / remainingMinutes
- `computeRemainingProcessingMinutes(Job)` — sum of unscheduled task durations

**File: `services/php-api/src/Enum/PlacementStrategy.php`** (CREATE — Beta)

```php
enum PlacementStrategy: string {
    case EDD = 'edd';
    case CR = 'cr';
    case DYNAMIC_CR = 'dynamic_cr';
}
```

**File: `services/php-api/src/Repository/JobRepository.php`** (MODIFY)

Added method: `findNonCancelled(): Job[]` — returns all non-cancelled jobs with eager-loaded elements/tasks.

### Phase 3: Backend — Controller endpoint ✅

**File: `services/php-api/src/Controller/Api/V1/ScheduleController.php`** (MODIFY)

```
POST /api/v1/schedule/auto-place-all?strategy=edd|cr|dynamic_cr
Content-Type: text/event-stream
```

Accepts optional `strategy` query parameter (defaults to `edd`). Passes `PlacementStrategy` enum to service.

### Phase 4: Frontend — SSE stream hook ✅

**File: `apps/web/src/hooks/useAutoPlaceAllStream.ts`** (CREATE)

Exports `PlacementStrategy` type. `start(strategy)` appends `?strategy=` to POST URL.

### Phase 5: Frontend — Modal component ✅

**File: `apps/web/src/components/AutoPlaceAllModal/AutoPlaceAllModal.tsx`** (CREATE)

Confirm dialog includes strategy radio selector (EDD / CR / CR Dynamique). Completion summary shows which strategy was used.

### Phase 6: Frontend — Wire into App.tsx ✅

**File: `apps/web/src/App.tsx`** (MODIFY) — DONE
**File: `apps/web/src/components/CommandPalette/useCommands.ts`** (MODIFY) — DONE

## Files Summary

| # | File | Action | Status |
|---|------|--------|--------|
| 1 | `services/php-api/src/Service/PlacementTrait.php` | CREATE | ✅ DONE |
| 2 | `services/php-api/src/Service/AsapPlacementService.php` | MODIFY | ✅ DONE |
| 3 | `services/php-api/src/ValueObject/GeneralAutoPlaceProgress.php` | CREATE | ✅ DONE |
| 4 | `services/php-api/src/Service/GeneralAutoPlaceService.php` | CREATE | ✅ DONE |
| 5 | `services/php-api/src/Repository/JobRepository.php` | MODIFY | ✅ DONE |
| 6 | `services/php-api/src/Controller/Api/V1/ScheduleController.php` | MODIFY | ✅ DONE |
| 7 | `apps/web/src/hooks/useAutoPlaceAllStream.ts` | CREATE | ✅ DONE |
| 8 | `apps/web/src/components/AutoPlaceAllModal/AutoPlaceAllModal.tsx` | CREATE | ✅ DONE |
| 9 | `apps/web/src/App.tsx` | MODIFY | ✅ DONE |
| 10 | `apps/web/src/components/CommandPalette/useCommands.ts` | MODIFY | ✅ DONE |
| 11 | `services/php-api/src/Enum/PlacementStrategy.php` | CREATE (Beta) | ✅ DONE |

## Key Reuse Points

- `SchedulingHelper::getPrecedenceFloor()` — all precedence logic (3 levels + drying)
- `SchedulingHelper::snapToNextWorkingTime()` — working hours
- `EndTimeCalculatorInterface::calculateForInternalTask()` — task stretching
- `PlacementContext::addAssignment()` — sorted insertion
- `AsapPlacementService::buildContext()` pattern — adapted for global scope
- Kahn's algorithm — already in AsapPlacementService, reused for both elements and jobs
- Mass-unschedule dialog pattern — UI template for modal

## Future Extensibility

### FBI (Forward-Backward Improvement)
Two-pass global optimization:
1. **Forward pass (ASAP)**: place all jobs earliest possible (current algorithm)
2. **Backward pass (ALAP)**: starting from the latest completion time, push jobs back to free early capacity
3. **Iterate** until no improvement

Requires ALAP placement logic (reverse of current ASAP). `SchedulingHelper::getPrecedenceCeiling()` already exists for the backward pass.

## Verification

1. **PHPStan level 8**: `cd services/php-api && vendor/bin/phpstan analyse`
2. **PHPUnit**: `cd services/php-api && vendor/bin/phpunit`
3. **Manual E2E test**:
   - Create several jobs with cross-job dependencies and varying deadlines
   - Unschedule all tiles (CTRL+ALT+Z)
   - Trigger CTRL+ALT+P → modal appears with strategy selector
   - Test each strategy: EDD, CR, Dynamic CR
   - Verify: no precedence conflicts, strategy-appropriate ordering
   - Verify: snapshot refreshes after completion
4. **Edge cases**: No unscheduled tasks (0 placed), single job, circular dependency detection, jobs with no deadline (CR → lowest priority)
