# Operator Data Model — MVP Specification

> **Status:** Draft
> **Scope:** MVP — binary skills with primary/secondary preference, uniform productivity (1.0)
> **V2 extension:** Variable productivity coefficients per operator-station pair

## Table of Contents

1. [Overview](#1-overview)
2. [New Enums](#2-new-enums)
3. [New Entities](#3-new-entities)
4. [Modified Entities](#4-modified-entities)
5. [TypeScript Types](#5-typescript-types)
6. [API Surface](#6-api-surface)
7. [Business Rules](#7-business-rules)
8. [New Conflict Types](#8-new-conflict-types)
9. [Auto-Assign Algorithm](#9-auto-assign-algorithm)
10. [ScheduleSnapshot Changes](#10-schedulesnapshot-changes)
11. [Frontend Integration Points](#11-frontend-integration-points)
12. [Database Schema](#12-database-schema)
13. [V2 Extension Path](#13-v2-extension-path)
14. [MVP Known Limitations](#14-mvp-known-limitations)

---

## 1. Overview

### What changes

The scheduling system moves from a pure station-centric model to a station + operator model. Operators are workshop personnel who physically operate machines. Each operator:

- Has a weekly work schedule (reuses the existing `OperatingSchedule` value object)
- Has absence periods (vacation, sick leave, training)
- Has binary skills: can or cannot work a given station
- Has a primary station preference used for auto-assignment tie-breaking
- Has uniform productivity = 1.0 (no duration variability in MVP)

### What does NOT change

- Station scheduling (autoplace Phase 1) is unchanged — reference durations, same algorithm
- Tile durations are not affected by operator assignment
- Operator assignment is fully optional — tasks can run without an assigned operator
- Outsourced tasks never have operators

### Relationship to User entity

An `Operator` is NOT the same as a `User`. An Operator represents a physical person in the workshop. They MAY have a linked User account (for Flux Dashboard access), but many operators will not have system accounts. The link is optional via `Operator.userId`.

> **User deletion:** If a linked `User` is deleted, `Operator.userId` becomes a stale GUID. The operator continues functioning without a system account link. A `UserDeleted` listener may clear the reference in a future release; for MVP, the orphaned GUID is harmless (userId is only used for dashboard access linking).

---

## 2. New Enums

> **Casing convention:** `OperatorStatus` uses PascalCase values (`Active`, `Inactive`) as display labels. `AbsenceType` uses lowercase values (`vacation`, `sick`) as machine-readable slugs. This is a deliberate distinction matching the codebase convention for status vs type enums.

### `OperatorStatus`

```php
enum OperatorStatus: string
{
    case Active = 'Active';
    case Inactive = 'Inactive';

    public function canBeAssigned(): bool
    {
        return $this === self::Active;
    }
}
```

### `AbsenceType`

```php
enum AbsenceType: string
{
    case Vacation = 'vacation';
    case Sick = 'sick';
    case Training = 'training';
    case Other = 'other';      // Catch-all for infrequent absence types (jury duty, family leave, etc.).
                                // If a reason appears frequently in reports, add a dedicated enum value.
}
```

---

## 3. New Entities

### 3.1. `Operator` (Aggregate Root)

```php
/**
 * Operator aggregate root.
 *
 * Represents a workshop operator who can work on one or more stations.
 * Operators have weekly work schedules, absences, and station skills
 * with a primary station preference for auto-assignment tie-breaking.
 *
 * NOT the same as User: an Operator represents a physical person in the
 * workshop. They MAY have a linked User account (for Flux Dashboard access).
 *
 * Business Rules:
 * - BR-OPER-001: Operator must have a unique name
 * - BR-OPER-002: Operator must have an operating schedule (work hours)
 * - BR-OPER-008: Operator assignment is optional — tasks can run without one
 * - BR-OPER-009: Outsourced tasks never have operator assignments
 */
#[ORM\Entity(repositoryClass: OperatorRepository::class)]
#[ORM\Table(name: 'operators')]
#[ORM\Index(name: 'idx_operator_status', columns: ['status'])]
#[ORM\Index(name: 'idx_operator_user', columns: ['user_id'])]
#[ORM\HasLifecycleCallbacks]
class Operator implements HasDomainEvents
{
    use RecordsDomainEvents;

    #[ORM\Id]
    #[ORM\Column(type: 'guid')]
    private string $id;

    /** Full name, e.g., "Jean Dupont" */
    #[ORM\Column(length: 100, unique: true)]
    private string $name;

    /** 2-3 character label for tile badges, e.g., "JD" */
    #[ORM\Column(length: 3)]
    private string $initials;

    /** Hex color for UI identification, e.g., "#6366F1" */
    #[ORM\Column(length: 7)]
    private string $color;

    #[ORM\Column(length: 20, enumType: OperatorStatus::class)]
    private OperatorStatus $status;

    /**
     * Optional link to a system User (for Flux Dashboard access).
     * Null if operator has no system account.
     */
    #[ORM\Column(name: 'user_id', type: 'guid', nullable: true)]
    private ?string $userId = null;

    /** Auto-assigned on creation: MAX(displayOrder) + 1 across all operators. */
    #[ORM\Column(name: 'display_order', type: 'integer', options: ['default' => 0])]
    private int $displayOrder = 0;

    /**
     * Weekly work schedule — same structure as Station.operatingSchedule.
     * Defines when this operator is available to work.
     *
     * @var array<string, array{isOperating: bool, slots: list<array{start: string, end: string}>}>|null
     */
    #[ORM\Column(name: 'operating_schedule', type: 'json', nullable: true)]
    private ?array $operatingSchedule = null;

    /**
     * @var Collection<int, OperatorSkill>
     */
    #[ORM\OneToMany(
        targetEntity: OperatorSkill::class,
        mappedBy: 'operator',
        cascade: ['persist', 'remove'],
        orphanRemoval: true
    )]
    private Collection $skills;

    /**
     * @var Collection<int, OperatorAbsence>
     */
    #[ORM\OneToMany(
        targetEntity: OperatorAbsence::class,
        mappedBy: 'operator',
        cascade: ['persist', 'remove'],
        orphanRemoval: true
    )]
    #[ORM\OrderBy(['startDate' => 'ASC'])]
    private Collection $absences;

    #[ORM\Column(name: 'created_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(name: 'updated_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $updatedAt;
}
```

#### Key Methods

| Method | Signature | Notes |
|--------|-----------|-------|
| Constructor | `__construct(id, name, initials, color?, status=Active)` | Auto-generates color from palette if not provided |
| `getEffectiveScheduleForDate` | `(DateTimeInterface): DaySchedule` | Same logic as Station — no absence check here |
| `isAvailableOn` | `(DateTimeInterface): bool` | Checks: status=Active AND not absent AND operating |
| `isAbsentOn` | `(DateTimeInterface): bool` | True if any absence covers this date |
| `isAbsentDuring` | `(DateTimeImmutable $start, DateTimeImmutable $end): bool` | True if any absence overlaps the range (range-overlap logic, see §9 Implementation Notes). Used by auto-assign. |
| `isWorkingDuring` | `(DateTimeImmutable $start, DateTimeImmutable $end, OperatingSchedule $stationSchedule): bool` | True if operator is available during the intersection of task time and station operating hours on every operating day in the range (see §9 formal definition). Used by auto-assign. |
| `hasSkillFor` | `(string $stationId): bool` | Checks skills collection |
| `isPrimaryFor` | `(string $stationId): bool` | True if skill exists AND isPrimary |
| `getSkillFor` | `(string $stationId): ?OperatorSkill` | Returns skill or null |
| `addSkill` | `(OperatorSkill): void` | If new skill has isPrimary=true, auto-clears isPrimary on the previous primary skill (does not reject). Enforces at most one isPrimary invariant. |
| `removeSkillFor` | `(string $stationId): void` | Removes from collection |
| `addAbsence` | `(OperatorAbsence): void` | Validates no overlapping absences. Overlap detection uses range-overlap: `existing.startDate <= new.endDate AND existing.endDate >= new.startDate`. Since both dates are **inclusive**, two absences sharing a boundary date (e.g., A ends March 15, B starts March 15) DO overlap and are rejected. |
| `removeAbsence` | `(string $absenceId): void` | |
| `static generateInitials` | `(string $name): string` | "Jean Dupont" → "JD", "Pierre" → "PI", "Jean-Pierre" → "JP", "O'Brien" → "OB". Strips non-alpha (accented chars like é/ü are transliterated to ASCII via `Transliterator::create('Any-Latin; Latin-ASCII')` from the intl extension, which Symfony already requires), first+last word initials, min 2 chars. Single-character names (e.g., "A") are padded with a repeat: "AA". |

> **OperatingSchedule pattern:** The entity stores the schedule as raw JSON (`?array`) in the DB column, matching the `Station` entity pattern. Business logic methods (e.g., `getEffectiveScheduleForDate()`) hydrate this into the `OperatingSchedule` / `DaySchedule` value objects. Operators and Stations share these VOs by design — changes to the VO propagate to both aggregates.
>
> **Timezone convention:** All time slots in `operatingSchedule` (e.g., `"start": "06:00"`) are in the **workshop's local timezone** (configured via the `app.business_timezone` Symfony parameter, hardcoded to `'Europe/Paris'` in `services.yaml`, injected via `#[Autowire('%app.business_timezone%')]`), matching the existing Station schedule convention. The PHP backend normalizes to UTC for storage and comparison where needed. The auto-assign algorithm (§9) must convert UTC `TaskAssignment.scheduledStart`/`scheduledEnd` to the workshop's local timezone before comparing against operating schedule time slots — following the same inline timezone conversion pattern that `EndTimeCalculator` uses: inject the `app.business_timezone` parameter and call `$date->setTimezone($this->businessTimezone)`. (`BusinessCalendar` is a weekday-calculation utility only — it has no timezone conversion capability.)

#### Color Palette

10 colors, chosen to be visually distinct from the Job color palette (`Job::COLOR_PALETTE`: `#E53935` red, `#1E88E5` blue, `#43A047` green, `#FB8C00` orange, `#8E24AA` purple, `#00ACC1` cyan, `#FDD835` yellow, `#6D4C41` brown, `#546E7A` blue-grey, `#D81B60` pink).

> **Color uniqueness:** Color is NOT unique-constrained in the database. With 10 palette colors and potentially more than 10 operators, collisions are expected. The auto-assignment logic picks the next unused color from the palette when possible; if all 10 are taken, it cycles. Operators are primarily disambiguated by their **initials**, not color alone.

```php
private const COLOR_PALETTE = [
    '#6366F1', // indigo (distinct from Job blue #1E88E5)
    '#14B8A6', // teal (distinct from Job cyan #00ACC1 — green-shifted)
    '#8B5CF6', // violet (distinct from Job purple #8E24AA — lighter)
    '#84CC16', // lime (no Job equivalent)
    '#0EA5E9', // sky (no Job equivalent — lighter than Job blue)
    '#F472B6', // pink-300 (distinct from Job pink #D81B60 — lighter/softer)
    '#FBBF24', // amber (distinct from Job yellow #FDD835 — warmer)
    '#34D399', // emerald (distinct from Job green #43A047 — lighter)
    '#A78BFA', // purple-400 (no Job equivalent — pastel range)
    '#FB923C', // orange-400 (distinct from Job orange #FB8C00 — lighter)
];
```

---

### 3.2. `OperatorSkill` (Entity within Operator)

```php
/**
 * An operator's ability to work a specific station.
 *
 * MVP: all skills have implicit productivity = 1.0.
 * The isPrimary flag is used purely for auto-assignment tie-breaking:
 * when multiple operators can work a station, prefer the one whose
 * primary matches.
 *
 * Business Rules:
 * - BR-OPER-003: Operator can only be assigned to a station they have a skill for
 * - BR-OPER-007: Auto-assign prefers operator whose primary station matches
 * - BR-OPER-010: At most one skill per operator can be marked isPrimary
 * - BR-OPER-011: An operator cannot have two skills for the same station
 *
 * V2 extension point: add `productivity: float` (default 1.0)
 */
#[ORM\Entity]
#[ORM\Table(name: 'operator_skills')]
#[ORM\UniqueConstraint(name: 'uq_operator_station', columns: ['operator_id', 'station_id'])]
class OperatorSkill
{
    #[ORM\Id]
    #[ORM\Column(type: 'guid')]
    private string $id;

    #[ORM\ManyToOne(targetEntity: Operator::class, inversedBy: 'skills')]
    #[ORM\JoinColumn(
        name: 'operator_id',
        referencedColumnName: 'id',
        nullable: false,
        onDelete: 'CASCADE'
    )]
    private Operator $operator;

    /** Station this operator can work on */
    #[ORM\Column(name: 'station_id', type: 'guid')]
    private string $stationId;

    /**
     * Whether this is the operator's primary (home) station.
     * Used for tie-breaking during auto-assignment.
     * At most one skill per operator can be primary.
     */
    #[ORM\Column(name: 'is_primary', type: 'boolean', options: ['default' => false])]
    private bool $isPrimary = false;

    // V2: #[ORM\Column(type: 'float', options: ['default' => 1.0])]
    // private float $productivity = 1.0;

    #[ORM\Column(name: 'created_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(name: 'updated_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $updatedAt;
}
```

---

### 3.3. `OperatorAbsence` (Entity within Operator)

```php
/**
 * A period when an operator is unavailable.
 *
 * Covers multi-day absences (vacation, sick leave, training).
 * Both startDate and endDate are inclusive (full-day granularity).
 *
 * Business Rules:
 * - BR-OPER-005: Operator cannot be assigned to a task during an absence
 * - BR-OPER-012: Absence periods for the same operator must not overlap
 */
#[ORM\Entity]
#[ORM\Table(name: 'operator_absences')]
#[ORM\Index(name: 'idx_absence_dates', columns: ['operator_id', 'start_date', 'end_date'])]
class OperatorAbsence
{
    #[ORM\Id]
    #[ORM\Column(type: 'guid')]
    private string $id;

    #[ORM\ManyToOne(targetEntity: Operator::class, inversedBy: 'absences')]
    #[ORM\JoinColumn(
        name: 'operator_id',
        referencedColumnName: 'id',
        nullable: false,
        onDelete: 'CASCADE'
    )]
    private Operator $operator;

    /** First day of absence (inclusive) */
    #[ORM\Column(name: 'start_date', type: 'date_immutable')]
    private \DateTimeImmutable $startDate;

    /** Last day of absence (inclusive) */
    #[ORM\Column(name: 'end_date', type: 'date_immutable')]
    private \DateTimeImmutable $endDate;

    #[ORM\Column(length: 20, enumType: AbsenceType::class)]
    private AbsenceType $type;

    /** Optional reason / note */
    #[ORM\Column(length: 255, nullable: true)]
    private ?string $reason = null;

    #[ORM\Column(name: 'created_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(name: 'updated_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $updatedAt;
}
```

#### Key Method

```php
// Note: String comparison of Y-m-d dates works correctly for date-only absences.
// V2b adds time components → refactor to coversDateTime(DateTimeInterface).
public function coversDate(\DateTimeInterface $date): bool
{
    $d = $date->format('Y-m-d');
    return $d >= $this->startDate->format('Y-m-d')
        && $d <= $this->endDate->format('Y-m-d');
}
```

> **MVP Limitation — Full-Day Absence Granularity:** `OperatorAbsence` uses DATE type (no time component). Half-day absences (e.g., leaving at noon for an appointment) cannot be represented. See §13 V2 Extension Path for planned sub-day absence support.

---

## 4. Modified Entities

### 4.1. `TaskAssignment` — add optional `operatorId`

```php
final readonly class TaskAssignment implements \JsonSerializable
{
    public function __construct(
        public string $taskId,
        public string $targetId,
        public bool $isOutsourced,
        public \DateTimeImmutable $scheduledStart,
        public ?\DateTimeImmutable $scheduledEnd = null,
        public bool $isCompleted = false,
        public ?\DateTimeImmutable $completedAt = null,
        public ?string $operatorId = null,          // <-- NEW
    ) {
        $this->validate();
    }
```

#### New factory method

```php
/**
 * Create a new TaskAssignment with a different operator.
 */
public function withOperator(?string $operatorId): self
{
    return new self(
        taskId: $this->taskId,
        targetId: $this->targetId,
        isOutsourced: $this->isOutsourced,
        scheduledStart: $this->scheduledStart,
        scheduledEnd: $this->scheduledEnd,
        isCompleted: $this->isCompleted,
        completedAt: $this->completedAt,
        operatorId: $operatorId,
    );
}
```

#### Updated `fromArray` (backward compatible)

```php
public static function fromArray(array $data): self
{
    return new self(
        taskId: $data['taskId'],
        targetId: $data['targetId'],
        isOutsourced: $data['isOutsourced'],
        scheduledStart: new \DateTimeImmutable($data['scheduledStart']),
        scheduledEnd: isset($data['scheduledEnd']) ? new \DateTimeImmutable($data['scheduledEnd']) : null,
        isCompleted: $data['isCompleted'] ?? false,
        completedAt: isset($data['completedAt']) ? new \DateTimeImmutable($data['completedAt']) : null,
        operatorId: $data['operatorId'] ?? null,    // <-- backward compatible
    );
}
```

#### Updated `jsonSerialize`

```php
public function jsonSerialize(): array
{
    return [
        'taskId' => $this->taskId,
        'targetId' => $this->targetId,
        'isOutsourced' => $this->isOutsourced,
        'scheduledStart' => $this->scheduledStart->format(\DateTimeInterface::ATOM),
        'scheduledEnd' => $this->scheduledEnd?->format(\DateTimeInterface::ATOM),
        'isCompleted' => $this->isCompleted,
        'completedAt' => $this->completedAt?->format(\DateTimeInterface::ATOM),
        'operatorId' => $this->operatorId,          // <-- nullable
    ];
}
```

#### Validation addition

```php
private function validate(): void
{
    // ... existing validations ...

    // BR-OPER-009: outsourced tasks cannot have operators
    if ($this->isOutsourced && $this->operatorId !== null) {
        throw new \InvalidArgumentException(
            'Outsourced tasks cannot have an operator assignment.'
        );
    }
}
```

All existing methods (`forStation()`, `forProvider()`, `withCompletionToggled()`, `withScheduledEnd()`) propagate `operatorId` unchanged via immutable carry-through.

#### New `Schedule` methods

```php
/**
 * Returns all non-outsourced assignments (internal station tasks).
 * Convenience filter over getAssignments(): excludes isOutsourced=true.
 * Includes both completed and non-completed tasks.
 *
 * @return list<TaskAssignment>
 */
public function getInternalAssignments(): array

/**
 * Update ONLY the operatorId on an existing assignment without changing
 * scheduledStart/scheduledEnd/targetId. Used by auto-assign to set operators
 * without implying a placement change.
 *
 * Finds the assignment by taskId, replaces it with $assignment (which has
 * operatorId set via withOperator()). Increments schedule version.
 *
 * @throws \InvalidArgumentException if no assignment exists for the taskId
 */
public function updateOperatorAssignment(TaskAssignment $assignment): void
```

---

### 4.2. `PlacementContext` — add operator indexes (for auto-assign algorithm)

> **Note:** These operator indexes are used by the PHP-side auto-assign algorithm (§9), not by the validation pipeline. The validation pipeline runs in the TypeScript `@flux/schedule-validator` package (`packages/validator/`) and receives operator data via the `ScheduleSnapshot`.

```php
class PlacementContext
{
    public function __construct(
        // ... existing params ...
        public array $stationMap = [],
        public array $assignmentsByStation = [],
        public array $tasksByElement = [],
        public array $isPrintingStation = [],
        public array $taskMap = [],
        public array $criteriaByStation = [],

        // NEW — operator indexes
        /** @var array<string, Operator> Operators keyed by ID */
        public array $operatorMap = [],
        /** @var array<string, list<OperatorSkill>> Skills keyed by stationId */
        public array $skillsByStation = [],
        /** @var array<string, list<TaskAssignment>> Assignments keyed by operatorId, sorted by start */
        public array $assignmentsByOperator = [],
    ) {
    }
```

#### New methods

```php
/**
 * Get available operators for a station during a time window.
 *
 * Filters by: has skill for station, status Active, has operating schedule (non-null),
 * not absent, operating schedule covers the window (intersected with station schedule —
 * operator only required during station operating hours), not already busy.
 *
 * @return list<Operator> Sorted: primary first, then by skill count ASC (specialists first)
 */
public function getAvailableOperators(
    string $stationId,
    \DateTimeImmutable $start,
    \DateTimeImmutable $end,
): array

/**
 * Insert operator assignment into the sorted assignmentsByOperator index.
 */
public function addOperatorAssignment(TaskAssignment $assignment): void

/**
 * Remove operator assignment from the index.
 */
public function removeOperatorAssignment(string $taskId, string $operatorId): void
```

---

## 5. TypeScript Types

### 5.1. `operator.ts` (new file in `packages/types/src/`)

```typescript
import type { OperatingSchedule } from './station.js';

/** Status of an operator */
export type OperatorStatus = 'Active' | 'Inactive';

/** Absence type */
export type AbsenceType = 'vacation' | 'sick' | 'training' | 'other';

/** An operator's ability to work a specific station */
export interface OperatorSkill {
  id: string;
  /** Station this operator can work on */
  stationId: string;
  /** Whether this is the operator's primary (home) station */
  isPrimary: boolean;
  // V2: productivity: number;
}

/** A period when an operator is unavailable */
export interface OperatorAbsence {
  id: string;
  /** First day of absence (ISO date, inclusive) */
  startDate: string;
  /** Last day of absence (ISO date, inclusive) */
  endDate: string;
  /** Type of absence */
  type: AbsenceType;
  /** Optional reason */
  reason?: string;
}

/** A workshop operator who can work on stations */
export interface Operator {
  id: string;
  /** Full name */
  name: string;
  /** 2-3 character label for tile badges */
  initials: string;
  /** Hex color for UI identification */
  color: string;
  status: OperatorStatus;
  /** Linked user ID (for Flux Dashboard), null if no system account. Always present in JSON (PHP emits the key with null value). */
  userId: string | null;
  /** Display order in operator lists/columns */
  displayOrder: number;
  /** Weekly work schedule (reuses station schedule structure), null if not yet configured */
  operatingSchedule: OperatingSchedule | null;
  /** Stations this operator can work on */
  skills: OperatorSkill[];
  /** Absence periods */
  absences: OperatorAbsence[];
}
```

### 5.2. Modified `assignment.ts`

```typescript
export interface TaskAssignment {
  // ... all existing fields ...
  /** Operator assigned to this task (null = unassigned, always null for outsourced) */
  operatorId: string | null;
}

export type ConflictType =
  | 'StationMismatchConflict'
  | 'StationConflict'
  | 'GroupCapacityConflict'
  | 'PrecedenceConflict'
  | 'ApprovalGateConflict'
  | 'AvailabilityConflict'
  | 'DeadlineConflict'
  | 'OperatorSkillConflict'           // <-- NEW
  | 'OperatorAvailabilityConflict'   // <-- NEW
  | 'OperatorDoubleBookingConflict'; // <-- NEW (double-booking)

/**
 * Auto-assign event types — NOT part of the validation pipeline ConflictType.
 * Used only in SSE streaming events from the auto-assign endpoint.
 */
export type AutoAssignEventType = 'NoOperatorAvailableConflict';

export interface ScheduleSnapshot {
  // ... all existing fields ...
  /** All operators with skills and absences */
  operators: Operator[];            // <-- NEW
}
```

---

## 6. API Surface

> **Permissions:** Operator management endpoints (§6.1, §6.2, §6.3) require `settings.edit` permission (same as station management). Operator assignment endpoints (§6.4) and auto-assign (§6.5) require the same permission as task assignment (`schedule.edit`). The OP-08 admin page enforces `settings.edit` at the UI level.

### 6.1. Operator CRU (Create, Read, Update — no Delete) — `/api/v1/operators`

| Method | Endpoint | Input | Output | Notes |
|--------|----------|-------|--------|-------|
| `POST` | `/` | `CreateOperatorRequest` | `OperatorResponse` (201) | Auto-generates initials if not provided |
| `GET` | `/` | `?status=&search=&page=&limit=` | `OperatorListResponse` (200) | Paginated |
| `GET` | `/{id}` | — | `OperatorResponse` (200) | Includes skills + absences |
| `PUT` | `/{id}` | `UpdateOperatorRequest` | `OperatorResponse` (200) | Partial update with sentinel flags (omitted fields are unchanged; explicit `null` clears a nullable field — same pattern as `UpdateStationRequest`) |

> **No DELETE endpoint.** Operators cannot be physically deleted — use `status=Inactive` to decommission. This follows the same philosophy as Stations (which also have no delete endpoint). Inactive operators are excluded from auto-assign candidate lists and hidden from active operator views, but their historical assignment data is preserved.

#### `CreateOperatorRequest`

```php
class CreateOperatorRequest
{
    #[Assert\NotBlank]
    #[Assert\Length(max: 100)]
    public string $name;

    #[Assert\Length(max: 3)]
    public ?string $initials = null;        // auto-generated if omitted

    #[Assert\Regex(pattern: '/^#[0-9A-Fa-f]{6}$/')]
    public ?string $color = null;           // random from palette if omitted

    #[Assert\Choice(choices: ['Active', 'Inactive'])]
    public string $status = 'Active';

    #[Assert\Uuid]
    public ?string $userId = null;

    public ?array $operatingSchedule = null; // same format as station. Null at creation; operator cannot be assigned until configured (BR-OPER-002). Frontend should offer "Copy from station" or preset defaults (e.g., OperatingSchedule::defaultWeekday()).

    /** @var list<array{stationId: string, isPrimary?: bool}> */
    public array $skills = [];
}
```

#### `OperatorResponse`

```php
class OperatorResponse
{
    public function __construct(
        public readonly string $id,
        public readonly string $name,
        public readonly string $initials,
        public readonly string $color,
        public readonly string $status,
        public readonly ?string $userId,
        public readonly int $displayOrder,
        public readonly ?array $operatingSchedule,
        public readonly array $skills,      // [{id, stationId, isPrimary}]
        public readonly array $absences,    // [{id, startDate, endDate, type, reason}]
        public readonly string $createdAt,
        public readonly string $updatedAt,
    ) {}
}
```

### 6.2. Operator Skills — `/api/v1/operators/{id}/skills`

| Method | Endpoint | Input | Output | Notes |
|--------|----------|-------|--------|-------|
| `POST` | `/` | `{stationId, isPrimary?}` | `OperatorResponse` (200) | Validates station exists, enforces one-primary |
| `PUT` | `/{stationId}` | `{isPrimary}` | `OperatorResponse` (200) | Toggle primary |
| `DELETE` | `/{stationId}` | — | `OperatorResponse` (200) | Fails with 400 if operator has active non-completed assignments for this station (BR-OPER-013). Check: `operatorId` matches AND `targetId` matches AND `isCompleted = false` AND (`scheduledEnd >= now` OR `scheduledEnd IS NULL`). Completed tasks retain their operator for historical reference. |

### 6.3. Operator Absences — `/api/v1/operators/{id}/absences`

| Method | Endpoint | Input | Output | Notes |
|--------|----------|-------|--------|-------|
| `POST` | `/` | `CreateAbsenceRequest` | `OperatorResponse` (200) | Validates no overlap |
| `GET` | `/` | `?from=&to=` | `AbsenceListResponse` (200) | Date range filter. No pagination in MVP (typically few absences per operator). Frontend should default the `from` parameter to the current date to avoid accumulating expired absences in responses. |
| `PUT` | `/{absenceId}` | `UpdateAbsenceRequest` | `OperatorResponse` (200) | |
| `DELETE` | `/{absenceId}` | — | `OperatorResponse` (200) | |

#### `CreateAbsenceRequest`

```php
class CreateAbsenceRequest
{
    #[Assert\NotBlank]
    #[Assert\Date]
    public string $startDate;           // YYYY-MM-DD

    #[Assert\NotBlank]
    #[Assert\Date]
    public string $endDate;             // YYYY-MM-DD

    // Cross-field constraint (endDate >= startDate) enforced via #[Assert\Callback]
    // since inline attributes cannot reference other fields.

    #[Assert\Choice(choices: ['vacation', 'sick', 'training', 'other'])]
    public string $type;

    #[Assert\Length(max: 255)]
    public ?string $reason = null;
}
```

### 6.4. Operator Assignment on Tasks

#### Modified existing endpoint

`AssignTaskRequest` gains an optional field:

```php
class AssignTaskRequest
{
    // ... existing fields ...

    /** Optional operator assignment (validated against skill + availability) */
    #[Assert\Uuid]
    public ?string $operatorId = null;  // <-- NEW
}
```

#### New dedicated endpoints

| Method | Endpoint | Input | Output | Notes |
|--------|----------|-------|--------|-------|
| `PUT` | `/api/v1/tasks/{taskId}/operator` | `{operatorId}` | `AssignmentResponse` (200) | Assign operator to already-placed task |
| `DELETE` | `/api/v1/tasks/{taskId}/operator` | — | `AssignmentResponse` (200) | Remove operator from task |

### 6.5. Auto-Assign Operators — new endpoint

| Method | Endpoint | Input | Output | Notes |
|--------|----------|-------|--------|-------|
| `POST` | `/api/v1/schedule/auto-assign-operators` | `{scope?: 'all' \| 'unassigned'}` | SSE stream | Default: `unassigned` only. Returns **409 Conflict** if another SSE operation (autoplace, smart compaction) is currently running. |

#### SSE events

```
event: progress
data: {"phase": "assigning", "current": 12, "total": 45, "taskId": "...", "stationName": "Komori G37", "operatorName": "Jean Dupont"}

event: conflict
data: {"type": "NoOperatorAvailableConflict", "taskId": "...", "stationId": "...", "stationName": "Komori G37", "message": "No operator available for station Komori G37 during 2026-04-01 08:00-10:00"}

event: complete
data: {"assigned": 42, "conflicts": 3, "skipped": 0, "durationMs": 1234}

event: error
data: {"message": "...", "assignedBeforeFailure": 12}
```

---

## 7. Business Rules

| Rule | Type | Description |
|------|------|-------------|
| **BR-OPER-001** | Hard | Operator must have a unique name |
| **BR-OPER-002** | Hard | Operator must have an operating schedule to be assignable (nullable at creation, enforced at assignment time). **Enforcement:** `OperatorAvailabilityConflict` with reason `'no_schedule'` in the TypeScript validator; auto-assign `getAvailableOperators()` filters out operators with null schedule. |
| **BR-OPER-003** | Hard | Operator can only be assigned to a station they have a skill for |
| **BR-OPER-004** | Hard | Operator can work at most one station at a time (no overlapping assignments) |
| **BR-OPER-005** | Hard | Operator cannot be assigned during an absence period |
| **BR-OPER-006** | Hard | Operator cannot be assigned outside their operating hours |
| **BR-OPER-007** | Soft | Auto-assign prefers operator whose primary station matches |
| **BR-OPER-008** | — | Operator assignment is optional — tasks can run without one |
| **BR-OPER-009** | Hard | Outsourced tasks never have operator assignments |
| **BR-OPER-010** | Hard | Each operator has at most one primary station (only one of their skills may have isPrimary=true). Enforcement: setting a new skill as primary auto-clears the previous primary (does not reject). |
| **BR-OPER-011** | Hard | An operator cannot have two skills for the same station |
| **BR-OPER-012** | Hard | Absence periods for the same operator must not overlap |
| **BR-OPER-013** | Hard | A skill cannot be removed while the operator has active non-completed assignments for that station (`isCompleted = false` AND (`scheduledEnd >= now` OR `scheduledEnd IS NULL`)). Completed tasks retain their operator for historical reference. |

---

## 8. New Conflict Types

> **Architecture note:** The validation pipeline runs in the TypeScript `@flux/schedule-validator` package (`packages/validator/`), not in the PHP API. Three new operator conflict types are implemented as TypeScript validators in that package, consistent with the existing 7 validator modules in `packages/validator/src/validators/` (note: the directory also contains `shared.ts` utility module, which is not a validator). The PHP API delegates validation via `ValidationServiceClient`. The PHP-side `OperatorAutoAssignService` (§9) reuses similar availability logic via `PlacementContext` helper methods (§4.2).
>
> **Duplication warning:** Availability-checking logic (absence overlap, operating hours, assignment overlap) will exist in both TypeScript (validators) and PHP (auto-assign). Changes to availability rules must be synchronized across both implementations. **Required mitigation (OP-05 scope):** Write a shared availability rules specification document (`docs/architecture/operator-availability-rules.md`) that both implementations reference, and add cross-referencing tests ensuring PHP and TypeScript logic agree on the same set of availability test vectors.

### `OperatorSkillConflict` (blocking)

Raised when an operator is assigned to a task on a station they have no skill for.

```typescript
// packages/validator/src/validators/operatorSkill.ts
export interface OperatorSkillConflict extends ScheduleConflict {
  type: 'OperatorSkillConflict';
  taskId: string;
  operatorId: string;
  stationId: string;
  message: string;   // "Operator {name} has no skill for station {station}"
}
```

### `OperatorAvailabilityConflict` (blocking)

Raised when an operator is assigned during an absence, outside their work hours, has no schedule configured, or is inactive.

```typescript
// packages/validator/src/validators/operatorAvailability.ts
export interface OperatorAvailabilityConflict extends ScheduleConflict {
  type: 'OperatorAvailabilityConflict';
  taskId: string;
  operatorId: string;
  reason: 'absence' | 'outside_hours' | 'no_schedule' | 'inactive';
  message: string;   // "Operator {name} on vacation {dates}" or
                      // "Operator {name} not working at {time}" or
                      // "Operator {name} has no operating schedule configured" or
                      // "Operator {name} is inactive"
}
```

### `OperatorDoubleBookingConflict` (blocking)

Raised when an operator is double-booked (two overlapping assignments).

```typescript
// packages/validator/src/validators/operatorDoubleBooking.ts
export interface OperatorDoubleBookingConflict extends ScheduleConflict {
  type: 'OperatorDoubleBookingConflict';
  taskId: string;
  relatedTaskId: string;  // the other task
  operatorId: string;
  message: string;   // "Operator {name} already working on {otherTask} at this time"
}
```

### `NoOperatorAvailableConflict` (informational — auto-assign only)

Emitted by the auto-assign algorithm (§9) when no candidate operator passes all filters for a task. This is NOT a validation pipeline conflict — it is only produced during auto-assign SSE streaming. The reason may be any combination of: no operator has the skill, all skilled operators are absent, outside hours, or already busy.

```typescript
// Used in auto-assign SSE events, not in packages/validator/
export interface NoOperatorAvailableConflict {
  type: 'NoOperatorAvailableConflict';
  taskId: string;
  stationId: string;
  message: string;   // "No operator available for station {station} during {time range}"
}
```

### Validation Pipeline Update

The `@flux/schedule-validator` (TypeScript, `packages/validator/`) pipeline extends from 7 to 10 validators:

```
 1. stationMatch.ts        (existing, blocking)
 2. station.ts             (existing, non-blocking with push-down)
 3. group.ts               (existing, blocking)
 4. precedence.ts          (existing, non-blocking with snap)
 5. approval.ts            (existing, warning)
 6. availability.ts        (existing, blocking)
 7. deadline.ts            (existing, blocking)
 8. operatorSkill.ts        <-- NEW (blocking)
 9. operatorAvailability.ts <-- NEW (blocking)
10. operatorDoubleBooking.ts <-- NEW (blocking)
```

Validators 8-10 only fire when `assignment.operatorId` is non-null. If null, they pass silently (BR-OPER-008).

---

## 9. Auto-Assign Algorithm

```
AUTO_ASSIGN_OPERATORS(schedule, operators, context, scope):

  // 1. Handle scope=all: clear ALL operatorIds upfront, then fall through to unassigned
  if scope === 'all':
    for each a in schedule.getInternalAssignments():
      if a.operatorId !== null && !a.isCompleted:
        schedule.updateOperatorAssignment(a.withOperator(null))
    // Now all non-completed internal assignments have operatorId === null.
    // Recovery: if clearing succeeds but reassignment fails partway,
    // re-running with scope=unassigned picks up remaining tasks.

  // 2. Get unassigned, non-completed tasks sorted chronologically
  targets = schedule.getInternalAssignments()
    .filter(a => a.operatorId === null && !a.isCompleted)
    .sortByStartTime()

  // 3. Build operator timeline from remaining assigned tasks
  operatorTimeline = {}  // operatorId -> sorted list of (start, end)
  for each a in schedule.getInternalAssignments() where a.operatorId !== null:
    operatorTimeline[a.operatorId].add(a.start, a.end)

  assigned = 0
  conflicts = []

  // 4. Process each target task
  for each assignment in targets:
    stationId = assignment.targetId

    // 4a. Find candidates: operators with skill for this station
    stationSchedule = context.stationMap[stationId].operatingSchedule
    candidates = operators
      .filter(o => o.status === Active)
      .filter(o => o.operatingSchedule !== null)             // BR-OPER-002
      .filter(o => o.hasSkillFor(stationId))
      .filter(o => !o.isAbsentDuring(assignment.start, assignment.end))
      .filter(o => o.isWorkingDuring(assignment.start, assignment.end, stationSchedule))
      .filter(o => !overlaps(operatorTimeline[o.id], assignment.start, assignment.end))

    if candidates.isEmpty():
      conflicts.push(NoOperatorAvailableConflict for assignment)
      continue

    // 4b. Rank candidates
    //   Priority 1: primary station match (prefer primary over secondary)
    //   Priority 2: fewest total skills (specialists first — save generalists)
    //   Priority 3: least loaded (fewest existing assignments — balance workload)
    //   Priority 4: operator ID (string comparison — guarantees determinism)
    candidates.sort((a, b) =>
      (b.isPrimaryFor(stationId) - a.isPrimaryFor(stationId))
      || (a.skills.length - b.skills.length)
      || (operatorTimeline[a.id].length - operatorTimeline[b.id].length)
      || a.id.localeCompare(b.id)
    )

    bestOperator = candidates[0]

    // 4c. Assign
    assignment = assignment.withOperator(bestOperator.id)
    schedule.updateOperatorAssignment(assignment)  // dedicated method; does NOT use rescheduleTask (which implies time/placement changes)
    operatorTimeline[bestOperator.id].add(assignment.start, assignment.end)
    assigned++

  return { assigned, conflicts }
```

### Implementation Notes

- `isAbsentDuring(start, end)` uses **range-overlap logic**: `absence.startDate <= task.endDate AND absence.endDate >= task.startDate`. This correctly detects absences that fall anywhere within a multi-day task span, not just on boundary dates.
- `isWorkingDuring(start, end, stationSchedule)` — formal definition: for each calendar day `d` in `[start.date, end.date]`, if `stationSchedule.isOperating(d)` is true, then the operator's schedule must also be operating on day `d`, AND the operator's time slots on day `d` must **fully contain** (be a superset of) the intersection of the task's time window with the station's operating slots on that day. Example: task 06:00-14:00, station operates 08:00-16:00, operator works 08:00-16:00 → intersection is 08:00-14:00, operator fully contains it → pass. If operator works 10:00-18:00 → intersection is 08:00-14:00, operator only covers 10:00-14:00 → fail (gap 08:00-10:00). The operator is NOT required on days the station does not operate. Examples: a task spanning Friday-to-Monday on a Mon-Fri station requires the operator on Friday and Monday only. A task spanning Monday-Wednesday requires the operator all three days (assuming the station operates all three).
- **Timezone:** Assignment times (`scheduledStart`/`scheduledEnd`) are in UTC. Operating schedule time slots are in the workshop's local timezone (`app.business_timezone`, default `Europe/Paris`). The algorithm must convert UTC to local time before comparing — following the same inline pattern as `EndTimeCalculator`: inject `app.business_timezone` and call `$date->setTimezone($this->businessTimezone)`. (`BusinessCalendar` is a weekday calculator — it has no timezone conversion capability.)

### Properties

- **Greedy, chronological, single-pass** — O(T x O) where T=tasks, O=operators
- **Deterministic:** same input always produces same output
- **No duration changes** in MVP (productivity = 1.0 uniform)
- **No cascading effects** — station schedule is untouched
- **Idempotent on re-run:** already-assigned tasks are skipped (scope=unassigned)
- **Progressive persistence:** Assignments are saved to the schedule incrementally (not wrapped in a single transaction). If the operation fails mid-way (DB error, timeout), completed assignments up to the failure point are persisted. The SSE `complete` event is only sent on full success; on failure, a `error` event is sent with the count of assignments completed before the failure. Re-running with `scope=unassigned` picks up where it left off.

### Interaction with Smart Compaction

Smart compaction moves tiles in time but does **not** clear or re-validate operator assignments. After smart compaction, an operator assignment that was valid before may become invalid (e.g., tile moved into operator's absence period or outside their working hours). **Recommended workflow:** run auto-assign after smart compaction to re-validate and fix operator assignments. The validation pipeline (§8) will flag any newly-introduced operator conflicts.

---

## 10. ScheduleSnapshot Changes

### Backend `SnapshotBuilder`

Add operators to full snapshot:

```php
// In buildFullSnapshot():
$operators = $this->operatorRepository->findAll();
$operatorData = array_map(
    fn (Operator $o) => $this->serializeOperator($o),
    $operators,
);

return new ScheduleSnapshot(
    // ... existing params ...
    operators: $operatorData,       // <-- NEW
);
```

### Serialized operator format

```json
{
  "id": "uuid",
  "name": "Jean Dupont",
  "initials": "JD",
  "color": "#6366F1",
  "status": "Active",
  "userId": null,
  "displayOrder": 0,
  "operatingSchedule": {
    "monday": { "isOperating": true, "slots": [{"start": "06:00", "end": "14:00"}] },
    "tuesday": { "isOperating": true, "slots": [{"start": "06:00", "end": "14:00"}] },
    "...": "..."
  },
  "skills": [
    { "id": "uuid", "stationId": "uuid", "isPrimary": true },
    { "id": "uuid", "stationId": "uuid", "isPrimary": false }
  ],
  "absences": [
    {
      "id": "uuid",
      "startDate": "2026-04-14",
      "endDate": "2026-04-25",
      "type": "vacation",
      "reason": "Summer holiday"
    }
  ]
}
```

> **Note:** `createdAt`/`updatedAt` are intentionally omitted from the snapshot serialization — they are not used by the frontend scheduling grid or validation pipeline. They are included only in the admin API (`OperatorResponse`).
>
> **Payload size impact:** Each serialized operator adds ~300-500 bytes (name, initials, color, schedule, skills, absences). With 20 operators: ~6-10 KB additional. With 50: ~15-25 KB. This is small relative to the existing snapshot (stations + assignments + jobs). If snapshot size becomes problematic, consider a separate `/api/v1/operators` fetch and client-side join rather than embedding in every snapshot.

### Serialized assignment format (updated)

```json
{
  "taskId": "uuid",
  "targetId": "uuid",
  "isOutsourced": false,
  "scheduledStart": "2026-03-26T08:00:00+00:00",
  "scheduledEnd": "2026-03-26T10:00:00+00:00",
  "isCompleted": false,
  "completedAt": null,
  "operatorId": "uuid"
}
```

Existing assignments without `operatorId` deserialize with `null` (backward compatible).

---

## 11. Frontend Integration Points

### 11.1. New RTK Query Slice: `operatorApi.ts`

```typescript
// Endpoints:
getOperators          // GET /operators
getOperator           // GET /operators/:id
createOperator        // POST /operators
updateOperator        // PUT /operators/:id (includes status changes — no delete endpoint)
addSkill              // POST /operators/:id/skills
removeSkill           // DELETE /operators/:id/skills/:stationId
updateSkill           // PUT /operators/:id/skills/:stationId
addAbsence            // POST /operators/:id/absences
getAbsences           // GET /operators/:id/absences?from=&to=
updateAbsence         // PUT /operators/:id/absences/:absenceId
removeAbsence         // DELETE /operators/:id/absences/:absenceId
assignOperator        // PUT /tasks/:taskId/operator
unassignOperator      // DELETE /tasks/:taskId/operator
autoAssignOperators   // POST /schedule/auto-assign-operators (SSE)
```

### 11.2. Tile Component Changes

- New optional prop: `operator?: Operator`
- Renders a small colored circle with initials in the top-right corner of the tile
- If `assignment.operatorId` is null: dashed outline circle (unassigned indicator)
- Tooltip shows operator name and primary/secondary status

### 11.3. SchedulingGrid Changes

- Build `operatorMap` lookup from `snapshot.operators`
- Pass operator to each `<Tile>` based on `assignment.operatorId`

### 11.4. New Components

| Component | Purpose | Release |
|-----------|---------|---------|
| `OperatorBadge` | Small colored circle with initials (reusable) | OP-06 |
| `OperatorManagementPage` | CRU page for operators (admin settings) | OP-08 |
| `AutoAssignModal` | SSE progress modal for auto-assign (same pattern as `SmartCompactModal`) | OP-10 |
| `OperatorPanel` | Side panel listing all operators, their status, skills, absences | Deferred (post-MVP) — overlaps with OP-11 timeline; evaluate after OP-11 whether a separate summary panel is needed |
| `AbsenceCalendar` | Calendar view showing operator absences | Deferred (post-MVP) — OP-08 AbsenceManager provides list-based management; calendar view is a UX enhancement |

### 11.5. Cascade Behavior — Operator Data Changes After Assignment

When an operator's **absences, operating schedule, or status** are modified after assignments already exist, **no proactive re-validation is triggered**. Existing operator assignments remain in place even if they now conflict with the updated availability.

This applies to:
- Adding/modifying absences that overlap existing assignments
- Changing operating schedule (e.g., day shift → night shift) that invalidates existing daytime assignments
- Setting status to **Inactive** — existing assignments are NOT automatically cleared

**Rationale:** Proactive cascade would require scanning all assignments across all schedules for a given operator, which is expensive and may produce surprising side effects.

**Discovery path:**
- The validation pipeline flags `OperatorAvailabilityConflict` on the next full validation pass (reason: `'absence'`, `'outside_hours'`, or `'inactive'` depending on the cause).
- The API SHOULD return a warning header (`X-Operator-Warning: N existing assignments may be affected`) on `PUT /api/v1/operators/{id}` (schedule or status changes), `POST /api/v1/operators/{id}/absences`, and `PUT /api/v1/operators/{id}/absences/{absenceId}`.
- The admin UI (OP-08) SHOULD display a toast with the affected assignment count and suggest re-running auto-assign.

**MVP scope:** The warning is informational only. No automatic reassignment or invalidation occurs.

---

## 12. Database Schema

```sql
CREATE TABLE operators (
    id CHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    initials VARCHAR(3) NOT NULL,
    color CHAR(7) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    user_id CHAR(36) DEFAULT NULL,
    display_order INT NOT NULL DEFAULT 0,
    operating_schedule JSON DEFAULT NULL,
    created_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
    updated_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
    PRIMARY KEY (id),
    UNIQUE KEY uq_operator_name (name),
    KEY idx_operator_status (status),
    KEY idx_operator_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE operator_skills (
    id CHAR(36) NOT NULL,
    operator_id CHAR(36) NOT NULL,
    station_id CHAR(36) NOT NULL,
    is_primary TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
    updated_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
    PRIMARY KEY (id),
    UNIQUE KEY uq_operator_station (operator_id, station_id),
    KEY idx_skill_station (station_id),
    CONSTRAINT fk_skill_operator FOREIGN KEY (operator_id)
        REFERENCES operators (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE operator_absences (
    id CHAR(36) NOT NULL,
    operator_id CHAR(36) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    type VARCHAR(20) NOT NULL,
    reason VARCHAR(255) DEFAULT NULL,
    created_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
    updated_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
    PRIMARY KEY (id),
    KEY idx_absence_dates (operator_id, start_date, end_date),
    CONSTRAINT fk_absence_operator FOREIGN KEY (operator_id)
        REFERENCES operators (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

No FK from `operator_skills.station_id` to `stations.id` — consistent with how `Task.stationId` is a plain GUID without FK (aggregate boundary isolation).

**Orphan cleanup strategy:** If a station is deleted, operator skills referencing it become stale. Recommended approach: implement a `StationDeletedListener` that removes related `OperatorSkill` rows automatically (include in OP-02 scope). Alternative: handle at UI level by showing "Unknown Station" for orphaned skill references. **This listener must be implemented** — it is not optional, as orphaned skills would cause confusing UI and incorrect auto-assign candidate lists.

> **Implementation prerequisite:** A `StationDeleted` domain event does not currently exist. The station deletion endpoint (`DELETE /api/v1/stations/{id}`) already exists in `StationController` and performs a hard delete via `StationService::delete()` → `$stationRepository->remove($station, true)`, but dispatches no event. OP-02 must create the `StationDeleted` event in `src/Event/Station/`, add its dispatch to the existing `StationService::delete()` method, and implement the `StationDeletedListener` subscriber. Alternatively, use a Doctrine `postRemove` lifecycle callback on `Station` to trigger cleanup without a domain event.

---

## 13. V2 Extension Path

### V2a — Variable Productivity Coefficients

When ready to add productivity coefficients, the changes are surgical:

1. Add `productivity FLOAT DEFAULT 1.0` column to `operator_skills`
2. Add `productivity: number` to `OperatorSkill` TypeScript interface
3. In `EndTimeCalculator`: `effectiveDuration = baseDuration / skill.productivity`
   > A productivity of 1.5 means 50% faster (task finishes sooner); 0.8 means 20% slower (task takes longer).
4. In auto-assign ranking: factor productivity into candidate selection
5. In `TaskAssignment`: add `effectiveEndTime` (computed from operator productivity)
6. Feedback-Based Improvement (FBI) integration: after each FBI iteration (see `AutoPlaceV1Service.MAX_FBI_ITERATIONS`), re-run operator assignment with updated durations

The entire operator infrastructure (entities, API, UI, assignment logic) is already in place from MVP. V2 is purely about making duration a function of the operator.

### V2b — Sub-Day Absence Granularity

Add optional time component to absences for half-day tracking:

1. Add `start_time TIME DEFAULT NULL` and `end_time TIME DEFAULT NULL` columns to `operator_absences`
2. When both are null → full-day absence (backward compatible with MVP data)
3. When set → absence covers only the specified time range on each day in the date range
4. Update `coversDate()` → `coversDateTime(DateTimeInterface)` with time-aware logic
5. Update auto-assign `isAbsentDuring()` to check time overlap, not just date overlap
6. Update `OperatorAvailabilityConflict` to include time range in message

### V2c — Targeted Operator Reassignment (`scope=operator:{id}`)

MVP auto-assign supports only `scope=all` (clear all, reassign all) and `scope=unassigned` (fill gaps). A common real-world scenario — operator calls in sick, manager needs to reassign only that operator's tasks — requires a targeted scope:

1. New scope value: `scope=operator:{operatorId}` — clear and reassign only the specified operator's tasks
2. Other operators' assignments are untouched
3. The greedy algorithm processes only the cleared tasks, using the full operator pool (minus the sick operator)
4. Much less disruptive than `scope=all` for sick-day scenarios

### V2d — Auto-Assign Result Discoverability

MVP auto-assign conflicts are ephemeral (shown in SSE modal, lost after closing). To make failed assignments discoverable:

1. Add `needsOperator: boolean` flag to `TaskAssignment` (default `false`)
2. Auto-assign sets `needsOperator = true` for tasks where no candidate was found
3. Manual assignment clears the flag
4. Frontend can filter/highlight tasks with `needsOperator = true` to show "unresolved operator needs"
5. Alternative: persist `lastAutoAssignResult` on `Schedule` with conflict summary

### V2e — Rotating Shift Schedules

MVP `OperatingSchedule` is a fixed weekly pattern (same hours every Monday, etc.). Real print shops often use rotating shifts (e.g., week 1 mornings, week 2 afternoons). To support this:

1. Add `shift_pattern_id` FK to `operators` referencing a new `shift_patterns` table
2. `ShiftPattern` defines a repeating cycle (e.g., 2-week rotation) with per-week operating schedules
3. `getEffectiveScheduleForDate()` resolves the pattern based on the date's position in the cycle
4. Backward compatible: operators without a shift pattern use the existing fixed weekly schedule
5. **Impact areas requiring design:** auto-assign algorithm (resolve effective schedule per day), validation pipeline (check against resolved schedule), frontend schedule editor (cycle visualization + per-week editing)

---

## 14. MVP Known Limitations

| Limitation | Impact | Workaround |
|------------|--------|------------|
| **Full-day absence granularity only** | Cannot model half-day absences (afternoon appointments, etc.) | Use operating schedule to shorten the day, or mark full day absent |
| **Fixed weekly schedule only** | Cannot model rotating shifts (alternating morning/afternoon weeks) | Manually update operating schedule each week |
| **No bulk operator reassignment** | When an operator calls in sick, their tasks must be individually reassigned or auto-assign re-run with scope=all (clears ALL assignments) | Use auto-assign scope=all and accept full reassignment |
| **Auto-assign conflicts are ephemeral** | Conflicts shown in SSE modal are lost after closing; no persistent conflict report | Re-run auto-assign to see conflicts again, or check validation pipeline conflicts |
| **Concurrent SSE operation guard** | Backend returns 409 if another SSE operation is active; frontend disables auto-assign button during other operations | Handled at both API (409 response) and UI (disabled button) levels |
| **No optimistic locking for operator assignment** | Two users assigning different operators to the same task simultaneously may cause last-write-wins | Schedule version check on save mitigates but does not prevent; production use should coordinate |
| **Initials and color can both collide** | Two operators can share the same initials (e.g., "Jean Dupont" and "Jacques Dupont" → "JD") AND color (10 palette colors cycle). They would be visually indistinguishable on tile badges. | Manually edit initials or color for one of the operators to disambiguate |
| **Progressive persistence on auto-assign failure** | If auto-assign fails mid-way, completed assignments are retained but may not be globally optimal. Re-running with `scope=unassigned` keeps partial results even if different choices would be better. | Use `scope=all` to clear and reassign from scratch for optimal results |
| **Ephemeral auto-assign conflicts have no discovery path** | Tasks that couldn't get an operator have `operatorId=null`, so operator validators skip them (BR-OPER-008). There's no way to discover which tasks *need* operators but couldn't get one without re-running auto-assign. | Re-run auto-assign to see conflicts; V2c adds `needsOperator` flag for persistent discoverability |
| **Single primary station per operator** | An operator can be primary for at most one station (BR-OPER-010). In real shops, an operator may be the primary person for two related machines (e.g., two offset presses). | Designate one as primary, the other as secondary (operator is still eligible for auto-assign on both). Consider relaxing in V2. |
| **`scope=all` clears all operators upfront** | `scope=all` clears ALL operatorIds before reassignment. If the operation fails mid-way, unprocessed tasks have no operator. | Re-run with `scope=unassigned` to assign the remaining tasks without reprocessing already-assigned ones. |
| **One operator per task (no shift splitting)** | Tasks spanning shift boundaries cannot be split between operators. A single operator must cover the entire task duration (during station operating hours). | Schedule tasks to end before shift changes, or accept that the assigned operator covers the full span. |
