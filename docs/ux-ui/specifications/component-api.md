---
tags:
  - specification
  - ux-ui
  - components
---

# Component API Reference – Flux Scheduling UI

This document defines the props/API for each major UI component.

---

## Overview

Components are organized in the following structure:

```
src/components/
├── Tile/                    # Task tile on grid
├── StationColumns/          # Drop target columns
├── StationHeaders/          # Station labels
├── JobDetailsPanel/         # Selected job info
├── JobsList/                # Job list sidebar
├── TimelineColumn/          # Hour markers
├── DateStrip/               # Date navigation
├── SchedulingGrid/          # Main grid container
├── DragPreview/             # Floating drag preview
├── PlacementIndicator/      # Quick placement cursor
└── Sidebar/                 # Navigation icons
```

---

## Tile

Task tile displayed on the scheduling grid.

### Location

`src/components/Tile/Tile.tsx`

### Props

```typescript
interface TileProps {
  /** The assignment data (scheduledStart, taskId, etc.) */
  assignment: TaskAssignment;

  /** The task being displayed */
  task: InternalTask;

  /** The job this task belongs to */
  job: Job;

  /** Vertical position in pixels from column top */
  top: number;

  /** Callback when tile is clicked (selects job) */
  onSelect?: (jobId: string) => void;

  /** Callback when tile is double-clicked (recalls assignment) */
  onRecall?: (assignmentId: string) => void;

  /** Callback for swap up button */
  onSwapUp?: (assignmentId: string) => void;

  /** Callback for swap down button */
  onSwapDown?: (assignmentId: string) => void;

  /** Show swap up button (false for topmost tile) */
  showSwapUp?: boolean;

  /** Show swap down button (false for bottommost tile) */
  showSwapDown?: boolean;

  /** Whether this tile's job is selected */
  isSelected?: boolean;

  /** Similarity calculation results for this task */
  similarityResults?: SimilarityResult[];

  /** Currently active job ID (for muting other jobs) */
  activeJobId?: string;
}
```

### Data Attributes

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `data-testid` | `tile-{assignmentId}` | E2E test selector |
| `data-scheduled-start` | ISO time string | Scheduled time |
| `data-task-id` | Task ID | Task identification |

### Events

| Event | Trigger | Behavior |
|-------|---------|----------|
| `click` | Single click | Calls `onSelect(job.id)` |
| `dblclick` | Double click | Calls `onRecall(assignment.id)` |
| `dragstart` | Drag begins | Updates DragStateContext |
| `dragend` | Drag ends | Clears drag state |

---

## StationColumn

Drop target for task placement.

### Location

`src/components/StationColumns/StationColumn.tsx`

### Props

```typescript
interface StationColumnProps {
  /** Station data (id, name, category, etc.) */
  station: Station;

  /** First hour displayed (default: 6) */
  startHour?: number;

  /** Number of hours to display (default: 24) */
  hoursToDisplay?: number;

  /** Day of week for unavailability calculation */
  dayOfWeek?: number;

  /** Child tiles to render */
  children?: ReactNode;

  /** Whether column is collapsed during drag */
  isCollapsed?: boolean;

  /** Drop zone visual states */
  isValidDrop?: boolean;
  isWarningDrop?: boolean;
  isInvalidDrop?: boolean;
  showBypassWarning?: boolean;

  /** Quick placement mode props */
  isQuickPlacementMode?: boolean;
  hasAvailableTask?: boolean;
  placementIndicatorY?: number;
  onQuickPlacementMouseMove?: (stationId: string, y: number) => void;
  onQuickPlacementMouseLeave?: () => void;
  onQuickPlacementClick?: (stationId: string, y: number) => void;
}
```

### Data Attributes

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `data-testid` | `station-column-{stationId}` | E2E test selector |
| `data-station-id` | Station ID | Station identification |

### Visual States

| State | CSS Classes |
|-------|-------------|
| Normal | `bg-slate-900` |
| Valid drop | `ring-2 ring-green-500 bg-green-500/10` |
| Invalid drop | `ring-2 ring-red-500 bg-red-500/10` |
| Warning drop | `ring-2 ring-orange-500 bg-orange-500/10` |
| Bypass warning | `ring-2 ring-amber-500 bg-amber-500/10` |
| Collapsed | `w-30` (120px) |
| Quick placement available | Green highlight |
| Quick placement unavailable | `opacity-50` |

---

## JobDetailsPanel

Displays selected job information and task list.

### Location

`src/components/JobDetailsPanel/JobDetailsPanel.tsx`

### Props

