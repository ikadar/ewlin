# Outsourcing Requirement Impact Assessment

> **Status:** Draft
> **Created:** 2026-02-04
> **Related:** [outsourcing.md](./outsourcing.md)

---

## Executive Summary

The `docs/roadmap/outsourcing.md` document specifies a **major architectural change** to how outsourced tasks are handled in the Flux Scheduler. The core change: **outsourced tasks become precedence constraints (invisible in the grid) rather than scheduled tiles with dedicated provider columns**.

This is analogous to how drying time works today - an invisible constraint affecting precedence calculations, but unlike drying time, outsourcing parameters are user-configurable through the Job Details Panel.

---

## Current Implementation

### Existing Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ProviderColumn` | `components/ProviderColumn/ProviderColumn.tsx` | Visual column for outsourced tasks |
| `ProviderHeader` | `components/ProviderColumn/ProviderHeader.tsx` | Header cell for provider columns |
| `SchedulingGrid` | `components/SchedulingGrid/SchedulingGrid.tsx` | Renders provider columns (lines 467-699) |
| `Tile` | `components/Tile/Tile.tsx` | Supports `isOutsourced` prop for provider tiles |
| `TaskTile` | `components/JobDetailsPanel/TaskTile.tsx` | Displays outsourced task info |
| `TaskList` | `components/JobDetailsPanel/TaskList.tsx` | Renders task sequence including outsourced |

### Existing Type Definitions

**`packages/types/src/station.ts`** - OutsourcedProvider:
```typescript
interface OutsourcedProvider {
  id: string;
  name: string;
  status: ProviderStatus;
  supportedActionTypes: string[];
  latestDepartureTime: string;  // HH:MM
  receptionTime: string;        // HH:MM
  groupId: string;
}
```

**`packages/types/src/task.ts`** - OutsourcedTask:
```typescript
interface OutsourcedTask {
  type: 'Outsourced';
  providerId: string;
  actionType: string;
  duration: OutsourcedDuration;  // { openDays, latestDepartureTime, receptionTime }
}
```

**`packages/types/src/assignment.ts`** - Assignment flag:
```typescript
interface TaskAssignment {
  isOutsourced: boolean;
  targetId: string;  // station OR provider ID
}
```

---

## Required Changes

### 1. Type Definitions (`packages/types`)

#### OutsourcedProvider - Add `transitDays`

```typescript
// station.ts
interface OutsourcedProvider {
  id: string;
  name: string;
  status: ProviderStatus;
  supportedActionTypes: string[];
  latestDepartureTime: string;  // HH:MM - latest time to dispatch
  receptionTime: string;        // HH:MM - time when work returns
  transitDays: number;          // NEW: business days for transport (same outbound/return)
  groupId: string;
}
```

#### OutsourcedTask - Add manual override fields

```typescript
// task.ts
interface OutsourcedTask {
  type: 'Outsourced';
  providerId: string;
  actionType: string;
  workDays: number;             // RENAMED from duration.openDays
  manualDeparture?: string;     // NEW: ISO datetime override
  manualReturn?: string;        // NEW: ISO datetime override (null for final outsourcing)
}
```

### 2. Components to Remove

| File | Reason |
|------|--------|
| `components/ProviderColumn/ProviderColumn.tsx` | Provider columns no longer exist |
| `components/ProviderColumn/ProviderHeader.tsx` | Provider headers no longer exist |
| `components/ProviderColumn/index.ts` | Export file |

### 3. Components to Modify

#### SchedulingGrid.tsx

**Remove:**
- `providers` prop
- `assignmentsByProvider` memo (lines 361-407)
- `providerSubcolumnLayouts` memo
- Provider header rendering (line 468)
- Provider column rendering (lines 640-699)

#### Tile.tsx

**Remove:**
- `isOutsourced` prop
- `subcolumnLayout` prop for provider tiles
- Provider-specific rendering logic

#### TaskTile.tsx (Job Details Panel)

**Add:** Embedded mini-form for outsourced tasks with:

| Field | Type | Editable | Description |
|-------|------|----------|-------------|
| Provider name | text | No | Displayed in header |
| Action type | text | No | e.g., "Pelliculage" |
| Work days (JO) | number | Yes | Duration at provider |
| Departure | datetime | Yes | Date/time picker |
| Return | datetime | Yes | Date/time picker (hidden if final step) |

**Behavior:**
- Initial state (predecessor not scheduled): Departure/Return fields empty
- After predecessor scheduled: Auto-calculate based on provider params
- User can override any field at any time
- No pick & place - tile is not interactive for scheduling

### 4. Precedence Calculation (`utils/precedenceConstraints.ts`)

**Current logic:** Simple `openDays` duration

**New logic:** Complex timeline calculation

```
Timeline Structure:
  Departure (D)
    → [Transit: T business days]
    → [Work at Provider: N business days]
    → [Transit: T business days]
    → Return at receptionTime
```

#### Forward Calculation (earliestStart of successor)

```typescript
function calculateEarliestSuccessorStart(
  predecessorEnd: DateTime,
  provider: OutsourcedProvider,
  task: OutsourcedTask
): DateTime {
  // If manual return is set, use it directly
  if (task.manualReturn) {
    return parseDateTime(task.manualReturn);
  }

  // Determine departure date
  let departureDate: Date;
  if (predecessorEnd.time <= provider.latestDepartureTime) {
    departureDate = predecessorEnd.date;  // Same day
  } else {
    departureDate = nextBusinessDay(predecessorEnd.date);  // Next business day
  }

  // Calculate return
  // Day 0: Departure
  // Days 1..T: Outbound transit
  // Days T+1..T+N: Work at provider
  // Days T+N+1..T+N+T: Return transit
  // Return: receptionTime on day after final transit

  const totalDays = provider.transitDays + task.workDays + provider.transitDays;
  const returnDate = addBusinessDays(departureDate, totalDays);

  return { date: returnDate, time: provider.receptionTime };
}
```

