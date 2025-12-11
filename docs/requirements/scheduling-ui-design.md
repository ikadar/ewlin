# Scheduling UI Design — Operations Research System

This document defines the **primary scheduling interface** — the time-based grid where schedulers place and manage task assignments. This is the **core value-generating UI** of the application.

---

## 1. Overview

### 1.1 Purpose

The Scheduling Grid is an interactive, drag-and-drop interface that allows schedulers to:
- Visualize resource utilization over time
- Place tasks onto specific time slots
- Assign operators and equipment to tasks
- Detect and resolve scheduling conflicts in real-time
- Optimize the production schedule

### 1.2 Primary Views

The system provides **two complementary grid views**:

| View | X-Axis | Y-Axis | Primary Use |
|------|--------|--------|-------------|
| **Equipment Grid** | Time | Equipment | Schedule tasks to machines, see machine utilization |
| **Operator Grid** | Time | Operator | Schedule operator assignments, see workload distribution |

Both views show the same underlying schedule data from different perspectives.

---

## 2. Equipment Grid View

### 2.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [< Prev Week]  [Today]  [Next Week >]     [Day | Week | Month]  [Zoom] │
├─────────────────────────────────────────────────────────────────────────┤
│           │ Mon 9    │ Mon 10   │ Mon 11   │ Mon 12   │ Mon 13   │ ... │
│           │ 08:00    │ 09:00    │ 10:00    │ 11:00    │ 12:00    │     │
├───────────┼──────────┴──────────┴──────────┴──────────┴──────────┴─────┤
│ CNC-01    │ ████ Task A (Job-1) ████████│          │███ Task C ███│    │
│ [Status]  │ Op: John Smith              │          │Op: Jane Doe  │    │
├───────────┼────────────────────────────────────────────────────────────┤
│ CNC-02    │      │████████ Task B (Job-2) ████████████│               │
│ [Status]  │      │Op: Bob Wilson                      │               │
├───────────┼────────────────────────────────────────────────────────────┤
│ Lathe-01  │ ░░░░░░░░ MAINTENANCE ░░░░░░░░│                            │
│ [Maint.]  │                              │                            │
├───────────┼────────────────────────────────────────────────────────────┤
│ Lathe-02  │                    │████ Task D ████│                     │
│ [Status]  │                    │Op: Unassigned  │                     │
└───────────┴────────────────────────────────────────────────────────────┘
```

### 2.2 Grid Elements

**Row Headers (Y-Axis):**
- Equipment name and ID
- Current status indicator (Available/InUse/Maintenance/OutOfService)
- Equipment type icon
- Click to expand: supported task types, location, current assignment

**Column Headers (X-Axis):**
- Date and time markers
- Configurable granularity: 15min / 30min / 1hr / 4hr
- Today marker (highlighted column)
- Non-working hours (grayed out or hidden)

**Task Blocks:**
- Visual representation of scheduled tasks
- Color-coded by: Job, Task type, or Status
- Shows: Task name, Job reference, Assigned operator
- Width proportional to duration
- Drag handles for resize (adjust duration)

### 2.3 Visual Indicators

| Indicator | Meaning |
|-----------|---------|
| Solid block | Confirmed assignment |
| Striped block | Tentative/unvalidated assignment |
| Red border | Conflict detected |
| Yellow border | Warning (deadline risk) |
| Gray background | Maintenance window |
| Dotted outline | Drag preview/ghost |
| Dependency arrow | Task dependency link |

---

## 3. Operator Grid View

### 3.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [< Prev Week]  [Today]  [Next Week >]     [Day | Week | Month]  [Zoom] │
├─────────────────────────────────────────────────────────────────────────┤
│           │ Mon 9    │ Mon 10   │ Mon 11   │ Mon 12   │ Mon 13   │ ... │
│           │ 08:00    │ 09:00    │ 10:00    │ 11:00    │ 12:00    │     │
├───────────┼──────────┴──────────┴──────────┴──────────┴──────────┴─────┤
│ John S.   │ ████ Task A ████████│ ░░░░░░░░│███ Task E ███│            │
│ [Active]  │ Eq: CNC-01          │  Break   │Eq: CNC-02    │            │
├───────────┼────────────────────────────────────────────────────────────┤
│ Jane D.   │      │████████ Task C ████████████│                       │
│ [Active]  │      │Eq: CNC-01                  │                       │
├───────────┼────────────────────────────────────────────────────────────┤
│ Bob W.    │ ░░░░░░░░ UNAVAILABLE ░░░░░░░░░░░░│████ Task B ████│      │
│ [Active]  │                                   │Eq: CNC-02      │      │
└───────────┴────────────────────────────────────────────────────────────┘
```

