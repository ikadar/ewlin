# General Auto-Place — Implementation Plan

## Context

The scheduler currently supports auto-placement per single job (ASAP/ALAP via `ALT+P S` / `ALT+P L`). The goal is to add a **global auto-placement** that places ALL unscheduled tiles across ALL jobs in a single operation, optimizing for minimum late jobs while guaranteeing zero precedence conflicts. The backend does the computation and streams progress to a frontend modal with a progress bar.

## Algorithm Design

### Why EDD + ASAP?

This is a variant of the **Job Shop Scheduling Problem** (JSSP). Since JSSP is NP-hard, we use a **greedy heuristic**:

- **Earliest Due Date (EDD)** ordering: jobs with tightest deadlines get placed first, giving them priority on contested stations
- **ASAP placement**: each job's tasks are placed at the earliest possible slot, maximizing the chance of meeting deadlines
- **Topological ordering** of cross-job dependencies (`requiredJobIds`) takes precedence over EDD — a dependency must be placed before its dependents regardless of deadline

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
3. Topological sort (Kahn's) with EDD tie-breaking within each level
4. Build ONE global PlacementContext (all stations, all existing assignments)
5. For each job in order:
   a. Topologically sort elements (reuse existing Kahn's logic)
   b. For each element's tasks in sequenceOrder:
      - Skip if already assigned or !canBeScheduled()
      - Get precedenceFloor (handles all 3 levels + drying)
      - Place via findEarliestGap (internal) or outsourced logic
      - Add to schedule + update context
   c. Yield progress event (SSE)
6. Single flush() at end (atomic)
7. Yield completion event
```

## Implementation

### Phase 1: Backend — Extract shared placement logic

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

### Phase 2: Backend — GeneralAutoPlaceService

**File: `services/php-api/src/ValueObject/GeneralAutoPlaceProgress.php`** (CREATE)

```php
class GeneralAutoPlaceProgress {
    public function __construct(
        public readonly string $type,           // 'progress' | 'complete'
        public readonly int $jobIndex,
        public readonly int $totalJobs,
        public readonly string $jobReference,
        public readonly int $jobPlacedCount,
        public readonly int $totalPlacedCount,
        public readonly ?int $computeMs = null,
    ) {}
}
```

**File: `services/php-api/src/Service/GeneralAutoPlaceService.php`** (CREATE)

Dependencies (inject same as AsapPlacementService):
- `SchedulingHelper`, `EndTimeCalculatorInterface`, `ScheduleRepository`
- `StationRepository`, `StationCategoryRepository`, `OutsourcedProviderRepository`
- `JobRepository`, `EntityManagerInterface`, `BusinessCalendar`, `LoggerInterface`
- `businessTimezone` parameter

Uses `PlacementTrait` for placement methods.

Key method:
```php
/** @return \Generator<int, GeneralAutoPlaceProgress> */
public function autoPlaceAll(): \Generator
```

Steps:
1. `$schedule = $this->scheduleRepository->getCurrentSchedule()`
2. `$jobs = $this->jobRepository->findNonCancelledWithUnscheduledTasks()` — new repo method
3. `$orderedJobs = $this->topologicalSortJobsByEdd($jobs)` — Kahn's + EDD
4. `$context = $this->buildGlobalContext($orderedJobs, $schedule)` — all stations + assignments
5. Loop jobs, reuse trait methods, yield progress after each job
6. Single `flush()`, yield completion

**`buildGlobalContext()`**: Similar to `AsapPlacementService::buildContext()` but collects stationIds from ALL jobs' tasks, and indexes ALL existing assignments.

**`topologicalSortJobsByEdd()`**: Kahn's algorithm on job dependency graph. Within each topological level, sort by `workshopExitDate ASC` (nulls last).

**File: `services/php-api/src/Repository/JobRepository.php`** (MODIFY)

Add method: `findNonCancelledWithUnscheduledTasks(): Job[]` — returns all non-cancelled jobs. The service will filter for unscheduled tasks using the schedule object.

### Phase 3: Backend — Controller endpoint

**File: `services/php-api/src/Controller/Api/V1/ScheduleController.php`** (MODIFY)

Add endpoint in existing `ScheduleController` (route prefix `/api/v1/schedule`):

```
POST /api/v1/schedule/auto-place-all
Content-Type: text/event-stream
```

Uses Symfony `StreamedResponse` with:
- `set_time_limit(300)` for safety (5 min max)
- `ob_implicit_flush(true)` + `flush()` after each event
- Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`
- Iterates generator from `GeneralAutoPlaceService::autoPlaceAll()`

### Phase 4: Frontend — SSE stream hook ✅

**File: `apps/web/src/hooks/useAutoPlaceAllStream.ts`** (CREATE) — DONE

### Phase 5: Frontend — Modal component ✅

**File: `apps/web/src/components/AutoPlaceAllModal/AutoPlaceAllModal.tsx`** (CREATE) — DONE

### Phase 6: Frontend — Wire into App.tsx ✅

**File: `apps/web/src/App.tsx`** (MODIFY) — DONE
**File: `apps/web/src/components/CommandPalette/useCommands.ts`** (MODIFY) — DONE

## Files Summary

| # | File | Action | Status |
|---|------|--------|--------|
| 1 | `services/php-api/src/Service/PlacementTrait.php` | CREATE | TODO |
| 2 | `services/php-api/src/Service/AsapPlacementService.php` | MODIFY | TODO |
| 3 | `services/php-api/src/ValueObject/GeneralAutoPlaceProgress.php` | CREATE | TODO |
| 4 | `services/php-api/src/Service/GeneralAutoPlaceService.php` | CREATE | TODO |
| 5 | `services/php-api/src/Repository/JobRepository.php` | MODIFY | TODO |
| 6 | `services/php-api/src/Controller/Api/V1/ScheduleController.php` | MODIFY | TODO |
| 7 | `apps/web/src/hooks/useAutoPlaceAllStream.ts` | CREATE | DONE |
| 8 | `apps/web/src/components/AutoPlaceAllModal/AutoPlaceAllModal.tsx` | CREATE | DONE |
| 9 | `apps/web/src/App.tsx` | MODIFY | DONE |
| 10 | `apps/web/src/components/CommandPalette/useCommands.ts` | MODIFY | DONE |

## Key Reuse Points

- `SchedulingHelper::getPrecedenceFloor()` — all precedence logic (3 levels + drying)
- `SchedulingHelper::snapToNextWorkingTime()` — working hours
- `EndTimeCalculatorInterface::calculateForInternalTask()` — task stretching
- `PlacementContext::addAssignment()` — sorted insertion
- `AsapPlacementService::buildContext()` pattern — adapted for global scope
- Kahn's algorithm — already in AsapPlacementService, reused for both elements and jobs
- Mass-unschedule dialog pattern — UI template for modal

## Future Extensibility

The architecture cleanly separates **job priority ordering** from **placement mechanics**. The ordering logic lives in a single method (`topologicalSortJobsByEdd`), making it trivial to swap strategies later:

### Critical Ratio (CR)
`CR = (time until deadline) / (remaining processing time)`. More sophisticated than EDD because it accounts for remaining work, not just the deadline. **Implementation**: replace the EDD comparator with a CR comparator in `topologicalSortJobsByEdd()`. Requires computing total remaining processing time per job (sum of unscheduled tasks' durations).

### Dynamic CR
Recalculates CR after each job is placed, since placing job A on shared stations changes available capacity for job B. **Implementation**: replace the static sorted list with a priority queue (`SplPriorityQueue`) that re-evaluates CR after each job placement.

### FBI (Forward-Backward Improvement)
Two-pass global optimization:
1. **Forward pass (ASAP)**: place all jobs earliest possible (our alpha algorithm)
2. **Backward pass (ALAP)**: starting from the latest completion time, push jobs back to free early capacity
3. **Iterate** until no improvement

## Verification

1. **PHPStan level 8**: `cd services/php-api && vendor/bin/phpstan analyse`
2. **PHPUnit**: `cd services/php-api && vendor/bin/phpunit`
3. **Manual E2E test**:
   - Create several jobs with cross-job dependencies and varying deadlines
   - Unschedule all tiles (CTRL+ALT+Z)
   - Trigger CTRL+ALT+P → modal appears → progress bar fills → summary shown
   - Verify: no precedence conflicts, earlier-deadline jobs placed first
   - Verify: snapshot refreshes after completion
4. **Edge cases**: No unscheduled tasks (0 placed), single job, circular dependency detection
