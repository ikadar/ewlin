# Operator Scheduling Algorithm — Implementation Plan

> **Date:** 2026-04-04
> **Source:** `deterministic-operator-algorithm-analysis.md`
> **Approach:** Iterative — each phase produces a testable, visible result

---

## Table of Contents

1. [What Already Exists](#1-what-already-exists)
2. [What This Algorithm Adds](#2-what-this-algorithm-adds)
3. [Production Scale](#3-production-scale)
4. [Architecture Overview](#4-architecture-overview)
5. [Phases](#5-phases)
   - Phase 1A: Enrich Stations with Operator-Algorithm Attributes
   - Phase 1B: Operator Entity
   - Phase 2: The Scheduling Engine
   - Phase 3: Pre-Split + FBI Convergence
   - Phase 4: Constraints UI + Performance
6. [Data Model — New and Modified Entities](#6-data-model--new-and-modified-entities)
7. [Technical Architecture](#7-technical-architecture)
8. [Resolved Decisions](#8-resolved-decisions)

---

## 1. What Already Exists

The current Flux system provides:

| Layer | What exists |
|-------|-------------|
| **Data model** | Station (with operating schedule, exceptions, capacity, category, group), Job → Element → Task (internal with setup/run minutes, outsourced with provider lead time), OutsourcedProvider (transit days, departure/reception times) |
| **Scheduling** | TaskAssignment (task → station, start/end time), manual and semi-automatic placement (quickPlacement), precedence validation, conflict detection (deadline, station mismatch, capacity, availability) |
| **UI** | SchedulingGrid (Gantt per station with timeline, tiles, drag-and-drop), job sidebar, tile labels, station headers, save/load schedules |
| **Validation** | @flux/schedule-validator package, ScheduleSnapshot with conflicts and lateJobs |

**What does NOT exist:** Operator entity, attention model, automated scheduling algorithm, setup peremption, masked time, backward pass (LAST), FBI.

---

## 2. What This Algorithm Adds

The core innovation: **machine and operator are assigned together, at each time slot**, instead of placing tiles on machines then assigning operators after the fact.

| Current system | New algorithm |
|----------------|---------------|
| Tile-level placement (whole task as block) | Time-slot level (Ut by Ut) |
| Operator not modeled | Operator integrated into scheduling |
| Uniform productivity | Variable via attention model |
| Setup time counted but not modeled dynamically | Setup peremption (re-setup if interrupted too long) |
| Tasks are atomic blocks | Tasks can be interrupted/resumed |
| One operator per machine implied | Multi-operator machines (attention > 1.0) |
| No operator multi-tasking | Operator monitors multiple machines via masked time |
| Manual or semi-auto placement | Fully automatic: declare constraints, schedule recalculates |

---

## 3. Production Scale

| Parameter | Value |
|-----------|-------|
| Machines | ~15 |
| Operators | 10–15 |
| Actions (3-week horizon) | 1,000–2,000 |
| Time slots (3 weeks, 5-min tick) | ~2,500 |
| Outer-loop iterations (worst case) | 2.5M–5M |
| Target response time | < 5 seconds (interactive) |

Language for the compute engine: **Rust**. At 1,000-2,000 actions, interactive speed requires compiled performance.

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              Existing React Frontend (apps/web)          │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────────────────┐ │
│  │  Existing UI     │  │  New UI panels               │ │
│  │  SchedulingGrid  │  │  - Operator CRUD (Ph.1B)     │ │
│  │  Job sidebar     │  │  - Station config (Ph.1A)    │ │
│  │  Tile placement  │  │  - Computed schedule (Ph.2)  │ │
│  │  (manual mode)   │  │  - Constraint editor (Ph.4)  │ │
│  └────────┬─────────┘  └──────────┬───────────────────┘ │
│           │                       │                     │
└───────────┼───────────────────────┼─────────────────────┘
            │                       │
            └───────────┬───────────┘
                        │ all REST calls
                        │
         ┌──────────────┴──────────────┐
         │    PHP API (services/php-api)│
         │    PostgreSQL — single       │
         │    source of truth           │
         │                              │
         │  Existing:                   │
         │  - Station CRUD              │
         │  - Job/Task CRUD             │
         │  - Assignment CRUD           │
         │  - Schedule CRUD             │
         │                              │
         │  New (Ph.1A + 1B):           │
         │  - Station extended attrs    │
         │  - Operator CRUD             │
         │  - Constraint CRUD (Ph.4)    │
         │                              │
         │  New (Ph.2):                 │
         │  - POST /api/schedule/compute│
         │    → assembles payload       │
         │    → calls Rust engine       │
         │    → returns result          │
         └──────────────┬──────────────┘
                        │
                        │ POST (full payload JSON)
                        │
         ┌──────────────┴──────────────┐
         │   Scheduling Engine (Rust)   │
         │   Stateless compute service  │
         │                              │
         │   IN:  stations + operators  │
         │        + jobs/tasks          │
         │        + constraints         │
         │                              │
         │   Engine:                    │
         │   - backward pass (LAST)     │
         │   - forward pass (chrono)    │
         │   - attention model          │
         │   - setup peremption         │
         │   - masked time              │
         │   - pre-split (Ph.3)         │
         │   - FBI (Ph.3)              │
         │                              │
         │   OUT: ScheduleResult JSON   │
         │        (assignments +        │
         │         operators + stats)   │
         │                              │
         │   No database.              │
         │   No state.                  │
         │   Pure computation.          │
         └─────────────────────────────┘
```

### Key architectural principles

1. **Single source of truth: PostgreSQL via PHP API.** All entities (stations, operators, jobs, tasks, constraints) live in the existing PostgreSQL database, managed by Doctrine migrations. No data duplication.

2. **Rust engine is stateless.** It receives a complete JSON payload, computes the schedule, returns the result. No database, no persistence, no side effects. Easy to test, deploy, scale, and replace.

3. **PHP API orchestrates.** When the frontend requests a schedule computation, the PHP API assembles the full payload (stations with extended attributes, operators, jobs/tasks, constraints), sends it to the Rust engine, and can optionally persist the result.

4. **Frontend talks only to PHP API.** No direct frontend → Rust communication. The PHP API is the single backend entry point.

---

## 5. Phases

### Phase 1A — Enrich Stations with Operator-Algorithm Attributes

**Goal:** The 15 existing stations gain the properties the algorithm needs.

**New attributes on Station (Doctrine migration):**

| Attribute | Type | Example | Purpose |
|-----------|------|---------|---------|
| `attentionFull` | float | 1.0 | Attention required during setup phase (1.5+ = multi-operator) |
| `maskedTimeEnabled` | boolean | true | Whether this machine supports masked time |
| `attentionMasked` | float | 0.3 | Attention required during run phase (monitoring only) |
| `maskedProductivity` | float | 0.95 | Fixed productivity during masked time (small loss, big gain) |
| `tickMinutes` | smallint | 5 | Machine-specific time granularity |
| `peremptionThresholdMinutes` | smallint | 60 | Setup expires after this idle gap |
| `maxChunkMinutes` | smallint | 420 | Pre-split threshold (7h default) |

**Where:** New nullable columns on the `stations` table. Doctrine migration in the PHP API. New fields on the Station entity. API endpoints extended to accept/return these fields.

**UI:** Extend the existing station management UI — add a new section or tab for operator-algorithm configuration (attention levels, tick, peremption threshold, max chunk). Simple form fields.

**⚠ UI/UX gate:** Before implementing frontend changes, create a **playground** to validate the station config section layout with Julien.

**Validation criteria:**
- All 15 stations have their new attributes configured
- Values make domain sense (press needs attention 1.0, folder needs 0.8, etc.)
- Operating schedules imported correctly from the existing system

**What this enables:** Nothing yet on its own — but it's a prerequisite for Phase 1B and Phase 2.

---

### Phase 1B — Operator Entity

**Goal:** Operators exist in the system with their skills and schedules.

**New entity: Operator (Doctrine entity + migration)**

| Attribute | Type | Example |
|-----------|------|---------|
| `id` | guid | UUID |
| `name` | string(100) | "Jean" |
| `totalAttention` | float | 1.0 (could be < 1.0 for part-time) |
| `operatingSchedule` | json | Same structure as Station |
| `exceptions` | json | Same structure as Station exceptions |

**New entity: OperatorSkill (join table)**

| Attribute | Type | Example |
|-----------|------|---------|
| `operatorId` | guid | FK → Operator |
| `stationId` | guid | FK → Station |
| `proficiency` | float | 1.0 = nominal (future use) |

Skills = which machines this operator can run. Each operator has a list of stations they're qualified for.

**Where:** New `operators` and `operator_skills` tables. Doctrine entities, repository, CRUD controller. Full REST API.

**@flux/types:** New Operator and OperatorSkill types.

**UI — Operator configuration screens:**

1. **Operator list page:** Table with name, number of skills, schedule summary (e.g., "Mon-Fri 06:00-16:00"). Add/edit/delete actions.
2. **Operator detail form:** Name, total attention (default 1.0), weekly operating schedule, exceptions. Reuse the existing operating schedule editor component (same structure as stations).
3. **Skill management:** Within the operator detail form — select stations from the existing station list, set proficiency per station. Visual: sliders with magnetic snap to 0 and 1, grouped by station category, sorted alphabetically. Editable value field.

**⚠ UI/UX gate:** Before implementing frontend changes, create a **playground** to validate the operator form layout (especially the proficiency sliders and skill management UX) with Julien.

**Validation criteria:**
- 10-15 operators created with real names
- Each operator has skills assigned to at least one station
- Schedules reflect real working hours
- Domain validation: "yes, Jean works the Komori and MBO, Marie does finishing"

**What this enables:** Phase 2 — the algorithm has all its inputs.

---

### Phase 2 — The Scheduling Engine

**Goal:** The algorithm runs end-to-end and produces a visible schedule. This is the core of the project.

**What gets built:**

#### 2.1 — Rust compute service
A standalone Rust binary exposing a single HTTP endpoint:

```
POST /compute
Content-Type: application/json

{
  "stations": [...],      // With extended attrs (attention, tick, peremption, chunk)
  "operators": [...],     // With skills and schedules
  "jobs": [...],          // With elements, tasks, deadlines
  "constraints": [],      // Empty for now (Phase 4)
  "options": {
    "horizonDays": 21,
    "tickMinutes": 5       // Global minimum tick
  }
}

→ 200 OK
{
  "assignments": [...],
  "stats": {...},
  "warnings": [...],
  "computeTimeMs": 3200
}
```

#### 2.2 — Backward pass (LAST computation)
- Sort jobs by deadline DESC
- For each job, reverse the element → task dependency chain
- Walk backward from deadline, compute LAST for each action accounting for:
  - Machine operating schedule (skip closed slots)
  - Operator availability (at least one qualified operator on shift)
  - Task duration (setup + run)
  - Predecessor chain
  - Outsourced tasks as delay nodes (precedence gap, no machine/operator)

#### 2.3 — Forward pass (chronological scheduling)
The full algorithm as described in the PDF:

**Guarantee: the algorithm places 100% of tasks.** It runs until `sum(ART) = 0` — no early exit, no "unscheduled tasks". The grid is **dynamic** (starts at 14 days, extends by 7 as needed). The schedule duration is exactly as long as needed — no arbitrary cutoff. Tasks may be late, but they are ALL placed.

```
T = 0
Repeat until sum(ART) = 0:       // ← NEVER exits early. All tasks placed.
  Repeat until no eligible action can be assigned:
    Score eligible actions:
      // Continuous urgency (replaces binary LAST=T → 9999)
      slack = LAST - T - remaining_ART
      If slack <= 0: urgency = 10000 + |slack|     // Late: more late = more urgent
      Else: urgency = (1 - slack / horizon) × 1000 // Approaching: gradual escalation
      
      // Job-level urgency boost
      job_slack = job_deadline - T - sum(remaining_ART for all tasks in job)
      If job_slack < 0: job_boost = |job_slack| × 50
      
      score = urgency + job_boost + calage_bonus
    Sort by score DESC
    For each eligible action (in score order):
      Check: machine available? operator available? attention sufficient?
      If yes → assign, enter sub-loop to schedule to completion:
        Sub-loop at each Ut:
          - Track EAT (elapsed action time)
          - If EAT > setup_time → machine enters run phase
            → attention drops from attentionFull to attentionMasked
            → freed attention available for other assignments
          - Check operator continuity (prefer same operator)
          - If operator unavailable → try fallback operator
          - If no operator at all → check setup peremption:
            - Decrement SPR counter
            - If SPR = 0 → re-setup needed, add setup_time back to ART
          - LAST safety check: if another action on this machine
            has LAST exceeded → rollback (degraded KO), break sub-loop
          - Compute productivity:
            - Setup phase: min(attention_received / attentionFull, 1.0) — proportional
            - Run phase (normal): min(attention_received / attentionRun, 1.0) — proportional, operator stays
            - Run phase (masked time, if maskedTimeEnabled): maskedProductivity — fixed, operator freed
          - Decrement ART by tick × productivity
        End sub-loop when ART = 0
  End-of-timestep: recalculate operator attention across all machines
    If attention freed → switch degraded actions to nominal mode
  T = T + 1
```

#### 2.4 — Schedule output and persistence

The Rust engine returns `ComputedAssignment[]` with operator info. The PHP API persists them to the Schedule entity (the single source of truth):

**Compute flow:**
1. Frontend calls `POST /api/v1/schedule/compute` (blue "Calculer" button)
2. PHP assembles full payload from DB (stations + operators + jobs/tasks)
3. PHP calls Rust engine at `POST /compute`
4. Rust returns `ScheduleResult` with computed assignments including `operators[]` per task
5. PHP persists:
   - **Clear** all non-pinned, non-completed assignments from the Schedule entity (same as Ctrl+Alt+Z)
   - **Create** new `TaskAssignment` for each computed assignment, with `operators` field set
   - **Update** task statuses to Assigned
   - **Flush** to DB
6. Frontend receives the ScheduleResult as response AND invalidates the snapshot cache
7. Both views (station Gantt, operator Gantt) refresh automatically

**Key data model decision: `operators` array on TaskAssignment.**

The existing `TaskAssignment` value object gains an `operators` field — an array of `{operatorId, attention}` objects:
```php
TaskAssignment {
    taskId, targetId, isOutsourced, scheduledStart, scheduledEnd,
    operators: [{operatorId: string, attention: float}]  // ← NEW (array, not single ID)
    isCompleted, isPinned, ...
}
```

Why an array, not a single `operatorId`:
- The Hohner (attention=2.0) needs **two operators simultaneously**
- The Rust engine already outputs `operators: Vec<OperatorAssignment>` per task
- Storing the array preserves the engine's output faithfully
- For single-operator tasks (most cases), the array has one element

Why on TaskAssignment, not a separate entity:
- Both Gantt views derive from the same TaskAssignment data
- No separate table, no join, no sync problem
- The Schedule entity stores assignments as JSON — adding an array to each is zero-cost
- If we need a separate lifecycle for operator assignments later, we can migrate

**Snapshot extension:**

`operators[]` is added to the `ScheduleSnapshot` so all views have operator data:
```
ScheduleSnapshot {
    stations, categories, groups, providers, jobs, elements, tasks,
    assignments (now with operators[] on each),
    conflicts, lateJobs,
    operators: Operator[]    // ← NEW: all operators with skills + schedules
}
```

Single snapshot feeds station Gantt, operator Gantt, and flux page. No separate fetch.

#### 2.6 — UI: Station Gantt + Operator Gantt (two pages, same snapshot)

**Two separate pages**, not a toggle on the same page. Reasons:
- The existing SchedulingGrid (700+ lines) is deeply coupled to stations (StationColumn, StationHeader, drag & drop, pick & place, virtual scroll). Making it generic is a risky, large refactor.
- Two pages sharing reusable sub-components (TimelineColumn, Tile, UnavailabilityOverlay) is cleaner.
- Both pages read the **same snapshot** → always synchronized.
- Navigation via **sidebar** buttons ("Planning stations", "Planning opérateurs").
- When the user clicks "Calculer" on either page, the snapshot updates → both pages reflect the change.

**Station Gantt (existing page, enhanced):**
- Only active stations shown (status=Available)
- Groups assignments by `targetId` (station) — existing behavior
- Each tile shows **operator names** (comma-separated if multiple) from `assignment.operators`
- If `operators` is empty, no badge (manual assignment without operator)
- "Calculer" button (blue FAB) triggers compute and shows result modal

**Operator Gantt (new page `/operator-schedule`):**
- One column per operator (from `snapshot.operators`)
- Groups assignments by operator: for each assignment, check its `operators[]` array
- A task assigned to 2 operators appears as a tile in BOTH columns
- Each tile shows the **station name** instead of operator name
- Operator availability overlay (hatched for non-working hours via `operator.operatingSchedule`)
- Assignments with empty `operators[]` do not appear in this view
- Same timeline, zoom controls as station Gantt
- "Calculer" button (blue FAB) — same as station page
- Reuses: TimelineColumn, Tile component, UnavailabilityOverlay logic

**Shared sub-components:**
- `TimelineColumn` — hour markers, day separators, now line
- `Tile` — task visual representation (colored box with labels)
- `UnavailabilityOverlay` — hatched pattern for non-working hours
- Compute result modal — stats display after engine run

**⚠ UI/UX gate:** Before implementing frontend changes, create **playgrounds** to validate: (1) tile with operator names, (2) operator Gantt column layout with availability, (3) multi-operator tile. Validate each with Julien.

**Validation criteria:**
- Algorithm produces a complete schedule for 1,000+ actions in < 10 seconds
- Schedule respects all precedence constraints
- Schedule respects machine and operator operating schedules
- Operators never double-booked beyond their attention capacity
- LAST-critical actions (score 9999) get priority
- Calage bonus groups similar setups
- Masked time frees operator attention during run phase
- Setup peremption triggers re-setup on long interruptions
- Degraded mode slows actions proportionally to attention deficit
- Outsourced tasks appear as delay gaps in the timeline
- Domain validation: "this schedule looks like what a good production manager would do"

---

### Phase 3 — Pre-Split + FBI Convergence

**Goal:** Long tasks don't monopolize machines. The schedule converges to realistic durations.

#### 3.1 — Pre-split preprocessing (inside Rust engine)
- Before running the algorithm, scan all actions
- If action duration > station's `maxChunkMinutes` → split into chunks
- Create precedence links: chunk 1 → chunk 2 → chunk 3
- Transfer original action's incoming precedence to chunk 1, outgoing to last chunk
- Chunks 2+ have no extra setup baked in (handled dynamically by calage/peremption)
- Chunk naming: "AFVAC Interior [1/3]", "AFVAC Interior [2/3]", "AFVAC Interior [3/3]"

#### 3.2 — FBI (Feedback-Based Improvement, inside Rust engine)
- Run the full algorithm (backward + forward)
- Collect actual durations from the schedule (including degraded mode slowdowns, re-setups)
- Feed actual durations back as inputs to run N+1
- The backward pass recomputes LAST with realistic durations → different priorities → different schedule
- Repeat until convergence (< 1% change in makespan) or max 5 iterations

#### 3.3 — UI enhancements
- Chunks recombined visually when consecutive (single block with subtle separators)
- FBI iteration indicator: "Iteration 3/5 — converged"
- Before/after comparison: show what changed between FBI iterations

**Validation criteria:**
- 20-hour jobs get split at chunk boundaries, interleaved with urgent work
- Calage bonus glues consecutive chunks (no unnecessary fragmentation)
- FBI converges in 2-4 iterations
- Schedule after FBI is measurably better than single-pass

---

### Phase 4 — Constraints + Performance Optimization

**Goal:** Users declare constraints instead of moving tiles. Recalculation is interactive.

#### 4.1 — Constraint model (Doctrine entity + migration)

| Constraint type | Example | Effect on algorithm |
|-----------------|---------|---------------------|
| Machine unavailable | "Komori maintenance Thu 15h-19h" | Mark station slots as closed |
| Operator absent | "Bernard absent tomorrow 12h-13h" | Mark operator slots as unavailable |
| Duration override | "AFVAC interior takes 180min not 120" | Override action's run_time |
| Pinned start | "Job 4402 starts Monday 16h45" | Force action's start time |

Constraints are stored in PostgreSQL (part of the PHP API data model). They are included in the payload sent to the Rust engine, which applies them before each computation.

#### 4.2 — Constraint UI
- Constraint panel: add/remove constraints
- Each constraint shows its effect on the schedule (before/after delta)

#### 4.3 — Performance optimizations (inside Rust engine)

| Optimization | Expected gain |
|--------------|---------------|
| Multi-rate ticks per machine | 2-3x |
| Rolling window: backward = full horizon, forward = tiered resolution | 5-7x |
| Data structure: flat arrays, bitsets for availability | 2-5x |
| Algorithmic: cache scoring, skip idle operators | 2x |

Target: constraint change → full recalculation → updated Gantt in < 2 seconds.

**Validation criteria:**
- Add a constraint → schedule updates in < 5 seconds
- "Komori maintenance Thursday" → no tasks on Komori during that window
- "Bernard absent" → tasks reassigned to other qualified operators
- Duration override → downstream LAST values shift correctly

---

## 6. Data Model — New and Modified Entities

### 6.1 — Extended Station Attributes (Phase 1A)

New nullable columns on existing `stations` table:

```
stations (existing table)
  + attention_full: float, nullable, default null
  + attention_run: float, nullable, default null
  + masked_time_enabled: tinyint(1), not null, default 0
  + attention_masked: float, nullable, default null
  + masked_productivity: float, nullable, default null
  + tick_minutes: smallint, nullable, default null
  + peremption_threshold_minutes: smallint, nullable, default null
  + max_chunk_minutes: smallint, nullable, default null
```

### 6.2 — Operator (Phase 1B)

```
operators (new table)
  id: guid PK
  first_name: varchar(50), not null
  last_name: varchar(50), not null
  role: varchar(100), nullable
  operating_schedule: json, nullable
  schedule_exceptions: json, nullable
  created_at: datetime_immutable
  updated_at: datetime_immutable

operator_skills (new table)
  id: guid PK
  operator_id: guid FK → operators
  station_id: guid FK → stations
  proficiency: float, default 1.0
  UNIQUE(operator_id, station_id)
```

### 6.3 — Constraint (Phase 4)

```
scheduling_constraints (new table)
  id: guid PK
  constraint_type: varchar(30)  -- MachineUnavailable, OperatorAbsent, DurationOverride, PinnedStart
  target_id: guid               -- Station, operator, or task ID
  time_start: datetime_immutable, nullable
  time_end: datetime_immutable, nullable
  override_value: float, nullable
  description: varchar(255)
  created_at: datetime_immutable
  updated_at: datetime_immutable
```

### 6.4 — TaskAssignment extension (operators array)

The existing `TaskAssignment` value object (stored as JSON in the `Schedule` entity) gains an `operators` array:

```
TaskAssignment (existing VO, extended) {
  taskId: string
  targetId: string          // station or provider ID
  isOutsourced: boolean
  scheduledStart: datetime
  scheduledEnd: datetime
  operators: [              // ← NEW: operators assigned by the scheduling engine
    { operatorId: string, attention: float }
  ]
  isCompleted: boolean
  isPinned: boolean
}
```

- Array supports multi-operator machines (e.g. Hohner needs 2 operators)
- Empty array = no operator assigned (manual placement or outsourced task)
- No DB migration needed — assignments are stored as JSON in the Schedule entity
- Backward compatible: existing assignments without `operators` default to empty array on read

### 6.5 — ScheduleSnapshot extension (operators)

The ScheduleSnapshot DTO gains `operators[]` so both Gantt views have all the data they need:

```
ScheduleSnapshot {
  // existing: stations, categories, groups, providers, jobs, elements, tasks, assignments, conflicts, lateJobs
  operators: Operator[]     // ← NEW: all operators with skills + schedules
}
```

### 6.6 — Schedule Output (Rust engine response)

```
// Rust engine input
ComputeRequest {
  stations: Vec<StationInput>       // Existing attrs + extended attrs
  operators: Vec<OperatorInput>     // With skills and schedules
  jobs: Vec<JobInput>               // With elements, tasks, deadlines
  constraints: Vec<ConstraintInput> // Scheduling constraints
  options: ComputeOptions           // Horizon, tick, FBI max iterations
}

// Rust engine output
ScheduleResult {
  assignments: Vec<ComputedAssignment>
  stats: ScheduleStats
  warnings: Vec<Warning>
  fbiIterations: u32
  computeTimeMs: u64
}

ComputedAssignment {
  taskId: string
  stationId: string
  scheduledStart: DateTime
  scheduledEnd: DateTime
  operators: Vec<OperatorAssignment>
  phases: Vec<PhaseBlock>           // Setup block + run block(s)
  isDegraded: bool
  effectiveProductivity: f64
  chunkInfo: Option<ChunkInfo>      // If pre-split: "2/3", original task ID
}

OperatorAssignment {
  operatorId: string
  from: DateTime
  to: DateTime
  attention: f64
}
```

---

## 7. Technical Architecture

### 7.1 — Rust Engine Structure

```
flux-scheduler/
├── Cargo.toml
├── src/
│   ├── main.rs                    # HTTP server (axum), single POST /compute endpoint
│   ├── input.rs                   # Deserialization of ComputeRequest
│   ├── output.rs                  # Serialization of ScheduleResult
│   ├── model/
│   │   ├── mod.rs
│   │   ├── station.rs             # Station with attention, tick, peremption
│   │   ├── operator.rs            # Operator with skills and schedule
│   │   ├── job.rs                 # Job with deadline
│   │   ├── action.rs              # Action (task) with setup/run, predecessors
│   │   └── constraint.rs          # Scheduling constraints
│   ├── engine/
│   │   ├── mod.rs                 # Top-level: compute(request) → ScheduleResult
│   │   ├── backward_pass.rs       # LAST computation
│   │   ├── forward_pass.rs        # Chronological scheduling + sub-loop
│   │   ├── scoring.rs             # Calage bonus + LAST urgency
│   │   ├── attention.rs           # Operator attention allocation + recalc
│   │   ├── peremption.rs          # Setup peremption tracking
│   │   ├── pre_split.rs           # Long task splitting (Phase 3)
│   │   ├── fbi.rs                 # Feedback-based improvement loop (Phase 3)
│   │   └── grid.rs                # Core: flat 2D time×resource arrays
│   └── validation.rs              # Input validation before compute
└── tests/
    ├── backward_pass_tests.rs
    ├── forward_pass_tests.rs
    ├── scoring_tests.rs
    ├── attention_tests.rs
    ├── peremption_tests.rs
    ├── pre_split_tests.rs
    ├── fbi_tests.rs
    └── integration/
        ├── small_shop.rs          # 3 machines, 3 operators, 20 actions
        ├── medium_shop.rs         # 10 machines, 8 operators, 500 actions
        └── full_scale.rs          # 15 machines, 15 operators, 2000 actions
```

### 7.2 — Core Data Structure: Schedule Grid

The algorithm's hot path is "is slot T available for machine M / operator O?" — millions of lookups per run.

```rust
struct ScheduleGrid {
    num_stations: usize,
    num_operators: usize,
    num_slots: usize,

    // What action occupies each station×slot (None = free)
    station_slots: Vec<Option<ActionId>>,     // [num_stations × num_slots]

    // What each operator is doing at each slot
    operator_slots: Vec<Option<Assignment>>,   // [num_operators × num_slots]

    // Attention given by each operator to each station at each slot
    // Indexed: [operator * num_stations * num_slots + station * num_slots + slot]
    attention: Vec<f64>,                       // [num_operators × num_stations × num_slots]
}
```

Flat arrays for cache-friendly access. At 15 stations x 15 operators x 2,500 slots, the attention grid is 562,500 f64 values = ~4.3 MB. Fits in L3 cache.

### 7.3 — PHP API Changes

| What | Phase | Description |
|------|-------|-------------|
| Station entity | 1A | Add 5 nullable columns + getters/setters/API fields |
| Operator entity | 1B | New entity, repository, controller, API resource |
| OperatorSkill entity | 1B | New join entity |
| ScheduleController | 2 | New `POST /api/schedule/compute` — assembles payload, calls Rust |
| Constraint entity | 4 | New entity, repository, controller, API resource |

### 7.4 — API Endpoints

| Method | Path | Description | Phase |
|--------|------|-------------|-------|
| GET/PUT | `/api/stations/:id` | Extended with attention/tick/peremption fields | 1A |
| CRUD | `/api/operators` | Operator management | 1B |
| GET/POST | `/api/operators/:id/skills` | Operator-station skill assignments | 1B |
| POST | `/api/schedule/compute` | Assemble payload → call Rust → return result | 2 |
| CRUD | `/api/scheduling-constraints` | Manage constraints | 4 |

Rust engine exposes only: `POST /compute` (called by PHP API, not by frontend).

---

## 8. Resolved Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Compute engine language | Rust | 1,000-2,000 actions require < 5s interactive response |
| Rust service architecture | Stateless compute (no database) | Pure function: JSON in → JSON out. Easy to test, deploy, scale. No data duplication |
| Data ownership | PHP API + PostgreSQL | Single source of truth. New entities (Operator, extended Station attrs, Constraints) live in existing DB via Doctrine migrations |
| Frontend-to-backend | Frontend → PHP API only | PHP API orchestrates. No direct frontend → Rust calls |
| Pre-split threshold | Per-machine (`maxChunkMinutes`) | Different machines have different job lengths and setup costs |
| Outsourced actions | Precedence delay node | No machine/operator consumed, just a time gap in the chain |
| Same-machine masked-time prep | Not possible | Machine physically occupied during run phase (paper in feeder, plates mounted). Setup = fixed duration |
| Algorithm implementation | Complete from the start (Phase 2) | Peremption and masked time are integral to the forward pass, not add-on layers |
| Testing approach | Unit tests per mechanism + integration tests at scale | Validate scoring, attention, peremption independently. Integration tests at 3 scales (20, 500, 2000 actions) |
| LAST safety check | Unconditional at every Ut | Fires in both resource-available and resource-unavailable branches of the sub-loop (confirmed by Julien 2026-04-04) |
| Backward pass operator check | Checks operator availability | At least one qualified operator on shift — static schedule check, no forward-pass dependency |
| Calage scoring formula | Count of matched SimilarityCriteria | Reuses existing SimilarityCriterion system per station category |
| Productivity in degraded mode | ART decrements by tick × productivity | productivity = min(attention_received / attention_required, 1.0) |
| Masked time productivity | Fixed per-machine value (maskedProductivity) | Not proportional to attention ratio — small fixed loss (e.g. 0.95) for freeing operator |
| Station availability | Driven by operator schedules | Machines have no independent availability schedule — available when an operator is available |
| Operator totalAttention | Always 1.0, not configurable | Operator attention budget is constant. Part-time = fewer hours (schedule), not less attention |
| Operator identity | firstName + lastName + role | Split from single `name` field. Role is optional (e.g. "Conducteur offset") |
| Run phase productivity (no masked time) | Proportional: min(attention_received / attentionRun, 1.0) | Uses `attentionRun` field on station — separate from masked time attention |
| Operator on TaskAssignment | `operators: [{operatorId, attention}]` array on existing TaskAssignment VO | Supports multi-operator machines (Hohner=2.0). Both Gantt views read from same data. No separate entity. |
| Single snapshot for all views | `operators[]` added to ScheduleSnapshot | Station Gantt, operator Gantt, and flux page all read from one snapshot. No separate operator fetch. |
| Station/Operator views | Two separate pages, same snapshot | SchedulingGrid too coupled to stations for generic refactor. Two pages sharing sub-components (TimelineColumn, Tile, UnavailabilityOverlay). Sidebar navigation. |
| Compute → persist | PHP clears non-pinned assignments, creates new ones with operators array | Schedule entity is the single source of truth. Engine output is persisted, not transient. Same as Ctrl+Alt+Z then place. |
| Compute: no confirmation | "Calculer" immediately replaces the schedule | Non-pinned/non-completed assignments are cleared. Pinned and completed tiles are preserved. |
| Validator unchanged for MVP | Engine handles operator conflicts | Validator continues to check station-level conflicts only. Operator double-booking is prevented by the engine. |
| Multi-operator tile display | Operator names comma-separated | "Paul, Emma" on the tile. Station Gantt shows operator names; operator Gantt shows station name. |
| 100% placement guarantee | Algorithm NEVER leaves tasks unscheduled | Runs until sum(ART)=0. Dynamic grid (starts 14 days, grows by 7 as needed). Tasks may be late but are ALL placed. |
| Dynamic schedule duration | No fixed horizon — schedule is as long as needed | Grid extends automatically when tasks remain. Result could be 3 days or 45 days. No arbitrary cutoff. |
| Scoring: continuous urgency | Replaces binary LAST=T → 9999 | Gradual escalation: urgency = f(slack). Late tasks get urgency > 10000 proportional to how late they are. |
| Scoring: job-level urgency | Job slack propagates to all remaining tasks | If a job is globally behind, ALL its remaining tasks get boosted — not just the one whose LAST approaches. |
| Masked time visual | Badge icon on tile (not pattern/opacity) | Small icon (👁) in corner of tile during masked time run phase. Discreet, low visual noise. |

---

## 9. Post-Implementation Cleanup

| Task | Description |
|------|-------------|
| Update @flux/schedule-validator | The validator currently uses station operating schedules for conflict detection. Once the operator scheduling algorithm is in place, update the validator to use operator schedules instead of (or in addition to) station schedules for availability checks. |