### 3.2 Operator-Specific Elements

**Row Headers:**
- Operator name and photo/avatar
- Status indicator (Active/Inactive)
- Skill badges (equipment certifications)
- Click to expand: full availability, skill details

**Availability Overlay:**
- Available slots shown as open areas
- Unavailable periods (outside shift, leave) grayed out
- Break times marked

---

## 4. Core Interactions

### 4.1 Creating Assignments (Drag & Drop)

**From Unassigned Task List:**
1. Scheduler drags task from "Unassigned Tasks" panel
2. Grid highlights valid drop zones (compatible equipment/operators)
3. Invalid zones shown as red (incompatible or conflicting)
4. Drop task onto time slot
5. System validates assignment in real-time
6. If valid: task is placed, operator assignment dialog opens
7. If conflict: conflict resolution panel appears

**From Job Detail Panel:**
1. Open job in side panel
2. Drag individual task to grid
3. Same validation flow as above

### 4.2 Moving Tasks

**Horizontal Move (Time Shift):**
1. Click and drag task block horizontally
2. System shows dependency constraints (earliest/latest start)
3. Conflicts highlighted in real-time
4. Release to confirm new time
5. Dependent tasks optionally cascade-move

**Vertical Move (Resource Change):**
1. Click and drag task block vertically
2. System validates: skill requirements, availability
3. Release on new equipment/operator row
4. Previous resource freed, new resource allocated

### 4.3 Resizing Tasks

1. Grab resize handle on task edge
2. Drag to extend or shrink duration
3. System validates: no overlap, deadline compliance
4. Task duration updates (may affect job deadline warning)

### 4.4 Quick Actions (Context Menu)

Right-click on task block:
- **Edit Details** — Open task editing panel
- **Change Operator** — Quick operator reassignment
- **Change Equipment** — Quick equipment reassignment
- **Split Task** — Divide into two consecutive tasks
- **Unassign** — Remove from schedule (back to unassigned)
- **View Job** — Navigate to parent job
- **View Dependencies** — Highlight dependency chain

### 4.5 Multi-Select Operations

1. Ctrl+Click or drag-select multiple tasks
2. Available bulk actions:
   - Move all by same offset
   - Reassign to different operator
   - Unassign all
   - Delete all (with confirmation)

---

## 5. Real-Time Validation

### 5.1 Validation Triggers

Validation runs automatically on:
- Task placement (drop)
- Task move
- Task resize
- Operator/equipment change
- External data change (availability update, equipment breakdown)

### 5.2 Conflict Types Displayed

| Conflict | Visual | Resolution Options |
|----------|--------|-------------------|
| **ResourceConflict** | Red border, overlap highlight | Move task, change resource |
| **AvailabilityConflict** | Red zone on grid | Adjust time, change operator |
| **DependencyConflict** | Red arrow, blocked indicator | Move task later, complete dependency first |
| **DeadlineConflict** | Yellow/red job marker | Compress schedule, extend deadline |
| **SkillConflict** | Orange border | Assign qualified operator |

### 5.3 Conflict Resolution Panel