```typescript
interface JobDetailsPanelProps {
  /** Currently selected job (null if none) */
  job: Job | null;

  /** All tasks for the selected job */
  tasks: Task[];

  /** Assignments for the job's tasks */
  assignments: TaskAssignment[];

  /** All stations (for task station names) */
  stations: Station[];

  /** Currently highlighted task ID */
  activeTaskId?: string | null;

  /** Callback to scroll grid to a task */
  onJumpToTask?: (assignment: TaskAssignment) => void;

  /** Callback to recall a scheduled task */
  onRecallTask?: (assignmentId: string) => void;
}
```

### Subcomponents

| Component | Purpose |
|-----------|---------|
| `JobInfo` | Header with job reference, client |
| `JobStatus` | Progress indicator, deadline |
| `TaskList` | Scrollable task list |
| `TaskTile` | Individual task tile (draggable) |

---

## TaskTile

Task tile in the sidebar (unscheduled or scheduled state).

### Location

`src/components/JobDetailsPanel/TaskTile.tsx`

### Props

```typescript
interface TaskTileProps {
  /** Task data */
  task: Task;

  /** Parent job */
  job: Job;

  /** Assignment if scheduled (null if unscheduled) */
  assignment: TaskAssignment | null;

  /** Station for this task */
  station: Station | null;

  /** Whether this task is currently active/highlighted */
  isActive?: boolean;

  /** Callback when clicking a scheduled task */
  onJumpToTask?: () => void;

  /** Callback to recall a scheduled task */
  onRecall?: () => void;
}
```

### Data Attributes

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `data-testid` | `task-tile-{taskId}` | E2E test selector |

### States

| State | Visual | Draggable |
|-------|--------|-----------|
| Unscheduled | Full color, cursor-grab | Yes |
| Scheduled | Dark placeholder | No |
| Completed | Green check icon | No |

---

## SchedulingGrid

Main container for station columns and tiles.

### Location

`src/components/SchedulingGrid/SchedulingGrid.tsx`

### Props

```typescript
interface SchedulingGridProps {
  /** All stations to display */
  stations: Station[];

  /** Station categories for grouping */
  categories?: StationCategory[];

  /** All jobs (for tile colors) */
  jobs?: Job[];

  /** All tasks */
  tasks?: Task[];

  /** All assignments to display */
  assignments?: TaskAssignment[];

  /** Currently selected job ID */
  selectedJobId?: string | null;

  /** Grid display settings */
  startHour?: number;
  hoursToDisplay?: number;

  /** Callbacks */
  onSelectJob?: (jobId: string) => void;
  onRecallAssignment?: (assignmentId: string) => void;
  onSwapUp?: (assignmentId: string) => void;
  onSwapDown?: (assignmentId: string) => void;
  onCompact?: (stationId: string) => void;

  /** Drag state props */
  activeTask?: Task | null;
  activeJob?: Job | null;
  validationState?: ValidationState;
  isRescheduleDrag?: boolean;

  /** Quick placement props */
  isQuickPlacementMode?: boolean;
  stationsWithAvailableTasks?: Set<string>;
  quickPlacementIndicatorY?: number;
  quickPlacementHoverStationId?: string | null;
  onQuickPlacementMouseMove?: (stationId: string, y: number) => void;
  onQuickPlacementMouseLeave?: () => void;
  onQuickPlacementClick?: (stationId: string, y: number) => void;

  /** Loading states */
  compactingStationId?: string | null;
}
```

### Ref Handle

```typescript
interface SchedulingGridHandle {
  /** Scroll to a specific pixel offset */
  scrollTo: (options: ScrollToOptions) => void;

  /** Get current scroll position */
  getScrollTop: () => number;
}
```

---

## TimelineColumn

Hour markers and "now" line.

### Location

`src/components/TimelineColumn/TimelineColumn.tsx`

### Props

```typescript
interface TimelineColumnProps {
  /** First hour to display (default: 6) */
  startHour?: number;

  /** Number of hours (default: 24) */
  hourCount?: number;

  /** Current time for "now" line */
  currentTime?: Date;

  /** Whether to show the "now" line */
  showNowLine?: boolean;
}
```

### Subcomponents

| Component | Purpose |
|-----------|---------|
| `HourMarker` | Individual hour label |
| `NowLine` | Current time indicator |

---

## DateStrip

Vertical date navigation column.

### Location

`src/components/DateStrip/DateStrip.tsx`

### Props

```typescript
interface DateStripProps {
  /** First date to display */
  startDate: Date;

  /** Number of days to display */
  dayCount: number;

  /** Currently selected date */
  selectedDate?: Date;

  /** Callback when date is clicked */
  onDateSelect?: (date: Date) => void;

  /** Highlighted date (e.g., departure) */
  highlightDate?: Date;

  /** Pixels per hour (for alignment) */
  pixelsPerHour?: number;
}
```