#### Backward Calculation (latestEnd of predecessor)

```typescript
function calculateLatestPredecessorEnd(
  successorStart: DateTime,
  provider: OutsourcedProvider,
  task: OutsourcedTask
): DateTime {
  // If manual departure is set, use it directly
  if (task.manualDeparture) {
    return parseDateTime(task.manualDeparture);
  }

  // Work backwards from successor start
  let returnDate: Date;
  if (successorStart.time >= provider.receptionTime) {
    returnDate = successorStart.date;  // Same day return possible
  } else {
    returnDate = previousBusinessDay(successorStart.date);  // Previous business day
  }

  // Calculate departure (working backwards)
  const totalDays = provider.transitDays + task.workDays + provider.transitDays;
  const departureDate = subtractBusinessDays(returnDate, totalDays);

  return { date: departureDate, time: provider.latestDepartureTime };
}
```

### 5. Drag Visualization

**New requirement:** Show outsourcing constraints during drag operations (like drying time)

When dragging a tile with an outsourcing predecessor:
- Display the outsourcing constraint duration visually
- Show earliest valid drop position accounting for full timeline
- Alt+drag can bypass constraint (with warning)

### 6. Backend (PHP API)

| Entity | Change |
|--------|--------|
| `OutsourcedProvider` | Add `transitDays` field (integer, default: 1) |
| `OutsourcedTask` | Add `manualDeparture` (datetime, nullable) |
| `OutsourcedTask` | Add `manualReturn` (datetime, nullable) |
| API response | Include new fields in provider/task DTOs |

### 7. Business Rules

**New rules to implement:**

| Rule ID | Description |
|---------|-------------|
| BR-OUTSOURCE-001 | Outsourced tasks are precedence constraints, not schedulable tiles |
| BR-OUTSOURCE-002 | Departure date calculated from predecessor end + latestDepartureTime |
| BR-OUTSOURCE-003 | Return date = departure + transitDays + workDays + transitDays |
| BR-OUTSOURCE-004 | Manual departure/return values override automatic calculation |
| BR-OUTSOURCE-005 | Final outsourcing (no return) uses departure as workshop exit |

**Deprecated rules:**
- BR-TASK-008, BR-TASK-008b, BR-TASK-009 (replaced by new calculation model)

---

## Files Affected

### To Delete (3 files)

```
apps/web/src/components/ProviderColumn/ProviderColumn.tsx
apps/web/src/components/ProviderColumn/ProviderHeader.tsx
apps/web/src/components/ProviderColumn/index.ts
```

### To Modify (estimated 15+ files)

| Package | Files |
|---------|-------|
| `packages/types` | `station.ts`, `task.ts`, `index.ts` |
| `apps/web/src/components` | `SchedulingGrid.tsx`, `Tile.tsx`, `TaskTile.tsx`, `TaskList.tsx` |
| `apps/web/src/utils` | `precedenceConstraints.ts` |
| `apps/web/src/mock` | `generators/stations.ts`, fixtures |
| `packages/validator` | `helpers.ts`, constraint logic |

### To Create (estimated 3-5 files)

| File | Purpose |
|------|---------|
| `OutsourcingMiniForm.tsx` | Editable form in Job Details Panel |
| `OutsourcingConstraintIndicator.tsx` | Visual during drag operations |
| Unit tests for new calculation logic | |

---

## Complexity Assessment

| Area | Complexity | Effort |
|------|------------|--------|
| Type definitions update | Low | 1 |
| Provider column removal | Medium | 2 |
| Mini-form component | Medium | 3 |
| Precedence calculation rewrite | **High** | 5 |
| Drag constraint visualization | Medium | 3 |
| Backend entity updates | Low | 2 |
| Test updates | Medium | 3 |

**Total estimated effort:** High - recommend splitting into multiple releases.

---

## Release Plan (Phase 5D in Roadmap)

> See [release-roadmap.md](./release-roadmap.md) for full context.

### v0.5.9 - Outsourcing Types & Backend
- Update type definitions (`transitDays`, `manualDeparture`, `manualReturn`)
- Update backend entities (PHP API)
- Maintain backward compatibility

### v0.5.10 - Remove Provider Columns
- Remove provider columns from SchedulingGrid
- Remove ProviderColumn components
- Update Tile component

### v0.5.11 - Outsourcing Mini-Form
- Create OutsourcingMiniForm component
- Integrate into TaskTile
- Auto-calculation from predecessor

### v0.5.12 - Outsourcing Precedence Calculation
- Implement new forward/backward calculation
- Handle manual overrides
- Business day calculation utilities

### v0.5.13 - Outsourcing Drag Visualization
- Show outsourcing constraints during drag
- Alt+drag bypass with warning

---

## Risks and Considerations

1. **Breaking change for existing data** - Existing outsourced tasks may need migration
2. **Business day calculation** - Needs robust handling of weekends/holidays
3. **Manual override UX** - Clear indication when values are auto vs manual
4. **Precedence violation handling** - What happens when manual dates conflict?
5. **Final outsourcing edge case** - Workshop exit date semantics need clarification

---

## Questions for Clarification

1. Should `transitDays` be the same for outbound and return, or configurable separately?
2. How should holidays be handled in business day calculations?
3. What visual indicator should distinguish auto-calculated vs manually-entered dates?
4. Should there be validation preventing impossible manual date combinations?