When conflict detected:
```
┌─────────────────────────────────────────┐
│ ⚠️ Conflict Detected                    │
├─────────────────────────────────────────┤
│ Task "Machining Part A" conflicts with  │
│ "Assembly Part B" on CNC-01             │
│                                         │
│ Suggested resolutions:                  │
│ [1] Move to 14:00 (next available)      │
│ [2] Assign to CNC-02 (compatible)       │
│ [3] Swap with Task B                    │
│                                         │
│ [Apply #1]  [Apply #2]  [Manual Fix]    │
└─────────────────────────────────────────┘
```

---

## 6. Side Panels

### 6.1 Unassigned Tasks Panel

```
┌─────────────────────────────────┐
│ 📋 Unassigned Tasks        [×]  │
├─────────────────────────────────┤
│ Filter: [All Jobs ▼] [Type ▼]   │
│ Sort: [Deadline ▼]              │
├─────────────────────────────────┤
│ ▸ Job-001: Widget Production    │
│   ├─ Task A: Machining (2hr)    │
│   │   Needs: CNC, Operator L2+  │
│   │   Deadline: Mon 12:00 ⚠️    │
│   └─ Task B: Assembly (1hr)     │
│       Depends on: Task A        │
├─────────────────────────────────┤
│ ▸ Job-002: Gear Manufacturing   │
│   └─ Task C: Turning (3hr)      │
└─────────────────────────────────┘
```

### 6.2 Task Detail Panel

```
┌─────────────────────────────────┐
│ Task: Machining Part A     [×]  │
├─────────────────────────────────┤
│ Job: Widget Production          │
│ Type: CNC Machining             │
│ Duration: 2 hours               │
│ Status: Assigned                │
├─────────────────────────────────┤
│ Schedule:                       │
│   Start: Mon 09:00              │
│   End: Mon 11:00                │
├─────────────────────────────────┤
│ Resources:                      │
│   Equipment: CNC-01 [Change]    │
│   Operator: John Smith [Change] │
├─────────────────────────────────┤
│ Dependencies:                   │
│   Requires: (none)              │
│   Blocks: Task B, Task C        │
├─────────────────────────────────┤
│ [Unassign] [Edit] [Start Task]  │
└─────────────────────────────────┘
```

### 6.3 Resource Info Panel

```
┌─────────────────────────────────┐
│ Equipment: CNC-01          [×]  │
├─────────────────────────────────┤
│ Status: Available               │
│ Location: Building A, Bay 3     │
│ Type: CNC Milling Machine       │
├─────────────────────────────────┤
│ Supported Task Types:           │
│   • CNC Machining               │
│   • Precision Milling           │
├─────────────────────────────────┤
│ Utilization (this week): 73%    │
│ ████████████████░░░░░░          │
├─────────────────────────────────┤
│ Qualified Operators:            │
│   • John Smith (Expert)         │
│   • Jane Doe (Intermediate)     │
│   • Bob Wilson (Beginner)       │
├─────────────────────────────────┤
│ Upcoming Maintenance:           │
│   Thu 14:00-18:00 (Scheduled)   │
└─────────────────────────────────┘
```

---

## 7. Toolbar and Controls

### 7.1 Main Toolbar

```
[◀ Prev] [Today] [Next ▶]  |  [Day] [Week] [Month]  |  [−] Zoom [+]  |  [Equipment View] [Operator View]
```

### 7.2 View Options

- **Time Range:** Day / Week / Month
- **Zoom Level:** 15min / 30min / 1hr / 4hr granularity
- **Show/Hide:**
  - Maintenance windows
  - Completed tasks
  - Dependency arrows
  - Operator names on equipment view
  - Equipment names on operator view
- **Color By:** Job / Task Type / Status / Priority
- **Filter By:** Job / Equipment Type / Operator / Status

### 7.3 Quick Actions Bar

```
[+ New Task]  [Validate All]  [Auto-Schedule Selected]  [Export]  [Print]
```

---