### DateCell Props

```typescript
interface DateCellProps {
  /** Date for this cell */
  date: Date;

  /** Whether this is today */
  isToday: boolean;

  /** Whether this date is selected */
  isSelected: boolean;

  /** Whether this is the departure date */
  isDeparture: boolean;

  /** Click handler */
  onClick: () => void;
}
```

---

## PlacementIndicator

Glowing line indicator for quick placement.

### Location

`src/components/PlacementIndicator/PlacementIndicator.tsx`

### Props

```typescript
interface PlacementIndicatorProps {
  /** Y position in pixels */
  y: number;

  /** Whether to show the indicator */
  isVisible: boolean;
}
```

### Visual

- White glowing horizontal line
- `boxShadow: '0 0 12px rgba(255, 255, 255, 0.8)'`
- Position: `absolute`, full width of column

---

## JobCard

Individual job in the jobs list.

### Location

`src/components/JobsList/JobCard.tsx`

### Props

```typescript
interface JobCardProps {
  /** Job ID */
  id: string;

  /** Job reference number */
  reference: string;

  /** Client name */
  client: string;

  /** Job description */
  description: string;

  /** Total task count */
  taskCount: number;

  /** Completed task count */
  completedTaskCount: number;

  /** Departure/deadline date */
  deadline?: string;

  /** Problem indicator type */
  problemType?: 'late' | 'conflict' | null;

  /** Whether this job is selected */
  isSelected?: boolean;

  /** Click handler */
  onClick?: () => void;
}
```

### Data Attributes

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `data-testid` | `job-card-{jobId}` | E2E test selector |

---

## DragPreview

Floating preview following cursor during drag.

### Location

`src/components/DragPreview/DragPreview.tsx`

### Props

```typescript
interface DragPreviewProps {
  /** Task being dragged */
  task: Task;

  /** Job for colors */
  job: Job;

  /** Cursor position X */
  x: number;

  /** Cursor position Y */
  y: number;

  /** Offset from grab point */
  grabOffset: { x: number; y: number };
}
```

### Visual

- Rendered in portal (outside normal DOM flow)
- Fixed positioning at cursor minus grab offset
- `opacity: 0.8`
- Same styling as Tile component

---

## DragLayer

Global drag monitoring and preview rendering.

### Location

`src/dnd/DragLayer.tsx`

### Props

None (uses DragStateContext internally)

### Behavior

- Uses `monitorForElements()` from pragmatic-drag-and-drop
- Tracks cursor position during drag
- Renders DragPreview when dragging
- Updates validation state based on cursor position

---

## Sidebar

Navigation icon strip.

### Location

`src/components/Sidebar/Sidebar.tsx`

### Props

```typescript
interface SidebarProps {
  /** Currently active view */
  activeView?: 'grid' | 'calendar' | 'settings';

  /** Navigation callback */
  onNavigate?: (view: string) => void;
}
```

### SidebarButton Props

```typescript
interface SidebarButtonProps {
  /** Lucide icon component */
  icon: LucideIcon;

  /** Tooltip text */
  label: string;

  /** Whether this button is active */
  isActive?: boolean;

  /** Click handler */
  onClick?: () => void;
}
```

---

## Type Definitions

### External Types (@flux/types)

```typescript
// From packages/types
interface Task {
  id: string;
  jobId: string;
  stationId: string;
  name: string;
  estimatedDuration: number;  // minutes
  sequence: number;
  predecessorId?: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface Job {
  id: string;
  reference: string;
  client: string;
  description?: string;
  departureDate?: string;
  color: string;  // hex color
  batApproved: boolean;
  platesReady: boolean;
}

interface Station {
  id: string;
  name: string;
  categoryId: string;
  operatingHours?: OperatingHours;
}

interface TaskAssignment {
  id: string;
  taskId: string;
  scheduledStart: string;  // ISO datetime
  scheduledEnd: string;    // ISO datetime
}
```

### Internal Types

```typescript
// Extended task with computed properties
interface InternalTask extends Task {
  setupDuration?: number;
  runDuration?: number;
}

// Validation result
interface ValidationState {
  isValid: boolean;
  hasPrecedenceConflict: boolean;
  suggestedStart: string | null;
  hasWarningOnly: boolean;
  targetStationId: string | null;
}

// Similarity calculation result
interface SimilarityResult {
  taskId: string;
  similarTaskId: string;
  timeSavingsMinutes: number;
}
```

---

## Related Documents

- [Tile Component](../05-components/tile-component.md)
- [Scheduling Grid](../05-components/scheduling-grid.md)
- [State Machines](state-machines.md)
- [Design Tokens](design-tokens.md)