## 8. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Arrow Keys` | Navigate between tasks |
| `Enter` | Open task details |
| `Delete` | Unassign selected task |
| `Ctrl+Z` | Undo last action |
| `Ctrl+Y` | Redo |
| `Ctrl+A` | Select all visible tasks |
| `Ctrl+Click` | Multi-select tasks |
| `Shift+Drag` | Copy task (create duplicate) |
| `Space` | Toggle task selection |
| `T` | Switch to Today |
| `E` | Switch to Equipment view |
| `O` | Switch to Operator view |
| `F` | Open filter panel |
| `?` | Show keyboard shortcuts |

---

## 9. Responsive Behavior

### 9.1 Desktop (>1200px)
- Full grid with side panels
- All interactions available
- Multi-column task list

### 9.2 Tablet (768-1200px)
- Grid takes full width
- Side panels as overlays/modals
- Touch-friendly drag handles
- Larger tap targets

### 9.3 Mobile (<768px)
- Simplified list view instead of grid
- Task cards with swipe actions
- Limited to viewing and basic edits
- Full scheduling on desktop recommended

---

## 10. Performance Requirements

| Metric | Target |
|--------|--------|
| Initial grid load | < 500ms |
| Task drag start | < 50ms |
| **Drag validation feedback** | **< 10ms** (client-side) |
| Server validation (on drop) | < 200ms |
| View switch (Equipment ↔ Operator) | < 300ms |
| Scroll/pan responsiveness | 60 FPS |
| Max visible tasks | 500+ without degradation |

### 10.1 Optimization Strategies

- **Virtualization:** Only render visible time range and rows
- **Lazy loading:** Load task details on demand
- **Client-side validation:** Instant feedback during drag (see 11.3)
- **Optimistic UI:** Show changes immediately, server validates async
- **WebSocket updates:** Real-time sync without polling

---

## 11. Integration Points

### 11.1 API Endpoints Used

```
GET  /api/v1/schedule/grid?view=equipment&start=...&end=...
GET  /api/v1/schedule/grid?view=operator&start=...&end=...
POST /api/v1/assignments
PUT  /api/v1/assignments/{id}
DELETE /api/v1/assignments/{id}
GET  /api/v1/tasks/unassigned
WebSocket /ws/schedule/updates
```

### 11.2 Real-Time Updates

- WebSocket connection for live schedule changes
- Events: TaskAssigned, TaskMoved, ConflictDetected, ResourceStatusChanged
- Optimistic locking with version conflict handling
- **Schedule snapshot pushed to client for local validation**

### 11.3 Isomorphic Validation Architecture

The scheduling grid uses **shared validation logic** that runs in both browser and server:

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Frontend                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │            @ewlin/schedule-validator                       │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  validateAssignment(proposed, scheduleSnapshot)     │  │  │
│  │  │  → Returns conflicts in < 10ms                      │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│    scheduleSnapshot          │  On drop: POST /assignments       │
│    (cached locally)          ▼                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Node.js Validation Service                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │            @ewlin/schedule-validator                       │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Same code, authoritative validation before persist │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 11.4 ScheduleSnapshot Data Structure

The client maintains a **local snapshot** of all data needed for validation:

```typescript
interface ScheduleSnapshot {
  // Current assignments (what's already scheduled)
  assignments: {
    taskId: string;
    operatorId: string | null;
    equipmentId: string | null;
    scheduledStart: DateTime;
    scheduledEnd: DateTime;
  }[];

  // Operator data
  operators: {
    id: string;
    status: 'Active' | 'Inactive' | 'Deactivated';
    availability: TimeSlot[];        // when they can work
    skills: {
      equipmentId: string;
      level: 'beginner' | 'intermediate' | 'expert';
    }[];
  }[];

  // Equipment data
  equipment: {
    id: string;
    status: 'Available' | 'InUse' | 'Maintenance' | 'OutOfService';
    supportedTaskTypes: string[];    // what tasks it can do
    maintenanceWindows: TimeSlot[];  // scheduled downtime
  }[];

  // Task data (tasks to be scheduled)
  tasks: {
    id: string;
    jobId: string;
    type: string;
    duration: number;                // in minutes
    requiresOperator: boolean;
    requiresEquipment: boolean;
    dependencies: string[];          // prerequisite task IDs
    status: TaskStatus;
  }[];

  // Job deadlines
  jobs: {
    id: string;
    deadline: DateTime;
    status: JobStatus;
  }[];

  // Metadata
  snapshotVersion: number;           // for conflict detection
  generatedAt: DateTime;
}

interface TimeSlot {
  start: DateTime;
  end: DateTime;
}
```

**Expected Data Size:** < 100 operators, < 500 tasks (small deployment)

### 11.5 Snapshot Synchronization Strategy

**First iteration: On-demand fetch with client-side cache**

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Snapshot Cache                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │   │
│  │  │ assignments │  │  operators  │  │  equipment  │ ...  │   │
│  │  │  TTL: 30s   │  │  TTL: 60s   │  │  TTL: 60s   │      │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ GET /api/v1/schedule/snapshot
                               │ (on cache miss or TTL expiry)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Backend API                              │
└─────────────────────────────────────────────────────────────────┘
```

**Sync Rules:**
1. **Initial Load:** Fetch full snapshot when grid opens
2. **Cache TTL:** 30-60 seconds (configurable)
3. **Refresh Triggers:**
   - User action (manual refresh button)
   - After successful assignment (server returns updated snapshot)
   - On focus return (if tab was inactive > TTL)
4. **Stale Data Handling:**
   - Client validation is advisory only
   - Server always re-validates with fresh data
   - If server rejects (stale client data), show error + auto-refresh

**API Endpoint:**
```
GET /api/v1/schedule/snapshot?timeRange=2025-01-20/2025-02-03
Response: ScheduleSnapshot (JSON, typically 50-200KB)
```

**Future Enhancement:** WebSocket push for real-time sync (when needed)

### 11.6 Validation Data Flow

1. **Grid Opens:**
   - `GET /schedule/snapshot` → cache locally
   - Render grid with assignment data

2. **During Drag (< 10ms):**
   ```typescript
   // No network call - uses cached snapshot
   const result = validateAssignment(
     { taskId, operatorId, equipmentId, start, end },
     cachedSnapshot
   );
   if (result.conflicts.length > 0) {
     highlightInvalid(dropZone);
   }
   ```

3. **On Drop:**
   - `POST /assignments` with proposed assignment
   - Server validates with **fresh data** (authoritative)
   - If valid: persist, return updated snapshot portion
   - If conflict: return error details

4. **After Successful Assignment:**
   - Update local cache with server response
   - No full refetch needed

**Why This Works for Small Deployments:**
- ~100 operators × ~50 bytes = 5KB
- ~500 tasks × ~100 bytes = 50KB
- ~500 assignments × ~80 bytes = 40KB
- **Total: ~100-200KB** (acceptable for initial load + cache)

**Why This Architecture:**
- **Instant feedback:** No network latency during drag (< 10ms)
- **Guaranteed consistency:** Same validation code on client and server
- **No rule divergence:** Single source of truth (`@ewlin/schedule-validator`)
- **Server authority:** Client validation is advisory, server is authoritative
- **Simple first iteration:** On-demand + cache, upgrade to WebSocket later if needed

**Validation Types Supported:**
- ResourceConflict (double-booking)
- AvailabilityConflict (outside availability)
- DependencyConflict (prerequisite not complete)
- DeadlineConflict (exceeds job deadline)
- SkillConflict (operator not qualified)

---

## 12. Accessibility

- Full keyboard navigation
- Screen reader support (ARIA labels)
- High contrast mode
- Color-blind friendly palette (patterns + colors)
- Focus indicators on all interactive elements
- Announcement of validation results

---

## Notes

- This document focuses on the UI design and interaction patterns
- Technical implementation details are in the architecture documents
- Wireframes and mockups should be created based on this specification
- User testing should validate the interaction patterns before implementation
