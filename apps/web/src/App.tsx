import { useState, useMemo, useEffect, useCallback, useRef, useDeferredValue } from 'react';
import { Sidebar, JobsList, JobDetailsPanel, DateStrip, SchedulingGrid, timeToYPosition, TopNavBar, DEFAULT_PIXELS_PER_HOUR, ViewportPositionProvider, useViewportPositionRef } from './components';
import type { SchedulingGridHandle, TaskMarker } from './components';
import { snapToGrid, yPositionToTime } from './components/DragPreview';
import { getSnapshot, updateSnapshot } from './mock';
import { useDropValidation } from './hooks';
import { generateId, calculateEndTime, applyPushDown, applySwap, getAvailableTaskForStation, getLastUnscheduledTask, compactTimeline, getPredecessorConstraint, getSuccessorConstraint, getDryingTimeInfo, getPredecessorLabelInfo, getSuccessorLabelInfo } from './utils';
import type { DryingTimeInfo } from './utils';
import type { CompactHorizon } from './utils';
import { PickStateProvider, usePickState, PickPreview } from './pick';
import type { Task, Job, InternalTask, TaskAssignment, ScheduleSnapshot, Station, ProposedAssignment } from '@flux/types';
import { validateAssignment } from '@flux/schedule-validator';

const START_HOUR = 6;
// v0.3.46: Restored to 365 days with virtual scrolling for performance
const DAY_COUNT = 365;

// v0.3.55: Layout constants for scroll calculations
// v0.3.62: Now calculated dynamically based on rem size (which depends on base font-size)
function getLayoutValues() {
  const remSize = typeof window !== 'undefined'
    ? parseFloat(getComputedStyle(document.documentElement).fontSize)
    : 16; // Fallback for SSR
  return {
    STATION_WIDTH: 15 * remSize,    // w-60 = 15rem
    GAP: 0.75 * remSize,            // gap-3 = 0.75rem
    PADDING_LEFT: 0.75 * remSize,   // px-3 = 0.75rem
    TIMELINE_WIDTH: 3 * remSize,    // w-12 = 3rem
  };
}

// v0.3.55: Throttle delay for pick mode validation (ms)
// v0.3.58: Increased from 50ms to 100ms for better performance
const PICK_VALIDATION_THROTTLE_MS = 100;

// ============================================================================
// Helper functions extracted to reduce nesting depth (SonarQube S2004)
// ============================================================================

/**
 * Filter conflicts to get only blocking ones (excludes auto-resolvable conflicts).
 * Used consistently in drag & drop and pick & place validation.
 */
function getBlockingConflicts(
  conflicts: Array<{ type: string; details?: { constraintType?: string; gate?: string } }>,
  isAltPressed: boolean,
  suggestedStart: string | null
) {
  return conflicts.filter(
    (c) => c.type !== 'StationConflict' &&
           !(c.type === 'PrecedenceConflict' &&
             (isAltPressed || (c.details?.constraintType === 'predecessor' && suggestedStart))) &&
           !(c.type === 'ApprovalGateConflict' && c.details?.gate === 'Plates')
  );
}

/**
 * Options for processing a drop assignment.
 */
interface ProcessDropOptions {
  currentSnapshot: ScheduleSnapshot;
  task: InternalTask;
  stationId: string;
  scheduledStart: string;
  scheduledEnd: string;
  isRescheduleOp: boolean;
  assignmentId: string | undefined;
  bypassedPrecedence: boolean;
}

/**
 * Process a drop operation and return the updated snapshot.
 * Extracted from onDrop to reduce function nesting.
 */
function processDropAssignment(options: ProcessDropOptions): ScheduleSnapshot {
  const {
    currentSnapshot,
    task,
    stationId,
    scheduledStart,
    scheduledEnd,
    isRescheduleOp,
    assignmentId,
    bypassedPrecedence,
  } = options;
  let assignmentsWithoutCurrent = currentSnapshot.assignments;
  let existingAssignment: TaskAssignment | undefined;

  if (isRescheduleOp && assignmentId) {
    existingAssignment = currentSnapshot.assignments.find((a) => a.id === assignmentId);
    assignmentsWithoutCurrent = currentSnapshot.assignments.filter((a) => a.id !== assignmentId);
  }

  const { updatedAssignments, shiftedIds } = applyPushDown(
    assignmentsWithoutCurrent,
    stationId,
    scheduledStart,
    scheduledEnd,
    task.id
  );

  if (shiftedIds.length > 0) {
    console.log('Push-down applied:', shiftedIds);
  }

  const finalAssignment: TaskAssignment = isRescheduleOp && existingAssignment
    ? { ...existingAssignment, scheduledStart, scheduledEnd, updatedAt: new Date().toISOString() }
    : {
        id: generateId(),
        taskId: task.id,
        targetId: stationId,
        isOutsourced: false,
        scheduledStart,
        scheduledEnd,
        isCompleted: false,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

  // Remove any existing PrecedenceConflict for this task (it may have been resolved by moving to valid position)
  const newConflicts = currentSnapshot.conflicts.filter(
    (c) => !(c.type === 'PrecedenceConflict' && c.taskId === task.id)
  );
  // Add new conflict if bypassed
  if (bypassedPrecedence) {
    newConflicts.push({
      type: 'PrecedenceConflict',
      message: 'Task placed before predecessor completes (Alt-key bypass)',
      taskId: task.id,
      targetId: stationId,
      details: { bypassedByUser: true },
    });
  }

  return {
    ...currentSnapshot,
    assignments: [...updatedAssignments, finalAssignment],
    conflicts: newConflicts,
  };
}

/**
 * Find the earliest start time for a task based on predecessor constraints.
 */
function findPredecessorEndTime(
  task: Task,
  tasks: Task[],
  assignments: TaskAssignment[],
  updatedEndTimes: Map<string, Date>
): Date | null {
  const jobTasks = tasks
    .filter((t) => t.jobId === task.jobId)
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const taskIndex = jobTasks.findIndex((t) => t.id === task.id);

  if (taskIndex <= 0) return null;

  const predecessorTask = jobTasks[taskIndex - 1];
  const updatedPredecessorEnd = updatedEndTimes.get(predecessorTask.id);

  if (updatedPredecessorEnd) return updatedPredecessorEnd;

  const predecessorAssignment = assignments.find((a) => a.taskId === predecessorTask.id);
  return predecessorAssignment ? new Date(predecessorAssignment.scheduledEnd) : null;
}

/**
 * Calculate the new end time for an assignment during compacting.
 */
function calculateCompactedEndTime(
  task: Task | undefined,
  assignment: TaskAssignment,
  newStart: Date,
  station: Station | undefined,
  calculateEndTimeFn: (task: InternalTask, start: string, station: Station | undefined) => string
): string {
  if (task?.type === 'Internal') {
    return calculateEndTimeFn(task as InternalTask, newStart.toISOString(), station);
  }
  // Preserve original duration for non-internal tasks
  const originalDuration = new Date(assignment.scheduledEnd).getTime() - new Date(assignment.scheduledStart).getTime();
  return new Date(newStart.getTime() + originalDuration).toISOString();
}

function compactStationAssignments(
  currentSnapshot: ScheduleSnapshot,
  stationId: string,
  calculateEndTimeFn: (task: InternalTask, start: string, station: Station | undefined) => string
): ScheduleSnapshot {
  const stationAssignments = currentSnapshot.assignments
    .filter((a) => a.targetId === stationId && !a.isOutsourced)
    .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

  if (stationAssignments.length === 0) return currentSnapshot;

  const taskMap = new Map(currentSnapshot.tasks.map((t) => [t.id, t]));
  const station = currentSnapshot.stations.find((s) => s.id === stationId);
  const updatedEndTimes = new Map<string, Date>();
  const updatedAssignmentsMap = new Map<string, { scheduledStart: string; scheduledEnd: string }>();

  let nextStartTime = new Date(stationAssignments[0].scheduledStart);

  for (const assignment of stationAssignments) {
    const task = taskMap.get(assignment.taskId);
    let earliestStart = nextStartTime;

    // Check predecessor constraint
    if (task) {
      const predecessorEnd = findPredecessorEndTime(task, currentSnapshot.tasks, currentSnapshot.assignments, updatedEndTimes);
      if (predecessorEnd && predecessorEnd > earliestStart) {
        earliestStart = predecessorEnd;
      }
    }

    const newEnd = calculateCompactedEndTime(task, assignment, earliestStart, station, calculateEndTimeFn);
    updatedAssignmentsMap.set(assignment.id, { scheduledStart: earliestStart.toISOString(), scheduledEnd: newEnd });
    updatedEndTimes.set(assignment.taskId, new Date(newEnd));
    nextStartTime = new Date(newEnd);
  }

  const newAssignments = currentSnapshot.assignments.map((assignment) => {
    const updated = updatedAssignmentsMap.get(assignment.id);
    return updated
      ? { ...assignment, scheduledStart: updated.scheduledStart, scheduledEnd: updated.scheduledEnd, updatedAt: new Date().toISOString() }
      : assignment;
  });

  console.log('Station compacted:', { stationId, compactedCount: updatedAssignmentsMap.size });
  return { ...currentSnapshot, assignments: newAssignments };
}

// ============================================================================
// Keyboard shortcut handlers (extracted to reduce cognitive complexity S3776)
// ============================================================================

interface KeyboardContext {
  selectedJobId: string | null;
  isQuickPlacementMode: boolean;
  isPicking: boolean;
  orderedJobIds: string[];
  selectedJob: Job | null;
  gridRef: React.RefObject<SchedulingGridHandle | null>;
  pixelsPerHour: number;
  gridStartDate: Date;
  setIsAltPressed: (v: boolean) => void;
  setSelectedJobId: (id: string | null) => void;
  setIsQuickPlacementMode: (fn: (prev: boolean) => boolean) => void;
  setQuickPlacementHover: (v: { stationId: string | null; y: number; snappedY: number }) => void;
  handleCancelPick: () => void;
}

function handleAltKey(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  if (e.key === 'Alt') {
    e.preventDefault();
    ctx.setIsAltPressed(true);
    return true;
  }
  return false;
}

function handleQuickPlacementKeyboard(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  if (e.altKey && e.code === 'KeyQ') {
    e.preventDefault();
    if (ctx.selectedJobId) {
      ctx.setIsQuickPlacementMode((prev) => !prev);
      ctx.setQuickPlacementHover({ stationId: null, y: 0, snappedY: 0 });
    }
    return true;
  }
  return false;
}

function handleEscapeQuickPlacement(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  if (e.key === 'Escape') {
    // Cancel Pick & Place mode first (higher priority)
    if (ctx.isPicking) {
      ctx.handleCancelPick();
      return true;
    }
    // Cancel Quick Placement mode
    if (ctx.isQuickPlacementMode) {
      ctx.setIsQuickPlacementMode(() => false);
      ctx.setQuickPlacementHover({ stationId: null, y: 0, snappedY: 0 });
      return true;
    }
  }
  return false;
}

function handleJobNavigation(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) {
    return false;
  }
  e.preventDefault();
  if (ctx.orderedJobIds.length === 0) return true;

  const direction = e.key === 'ArrowUp' ? -1 : 1;
  if (!ctx.selectedJobId) {
    ctx.setSelectedJobId(ctx.orderedJobIds[0]);
    return true;
  }

  const currentIndex = ctx.orderedJobIds.indexOf(ctx.selectedJobId);
  const newIndex = (currentIndex + direction + ctx.orderedJobIds.length) % ctx.orderedJobIds.length;
  ctx.setSelectedJobId(ctx.orderedJobIds[newIndex]);
  return true;
}

function handleJumpToDeparture(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  if (e.altKey && e.code === 'KeyD') {
    e.preventDefault();
    if (ctx.selectedJob?.workshopExitDate && ctx.gridRef.current) {
      const departureDate = new Date(ctx.selectedJob.workshopExitDate);
      const y = timeToYPosition(departureDate, START_HOUR, ctx.pixelsPerHour, ctx.gridStartDate);
      const viewportHeight = ctx.gridRef.current.getViewportHeight();
      const scrollTarget = Math.max(0, y - viewportHeight + 100);
      ctx.gridRef.current.scrollToY(scrollTarget);
    }
    return true;
  }
  return false;
}

function handleJumpToToday(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  if (e.key === 'Home' && !e.altKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (ctx.gridRef.current) {
      const now = new Date();
      const y = timeToYPosition(now, START_HOUR, ctx.pixelsPerHour, ctx.gridStartDate);
      const viewportHeight = ctx.gridRef.current.getViewportHeight();
      const scrollTarget = Math.max(0, y - viewportHeight / 2);
      ctx.gridRef.current.scrollToY(scrollTarget);
    }
    return true;
  }
  return false;
}

function handlePageScroll(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  if ((e.key === 'PageUp' || e.key === 'PageDown') && !e.altKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (ctx.gridRef.current) {
      const oneDayPixels = 24 * ctx.pixelsPerHour;
      const direction = e.key === 'PageUp' ? -1 : 1;
      ctx.gridRef.current.scrollByY(direction * oneDayPixels);
    }
    return true;
  }
  return false;
}

// Inner App component that uses drag state context
function AppContent() {
  // Snapshot version state to force re-render on updates
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshotVersion triggers refetch
  const snapshot = useMemo(() => getSnapshot(), [snapshotVersion]);

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  // v0.3.46: Use deferred value for grid to keep sidebar responsive during selection
  const deferredSelectedJobId = useDeferredValue(selectedJobId);

  // v0.3.62: Calculate layout values dynamically based on rem size
  const LAYOUT = useMemo(() => getLayoutValues(), []);

  // Get pick state from context (Pick & Place mode)
  const { state: pickState, pickTask, cancelPick, updateHover: _updatePickHover, placeTask } = usePickState();
  const { isPicking, pickedTask, pickedJob, hoverPosition: _pickHoverPosition, pickSource, originalAssignmentId } = pickState;

  // Alt key state for precedence bypass
  const [isAltPressed, setIsAltPressed] = useState(false);

  // Quick Placement Mode state
  const [isQuickPlacementMode, setIsQuickPlacementMode] = useState(false);
  const [quickPlacementHover, setQuickPlacementHover] = useState<{
    stationId: string | null;
    y: number;
    snappedY: number;
  }>({ stationId: null, y: 0, snappedY: 0 });

  // v0.3.54: Pick mode hover position state (for placement indicator and precedence lines)
  const [pickHover, setPickHover] = useState<{
    stationId: string | null;
    snappedY: number;
  }>({ stationId: null, snappedY: 0 });

  // v0.3.55: Saved scroll position for pick mode cancel restoration
  const savedScrollPositionRef = useRef<{ x: number; y: number } | null>(null);

  // v0.3.55: Throttle ref for pick validation (performance optimization)
  const pickValidationThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // v0.3.58: Last validated Y position for early exit optimization
  const lastValidatedYRef = useRef<number>(0);

  // v0.3.55: Pick validation state (for real-time ring color feedback)
  // v0.3.59: Added message field for validation message display
  // v0.3.60: Added conflicts array for real-time message generation in PickPreview
  const [pickValidation, setPickValidation] = useState<{
    isValid: boolean;
    hasPrecedenceConflict: boolean;
    suggestedStart: string | null;
    hasWarningOnly: boolean;
    conflicts: Array<{ type: string; details?: Record<string, unknown> }>;
  }>({ isValid: false, hasPrecedenceConflict: false, suggestedStart: null, hasWarningOnly: false, conflicts: [] });

  // v0.3.55: Handle cancel pick - restore scroll position
  // NOTE: Defined early because it's used in keyboard shortcuts useEffect
  const handleCancelPick = useCallback(() => {
    // Restore scroll position if saved
    if (savedScrollPositionRef.current && gridRef.current) {
      const { x, y } = savedScrollPositionRef.current;
      gridRef.current.scrollTo(x, y, 'smooth');
      savedScrollPositionRef.current = null;
    }
    cancelPick();
    console.log('Pick cancelled - scroll position restored');
  }, [cancelPick]);

  // v0.3.55: Toggle body cursor class during pick mode
  useEffect(() => {
    if (isPicking) {
      document.body.classList.add('pick-mode-active');
    } else {
      document.body.classList.remove('pick-mode-active');
    }
    return () => {
      document.body.classList.remove('pick-mode-active');
    };
  }, [isPicking]);

  // Compact station loading state
  const [compactingStationId, setCompactingStationId] = useState<string | null>(null);

  // Global timeline compact loading state (v0.3.35)
  const [isCompactingTimeline, setIsCompactingTimeline] = useState(false);

  // Zoom state (v0.3.34)
  const [pixelsPerHour, setPixelsPerHour] = useState(DEFAULT_PIXELS_PER_HOUR);

  // Grid ref for programmatic scrolling
  const gridRef = useRef<SchedulingGridHandle>(null);

  // v0.3.47: Zoom handler that maintains grid center position
  const handleZoomChange = useCallback((newPixelsPerHour: number) => {
    const grid = gridRef.current;
    if (!grid) {
      setPixelsPerHour(newPixelsPerHour);
      return;
    }

    // Calculate the current center hour before zoom
    const currentScrollTop = grid.getScrollY();
    const viewportHeight = grid.getViewportHeight();
    const centerY = currentScrollTop + viewportHeight / 2;
    const centerHour = centerY / pixelsPerHour;

    // Update zoom level
    setPixelsPerHour(newPixelsPerHour);

    // After React updates, scroll to keep the same center hour visible
    requestAnimationFrame(() => {
      const newCenterY = centerHour * newPixelsPerHour;
      const newScrollTop = newCenterY - viewportHeight / 2;
      grid.scrollToY(Math.max(0, newScrollTop), 'instant');
    });
  }, [pixelsPerHour]);

  // Create lookup maps
  const jobMap = useMemo(() => {
    const map = new Map<string, Job>();
    snapshot.jobs.forEach((job) => map.set(job.id, job));
    return map;
  }, [snapshot.jobs]);

  // Find selected job
  const selectedJob = selectedJobId ? jobMap.get(selectedJobId) || null : null;

  // REQ-14: Calculate grid/DateStrip start date (6 days before today)
  const gridStartDate = useMemo(() => {
    const today = new Date();
    today.setDate(today.getDate() - 6);
    today.setHours(START_HOUR, 0, 0, 0);
    return today;
  }, []);

  // REQ-10: Calculate precedence constraint Y positions during pick mode
  // v0.3.56: Now includes label info for contextual display
  const constraintTask = isPicking ? pickedTask : null;
  const precedenceConstraints = useMemo(() => {
    if (!constraintTask) {
      return { earliestY: null, latestY: null, earliestLabel: null, latestLabel: null };
    }
    const earliestY = getPredecessorConstraint(constraintTask, snapshot, START_HOUR, pixelsPerHour, gridStartDate);
    const latestY = getSuccessorConstraint(constraintTask, snapshot, START_HOUR, pixelsPerHour, gridStartDate);
    // v0.3.56: Get label info for contextual display
    const earliestLabel = getPredecessorLabelInfo(constraintTask, snapshot);
    const latestLabel = getSuccessorLabelInfo(constraintTask, snapshot);
    return { earliestY, latestY, earliestLabel, latestLabel };
  }, [constraintTask, snapshot, pixelsPerHour, gridStartDate]);

  // v0.3.51: Calculate drying time info during drag OR pick mode
  const dryingTimeInfo = useMemo((): DryingTimeInfo | null => {
    if (!constraintTask) {
      return null;
    }
    return getDryingTimeInfo(constraintTask, snapshot, START_HOUR, pixelsPerHour, gridStartDate);
  }, [constraintTask, snapshot, pixelsPerHour, gridStartDate]);

  // REQ-14: Auto-scroll to today on initial load
  const hasScrolledToToday = useRef(false);
  useEffect(() => {
    if (hasScrolledToToday.current || !gridRef.current) return;

    // Calculate Y position for today at current time
    const now = new Date();
    const y = timeToYPosition(now, START_HOUR, pixelsPerHour, gridStartDate);

    // Scroll to center today in the viewport
    const viewportHeight = gridRef.current.getViewportHeight();
    const scrollTarget = Math.max(0, y - viewportHeight / 2);
    gridRef.current.scrollToY(scrollTarget, 'instant');

    hasScrolledToToday.current = true;
  }, [pixelsPerHour, gridStartDate]);

  // REQ-15: Get departure date for selected job
  const departureDate = useMemo(() => {
    if (!selectedJob?.workshopExitDate) return null;
    return new Date(selectedJob.workshopExitDate);
  }, [selectedJob?.workshopExitDate]);

  // REQ-16: Calculate scheduled days for selected job
  const scheduledDays = useMemo(() => {
    if (!selectedJobId) return new Set<string>();

    const days = new Set<string>();
    const jobTaskIds = new Set(
      snapshot.tasks
        .filter((t) => t.jobId === selectedJobId)
        .map((t) => t.id)
    );

    snapshot.assignments
      .filter((a) => jobTaskIds.has(a.taskId))
      .forEach((a) => {
        const date = new Date(a.scheduledStart);
        const dateKey = date.toISOString().split('T')[0];
        days.add(dateKey);
      });

    return days;
  }, [selectedJobId, snapshot.tasks, snapshot.assignments]);

  // v0.3.47: Task markers per day for DateStrip
  // Groups tasks by date and determines their status (completed, late, conflict, scheduled)
  const taskMarkersPerDay = useMemo((): Map<string, TaskMarker[]> => {
    const markers = new Map<string, TaskMarker[]>();
    if (!selectedJobId) return markers;

    const now = new Date();
    const conflictTaskIds = new Set(snapshot.conflicts.map((c) => c.taskId));

    // Get all tasks for the selected job
    const jobTasks = snapshot.tasks.filter((t) => t.jobId === selectedJobId);
    const taskIds = new Set(jobTasks.map((t) => t.id));

    // Process assignments for selected job
    snapshot.assignments
      .filter((a) => taskIds.has(a.taskId))
      .forEach((assignment) => {
        const scheduledEnd = new Date(assignment.scheduledEnd);
        const dateKey = new Date(assignment.scheduledStart).toISOString().split('T')[0];

        // Determine task marker status
        let status: TaskMarker['status'] = 'scheduled';
        if (assignment.isCompleted) {
          status = 'completed';
        } else if (conflictTaskIds.has(assignment.taskId)) {
          status = 'conflict';
        } else if (scheduledEnd < now) {
          status = 'late';
        }

        const marker: TaskMarker = {
          taskId: assignment.taskId,
          status,
        };

        const existing = markers.get(dateKey) ?? [];
        existing.push(marker);
        markers.set(dateKey, existing);
      });

    return markers;
  }, [selectedJobId, snapshot.tasks, snapshot.assignments, snapshot.conflicts]);

  // v0.3.47: Earliest task date for timeline (first scheduled task)
  const earliestTaskDate = useMemo((): Date | null => {
    if (!selectedJobId) return null;

    const jobTaskIds = new Set(
      snapshot.tasks.filter((t) => t.jobId === selectedJobId).map((t) => t.id)
    );

    let earliest: Date | null = null;
    snapshot.assignments
      .filter((a) => jobTaskIds.has(a.taskId))
      .forEach((a) => {
        const startDate = new Date(a.scheduledStart);
        if (!earliest || startDate < earliest) {
          earliest = startDate;
        }
      });

    return earliest;
  }, [selectedJobId, snapshot.tasks, snapshot.assignments]);

  // REQ-09.2: Focused date for DateStrip sync
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);
  // v0.3.64: Deferred focusedDate to avoid blocking scroll
  const deferredFocusedDate = useDeferredValue(focusedDate);
  const scrollTimeoutRef = useRef<number | null>(null);

  // v0.3.64: Viewport position ref for direct DOM updates (no re-renders)
  const viewportPositionRef = useViewportPositionRef();
  const lastScrollTopRef = useRef<number>(0);

  // Ref to avoid stale closure in scroll handler when zoom changes
  const pixelsPerHourRef = useRef(pixelsPerHour);
  pixelsPerHourRef.current = pixelsPerHour;

  // REQ-09.2: Handle grid scroll to calculate focused date
  // v0.3.64: Viewport hours now update via ref for direct DOM updates (no re-renders)
  const handleGridScroll = useCallback((scrollTop: number) => {
    // Store scrollTop for recalculation on zoom change
    lastScrollTopRef.current = scrollTop;

    // Use ref to get current pixelsPerHour (avoids stale closure on zoom change)
    const currentPixelsPerHour = pixelsPerHourRef.current;
    const viewportHeight = gridRef.current?.getViewportHeight() ?? 600;

    // v0.3.64: Update viewport position ref immediately (no RAF, no state)
    // ViewportIndicator reads this via RAF loop for smooth DOM updates
    const startHourFromGridStart = scrollTop / currentPixelsPerHour;
    const endHourFromGridStart = (scrollTop + viewportHeight) / currentPixelsPerHour;
    viewportPositionRef.current.startHour = startHourFromGridStart;
    viewportPositionRef.current.endHour = endHourFromGridStart;

    // Debounce focusedDate updates (less critical, can be deferred)
    if (scrollTimeoutRef.current !== null) {
      cancelAnimationFrame(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = requestAnimationFrame(() => {
      // Calculate focused date from scroll position
      // The focused date is the one visible at the center of the viewport
      const centerY = scrollTop + viewportHeight / 2;
      const hoursFromStart = centerY / currentPixelsPerHour;
      const focusedTime = new Date(gridStartDate);
      focusedTime.setTime(gridStartDate.getTime() + hoursFromStart * 60 * 60 * 1000);
      setFocusedDate(focusedTime);
    });
  }, [gridStartDate, viewportPositionRef]);

  // v0.3.64: Recalculate viewport position when zoom (pixelsPerHour) changes
  // This ensures the viewport indicator stays on the correct day after zoom
  useEffect(() => {
    if (lastScrollTopRef.current > 0) {
      const viewportHeight = gridRef.current?.getViewportHeight() ?? 600;
      const startHourFromGridStart = lastScrollTopRef.current / pixelsPerHour;
      const endHourFromGridStart = (lastScrollTopRef.current + viewportHeight) / pixelsPerHour;
      viewportPositionRef.current.startHour = startHourFromGridStart;
      viewportPositionRef.current.endHour = endHourFromGridStart;
    }
  }, [pixelsPerHour, viewportPositionRef]);

  // Get ordered job IDs for navigation (matching JobsList display order)
  // Problems first (late, then conflicts), then normal jobs
  const orderedJobIds = useMemo(() => {
    const lateJobIds = new Set(snapshot.lateJobs.map((lj) => lj.jobId));
    const conflictJobIds = new Set<string>();
    snapshot.conflicts.forEach((c) => {
      const task = snapshot.tasks.find((t) => t.id === c.taskId);
      if (task) conflictJobIds.add(task.jobId);
    });

    const problems: Job[] = [];
    const normal: Job[] = [];

    snapshot.jobs.forEach((job) => {
      if (lateJobIds.has(job.id) || conflictJobIds.has(job.id)) {
        problems.push(job);
      } else {
        normal.push(job);
      }
    });

    // Sort problems: late first, then conflicts
    problems.sort((a, b) => {
      const aIsLate = lateJobIds.has(a.id);
      const bIsLate = lateJobIds.has(b.id);
      if (aIsLate && !bIsLate) return -1;
      if (!aIsLate && bIsLate) return 1;
      return 0;
    });

    return [...problems.map((j) => j.id), ...normal.map((j) => j.id)];
  }, [snapshot.jobs, snapshot.lateJobs, snapshot.conflicts, snapshot.tasks]);

  // Track Alt key and keyboard shortcuts
  useEffect(() => {
    const ctx: KeyboardContext = {
      selectedJobId,
      isQuickPlacementMode,
      isPicking,
      orderedJobIds,
      selectedJob,
      gridRef,
      pixelsPerHour,
      gridStartDate,
      setIsAltPressed,
      setSelectedJobId,
      setIsQuickPlacementMode,
      setQuickPlacementHover,
      handleCancelPick,
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Each handler returns true if it handled the event
      if (handleAltKey(e, ctx)) return;
      if (handleQuickPlacementKeyboard(e, ctx)) return;
      if (handleEscapeQuickPlacement(e, ctx)) return;
      if (handleJobNavigation(e, ctx)) return;
      if (handleJumpToDeparture(e, ctx)) return;
      if (handleJumpToToday(e, ctx)) return;
      handlePageScroll(e, ctx);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedJobId, isQuickPlacementMode, isPicking, handleCancelPick, orderedJobIds, selectedJob, pixelsPerHour, gridStartDate]);

  // Handle swap up - exchange position with tile above
  const handleSwapUp = useCallback((assignmentId: string) => {
    updateSnapshot((currentSnapshot) => {
      const result = applySwap(currentSnapshot.assignments, assignmentId, 'up');
      if (result.swapped) {
        console.log('Swapped up:', { assignmentId, swappedWithId: result.swappedWithId });
        return {
          ...currentSnapshot,
          assignments: result.assignments,
        };
      }
      return currentSnapshot;
    });
    setSnapshotVersion((v) => v + 1);
  }, []);

  // Handle swap down - exchange position with tile below
  const handleSwapDown = useCallback((assignmentId: string) => {
    updateSnapshot((currentSnapshot) => {
      const result = applySwap(currentSnapshot.assignments, assignmentId, 'down');
      if (result.swapped) {
        console.log('Swapped down:', { assignmentId, swappedWithId: result.swappedWithId });
        return {
          ...currentSnapshot,
          assignments: result.assignments,
        };
      }
      return currentSnapshot;
    });
    setSnapshotVersion((v) => v + 1);
  }, []);

  // Handle jump to task - scroll grid to assignment position (single-click in Job Details Panel)
  const handleJumpToTask = useCallback((assignment: TaskAssignment) => {
    if (!gridRef.current) return;

    // Calculate Y position from assignment's scheduledStart (multi-day aware)
    const startTime = new Date(assignment.scheduledStart);
    const y = timeToYPosition(startTime, START_HOUR, pixelsPerHour, gridStartDate);

    // Position the tile ~20vh from top of viewport
    const viewportHeight = gridRef.current.getViewportHeight();
    const scrollTargetY = Math.max(0, y - viewportHeight * 0.2);

    // Calculate X position from station index
    // Station layout: px-3 (12px) padding, then each station is 240px + 12px gap
    const stationId = assignment.targetId;
    const stationIndex = snapshot.stations.findIndex((s) => s.id === stationId);

    let scrollTargetX = gridRef.current.getScrollX(); // Default: keep current X

    if (stationIndex >= 0) {
      // Calculate station's X position
      const stationX = LAYOUT.PADDING_LEFT + stationIndex * (LAYOUT.STATION_WIDTH + LAYOUT.GAP);

      // Center the station in the viewport (accounting for timeline column width)
      const viewportWidth = gridRef.current.getViewportWidth();
      scrollTargetX = Math.max(0, stationX - (viewportWidth - LAYOUT.TIMELINE_WIDTH - LAYOUT.STATION_WIDTH) / 2);
    }

    // Scroll both X and Y at once
    gridRef.current.scrollTo(scrollTargetX, scrollTargetY);

    console.log('Jump to task:', {
      assignmentId: assignment.id,
      taskId: assignment.taskId,
      stationId,
      scheduledStart: assignment.scheduledStart,
      scrollTargetX,
      scrollTargetY,
    });
  }, [snapshot.stations, pixelsPerHour, gridStartDate, LAYOUT]);

  // Handle pick task - Pick & Place mode from sidebar
  const handlePickTask = useCallback((task: Task, job: Job) => {
    // Only allow picking internal tasks (outsourced handled differently)
    if (task.type !== 'Internal') return;

    // v0.3.55: Save current scroll position for restoration on cancel
    if (gridRef.current) {
      savedScrollPositionRef.current = {
        x: gridRef.current.getScrollX(),
        y: gridRef.current.getScrollY(),
      };
    }

    // Start pick mode (source = 'sidebar' for unscheduled tasks)
    pickTask(task, job, 'sidebar');

    // v0.3.55: Scroll to target station column (300ms animation)
    const stationId = task.stationId;
    const stationIndex = snapshot.stations.findIndex((s) => s.id === stationId);

    if (stationIndex >= 0 && gridRef.current) {
      // v0.3.61: Calculate station's X position - align column flush after timeline
      const stationX = LAYOUT.PADDING_LEFT + stationIndex * (LAYOUT.STATION_WIDTH + LAYOUT.GAP);
      const scrollTargetX = Math.max(0, stationX - LAYOUT.PADDING_LEFT);

      // Smooth scroll to target column (300ms)
      gridRef.current.scrollTo(scrollTargetX, gridRef.current.getScrollY(), 'smooth');
    }

    console.log('Pick task from sidebar:', { taskId: task.id, jobId: job.id, stationId });
  }, [pickTask, snapshot.stations, LAYOUT]);

  // v0.3.57: Handle pick task from grid tile (for reschedule)
  // v0.3.61: No scroll or column hiding when picking from grid - user is already at the right location
  const handlePickTileFromGrid = useCallback((assignmentId: string, task: InternalTask, job: Job) => {
    // v0.3.55: Save current scroll position for restoration on cancel
    if (gridRef.current) {
      savedScrollPositionRef.current = {
        x: gridRef.current.getScrollX(),
        y: gridRef.current.getScrollY(),
      };
    }

    // Start pick mode with source='grid' and assignmentId for reschedule
    pickTask(task, job, 'grid', assignmentId);

    // v0.3.61: No scroll needed - user is already looking at the tile they clicked
    console.log('Pick task from grid (reschedule):', { assignmentId, taskId: task.id, jobId: job.id, stationId: task.stationId });
  }, [pickTask]);

  // Handle recall - remove assignment (double-click on tile)
  const handleRecallAssignment = useCallback((assignmentId: string) => {
    updateSnapshot((currentSnapshot) => {
      const assignment = currentSnapshot.assignments.find((a) => a.id === assignmentId);
      if (!assignment) {
        console.warn('Assignment not found for recall:', assignmentId);
        return currentSnapshot;
      }

      console.log('Recalling assignment:', {
        assignmentId,
        taskId: assignment.taskId,
      });

      // Remove the assignment
      return {
        ...currentSnapshot,
        assignments: currentSnapshot.assignments.filter((a) => a.id !== assignmentId),
      };
    });
    setSnapshotVersion((v) => v + 1);
  }, []);

  // REQ-14: Handle date click - scroll grid to the clicked date
  const handleDateClick = useCallback((date: Date) => {
    if (!gridRef.current) return;

    // Calculate Y position for the start of the clicked day (at START_HOUR)
    // Use multi-day calculation with gridStartDate
    const targetDate = new Date(date);
    targetDate.setHours(START_HOUR, 0, 0, 0);
    const y = timeToYPosition(targetDate, START_HOUR, pixelsPerHour, gridStartDate);

    // Scroll to position with a small offset from top
    const scrollTarget = Math.max(0, y);
    gridRef.current.scrollToY(scrollTarget);

    console.log('DateStrip click-to-scroll:', {
      date: date.toISOString().split('T')[0],
      scrollTarget,
    });
  }, [pixelsPerHour, gridStartDate]);

  // Handle toggle completion (v0.3.33)
  const handleToggleComplete = useCallback((assignmentId: string) => {
    updateSnapshot((currentSnapshot) => {
      const assignmentIndex = currentSnapshot.assignments.findIndex((a) => a.id === assignmentId);
      if (assignmentIndex === -1) {
        console.warn('Assignment not found for toggle:', assignmentId);
        return currentSnapshot;
      }

      const assignment = currentSnapshot.assignments[assignmentIndex];
      const newIsCompleted = !assignment.isCompleted;

      console.log('Toggling completion:', {
        assignmentId,
        from: assignment.isCompleted,
        to: newIsCompleted,
      });

      // Update the assignment
      const newAssignments = [...currentSnapshot.assignments];
      newAssignments[assignmentIndex] = {
        ...assignment,
        isCompleted: newIsCompleted,
        completedAt: newIsCompleted ? new Date().toISOString() : null,
      };

      return {
        ...currentSnapshot,
        assignments: newAssignments,
      };
    });
    setSnapshotVersion((v) => v + 1);
  }, []);

  // Quick Placement: get the LAST unscheduled task (for sidebar highlight)
  // In backward scheduling, we always show the last task as the one to place
  const lastUnscheduledTask = useMemo(() => {
    if (!isQuickPlacementMode || !selectedJob) {
      return null;
    }
    return getLastUnscheduledTask(selectedJob, snapshot.tasks, snapshot.assignments);
  }, [isQuickPlacementMode, selectedJob, snapshot.tasks, snapshot.assignments]);

  // Quick Placement: get the task for the hovered station (for validation)
  const quickPlacementTask = useMemo(() => {
    if (!isQuickPlacementMode || !selectedJob || !quickPlacementHover.stationId) {
      return null;
    }
    return getAvailableTaskForStation(
      selectedJob,
      snapshot.tasks,
      snapshot.assignments,
      quickPlacementHover.stationId
    );
  }, [isQuickPlacementMode, selectedJob, quickPlacementHover.stationId, snapshot.tasks, snapshot.assignments]);

  // Quick Placement: calculate scheduled start from Y position
  const quickPlacementScheduledStart = useMemo(() => {
    if (!quickPlacementHover.stationId || quickPlacementHover.snappedY === 0) {
      return null;
    }
    const dropTime = yPositionToTime(quickPlacementHover.snappedY, START_HOUR, gridStartDate);
    return dropTime.toISOString();
  }, [quickPlacementHover.stationId, quickPlacementHover.snappedY, gridStartDate]);

  // Quick Placement: validation using the same logic as drag
  const quickPlacementValidation = useDropValidation({
    snapshot,
    task: quickPlacementTask,
    targetStationId: quickPlacementHover.stationId,
    scheduledStart: quickPlacementScheduledStart,
    bypassPrecedence: false, // No bypass in quick placement mode
  });

  // Quick Placement: precedence constraint Y positions
  const quickPlacementPrecedenceConstraints = useMemo(() => {
    if (!quickPlacementTask) {
      return { earliestY: null, latestY: null };
    }
    const earliestY = getPredecessorConstraint(quickPlacementTask, snapshot, START_HOUR, pixelsPerHour, gridStartDate);
    const latestY = getSuccessorConstraint(quickPlacementTask, snapshot, START_HOUR, pixelsPerHour, gridStartDate);
    return { earliestY, latestY };
  }, [quickPlacementTask, snapshot, pixelsPerHour, gridStartDate]);

  // Quick Placement: handle mouse move in station column
  // v0.3.48: Use pixelsPerHour for zoom-aware snapping
  const handleQuickPlacementMouseMove = useCallback((stationId: string, y: number) => {
    const snappedY = snapToGrid(Math.max(0, y), pixelsPerHour);
    setQuickPlacementHover({ stationId, y, snappedY });
  }, [pixelsPerHour]);

  // Quick Placement: handle mouse leave from station column
  const handleQuickPlacementMouseLeave = useCallback(() => {
    setQuickPlacementHover({ stationId: null, y: 0, snappedY: 0 });
  }, []);

  // v0.3.54/v0.3.55: Pick mode mouse move handler with throttled real-time validation
  // v0.3.58: Ghost position is now handled by PickPreview via RAF (no setState here)
  // v0.3.58: setPickHover is throttled to reduce re-renders (only for PlacementIndicator)
  const handlePickMouseMove = useCallback((stationId: string, y: number) => {
    const snappedY = snapToGrid(Math.max(0, y), pixelsPerHour);

    // v0.3.58: Skip setPickHover if position is within same 15-min slot (reduce re-renders)
    const validationThreshold = pixelsPerHour / 4; // ~15 min slot
    const shouldUpdatePickHover = Math.abs(snappedY - lastValidatedYRef.current) >= validationThreshold;

    if (shouldUpdatePickHover) {
      setPickHover({ stationId, snappedY });
    }

    // v0.3.55: Throttled validation for ring color feedback (performance optimization)
    if (pickedTask && pickedTask.type === 'Internal') {
      // Clear previous throttle timer
      if (pickValidationThrottleRef.current) {
        clearTimeout(pickValidationThrottleRef.current);
      }

      pickValidationThrottleRef.current = setTimeout(() => {
        // v0.3.58: Early exit if position is within the same 15-minute slot
        if (Math.abs(snappedY - lastValidatedYRef.current) < validationThreshold) {
          return;
        }
        lastValidatedYRef.current = snappedY;

        const dropTime = yPositionToTime(snappedY, START_HOUR, gridStartDate, pixelsPerHour);
        const scheduledStart = dropTime.toISOString();

        const proposedAssignment: ProposedAssignment = {
          taskId: pickedTask.id,
          targetId: stationId,
          isOutsourced: false,
          scheduledStart,
          bypassPrecedence: isAltPressed,
        };
        const validationResult = validateAssignment(proposedAssignment, snapshot);

        // Use centralized blocking conflicts logic
        const blockingConflicts = getBlockingConflicts(
          validationResult.conflicts,
          isAltPressed,
          validationResult.suggestedStart
        );

        const hasPrecedenceConflict = validationResult.conflicts.some((c) => c.type === 'PrecedenceConflict');
        const hasWarningOnly = validationResult.conflicts.some(
          (c) => c.type === 'ApprovalGateConflict' && c.details?.gate === 'Plates'
        ) && blockingConflicts.length === 0;

        // v0.3.60: Pass conflicts to PickPreview for real-time message generation
        setPickValidation({
          isValid: blockingConflicts.length === 0,
          hasPrecedenceConflict,
          suggestedStart: validationResult.suggestedStart,
          hasWarningOnly,
          conflicts: validationResult.conflicts,
        });
      }, PICK_VALIDATION_THROTTLE_MS);
    }
  }, [pixelsPerHour, pickedTask, gridStartDate, isAltPressed, snapshot]);

  // v0.3.54: Pick mode mouse leave handler
  const handlePickMouseLeave = useCallback(() => {
    setPickHover({ stationId: null, snappedY: 0 });
    // v0.3.55: Clear throttle timer and reset validation
    if (pickValidationThrottleRef.current) {
      clearTimeout(pickValidationThrottleRef.current);
      pickValidationThrottleRef.current = null;
    }
    setPickValidation({ isValid: false, hasPrecedenceConflict: false, suggestedStart: null, hasWarningOnly: false, conflicts: [] });
    // v0.3.58: Reset last validated position for fresh validation on re-enter
    lastValidatedYRef.current = 0;
  }, []);

  // Quick Placement: handle click to place task
  const handleQuickPlacementClick = useCallback((stationId: string, y: number) => {
    if (!selectedJob || !isQuickPlacementMode) return;

    // Get the available task for this station
    const taskToPlace = getAvailableTaskForStation(
      selectedJob,
      snapshot.tasks,
      snapshot.assignments,
      stationId
    );

    if (!taskToPlace) {
      console.log('No task available to place on this station');
      return;
    }

    // Calculate the time from Y position (multi-day aware)
    // v0.3.48: Use pixelsPerHour for zoom-aware snapping
    const snappedY = snapToGrid(Math.max(0, y), pixelsPerHour);
    const dropTime = yPositionToTime(snappedY, START_HOUR, gridStartDate, pixelsPerHour);
    const scheduledStart = dropTime.toISOString();
    const station = snapshot.stations.find((s) => s.id === stationId);
    const scheduledEnd = calculateEndTime(taskToPlace, scheduledStart, station);

    // Validate placement before creating assignment
    const proposedAssignment: ProposedAssignment = {
      taskId: taskToPlace.id,
      targetId: stationId,
      isOutsourced: false,
      scheduledStart,
      bypassPrecedence: false,
    };
    const validationResult = validateAssignment(proposedAssignment, snapshot);

    // Check for blocking conflicts using centralized logic (no Alt bypass in quick placement)
    const blockingConflicts = getBlockingConflicts(
      validationResult.conflicts,
      false, // No Alt bypass in quick placement mode
      validationResult.suggestedStart
    );

    if (blockingConflicts.length > 0) {
      console.log('Quick placement blocked: validation failed', blockingConflicts);
      return;
    }

    // Create the assignment
    const newAssignment: TaskAssignment = {
      id: generateId(),
      taskId: taskToPlace.id,
      targetId: stationId,
      isOutsourced: false,
      scheduledStart,
      scheduledEnd,
      isCompleted: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Update snapshot with new assignment and push-down logic
    updateSnapshot((currentSnapshot) => {
      const { updatedAssignments, shiftedIds } = applyPushDown(
        currentSnapshot.assignments,
        stationId,
        scheduledStart,
        scheduledEnd,
        taskToPlace.id
      );

      if (shiftedIds.length > 0) {
        console.log('Push-down applied to assignments:', shiftedIds);
      }

      return {
        ...currentSnapshot,
        assignments: [...updatedAssignments, newAssignment],
      };
    });

    // Trigger re-render
    setSnapshotVersion((v) => v + 1);

    console.log('Quick placement assignment created:', {
      assignmentId: newAssignment.id,
      taskId: taskToPlace.id,
      stationId,
      scheduledStart,
      scheduledEnd,
    });
  }, [selectedJob, isQuickPlacementMode, snapshot.tasks, snapshot.assignments, snapshot.stations, gridStartDate, pixelsPerHour]);

  // Handle Pick & Place click - place picked task on station
  const handlePickPlaceClick = useCallback((stationId: string, clientY: number) => {
    if (!isPicking || !pickedTask || !pickedJob) return;

    // Only allow placing on the task's designated station
    if (pickedTask.type !== 'Internal' || pickedTask.stationId !== stationId) {
      console.log('Cannot place task on this station - wrong station');
      return;
    }

    // Find the station column element to calculate Y position
    // Use CSS.escape for safety in case stationId contains special characters
    const stationColumn = document.querySelector(`[data-testid="station-column-${CSS.escape(stationId)}"]`);
    if (!stationColumn) return;

    const rect = stationColumn.getBoundingClientRect();
    const relativeY = clientY - rect.top;

    // Calculate the time from Y position (multi-day aware, zoom-aware)
    const snappedY = snapToGrid(Math.max(0, relativeY), pixelsPerHour);
    const dropTime = yPositionToTime(snappedY, START_HOUR, gridStartDate, pixelsPerHour);
    const scheduledStart = dropTime.toISOString();
    const station = snapshot.stations.find((s) => s.id === stationId);
    const scheduledEnd = calculateEndTime(pickedTask, scheduledStart, station);

    // Validate placement before creating assignment
    const proposedAssignment: ProposedAssignment = {
      taskId: pickedTask.id,
      targetId: stationId,
      isOutsourced: false,
      scheduledStart,
      bypassPrecedence: isAltPressed,
    };
    const validationResult = validateAssignment(proposedAssignment, snapshot);

    // Check for blocking conflicts using centralized logic
    const blockingConflicts = getBlockingConflicts(
      validationResult.conflicts,
      isAltPressed,
      validationResult.suggestedStart
    );

    if (blockingConflicts.length > 0) {
      console.log('Pick & Place blocked: validation failed', blockingConflicts);
      return;
    }

    // v0.3.57: Handle reschedule (grid pick) vs new placement (sidebar pick)
    const isReschedule = pickSource === 'grid' && originalAssignmentId;

    // Update snapshot with assignment and push-down logic
    updateSnapshot((currentSnapshot) => {
      // For reschedule, exclude the original assignment from push-down calculation
      const assignmentsForPushDown = isReschedule
        ? currentSnapshot.assignments.filter((a) => a.id !== originalAssignmentId)
        : currentSnapshot.assignments;

      const { updatedAssignments, shiftedIds } = applyPushDown(
        assignmentsForPushDown,
        stationId,
        scheduledStart,
        scheduledEnd,
        pickedTask.id
      );

      if (shiftedIds.length > 0) {
        console.log('Push-down applied to assignments:', shiftedIds);
      }

      // Handle precedence conflict recording if Alt was pressed
      const newConflicts = currentSnapshot.conflicts.filter(
        (c) => !(c.type === 'PrecedenceConflict' && c.taskId === pickedTask.id)
      );
      if (isAltPressed && validationResult.conflicts.some((c) => c.type === 'PrecedenceConflict')) {
        newConflicts.push({
          type: 'PrecedenceConflict',
          message: 'Task placed before predecessor completes (Alt-key bypass)',
          taskId: pickedTask.id,
          targetId: stationId,
          details: { bypassedByUser: true },
        });
      }

      // Create or update assignment
      let finalAssignment: TaskAssignment;
      if (isReschedule) {
        // Reschedule: update existing assignment
        const existingAssignment = currentSnapshot.assignments.find((a) => a.id === originalAssignmentId);
        if (existingAssignment) {
          finalAssignment = {
            ...existingAssignment,
            scheduledStart,
            scheduledEnd,
            updatedAt: new Date().toISOString(),
          };
        } else {
          // Fallback: create new if original not found
          finalAssignment = {
            id: generateId(),
            taskId: pickedTask.id,
            targetId: stationId,
            isOutsourced: false,
            scheduledStart,
            scheduledEnd,
            isCompleted: false,
            completedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
      } else {
        // New placement: create new assignment
        finalAssignment = {
          id: generateId(),
          taskId: pickedTask.id,
          targetId: stationId,
          isOutsourced: false,
          scheduledStart,
          scheduledEnd,
          isCompleted: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      return {
        ...currentSnapshot,
        assignments: [...updatedAssignments, finalAssignment],
        conflicts: newConflicts,
      };
    });

    // Trigger re-render and end pick mode
    setSnapshotVersion((v) => v + 1);
    placeTask();

    console.log(isReschedule ? 'Pick & Place reschedule completed:' : 'Pick & Place assignment created:', {
      assignmentId: isReschedule ? originalAssignmentId : 'new',
      taskId: pickedTask.id,
      stationId,
      scheduledStart,
      scheduledEnd,
      pickSource,
    });
  }, [isPicking, pickedTask, pickedJob, isAltPressed, snapshot, gridStartDate, pixelsPerHour, placeTask, pickSource, originalAssignmentId]);

  // Global click handler for Pick & Place mode
  useEffect(() => {
    if (!isPicking) return;

    const handleGlobalClick = (e: MouseEvent) => {
      // Find if click was on a station column
      const target = e.target as HTMLElement;
      const stationColumn = target.closest('[data-testid^="station-column-"]');

      if (stationColumn) {
        // Extract station ID from data-testid
        const testId = stationColumn.getAttribute('data-testid');
        const stationId = testId?.replace('station-column-', '');

        if (stationId) {
          handlePickPlaceClick(stationId, e.clientY);
          e.preventDefault();
          e.stopPropagation();
        }
      } else {
        // Click outside grid - check if it's not on the sidebar task tiles
        const isTaskTile = target.closest('[data-testid^="task-tile-"]');
        const isJobDetailsPanel = target.closest('[data-testid="job-details-panel"]');

        if (!isTaskTile && !isJobDetailsPanel) {
          // v0.3.55: Cancel pick mode with scroll restoration
          handleCancelPick();
        }
      }
    };

    // Use capture phase to intercept clicks before other handlers
    document.addEventListener('click', handleGlobalClick, true);
    return () => document.removeEventListener('click', handleGlobalClick, true);
  }, [isPicking, handlePickPlaceClick, handleCancelPick]);

  // Calculate which stations have available tasks (for quick placement cursor)
  const stationsWithAvailableTasks = useMemo(() => {
    if (!isQuickPlacementMode || !selectedJob) {
      return new Set<string>();
    }
    const stationIds = new Set<string>();
    snapshot.stations.forEach((station) => {
      const task = getAvailableTaskForStation(
        selectedJob,
        snapshot.tasks,
        snapshot.assignments,
        station.id
      );
      if (task) {
        stationIds.add(station.id);
      }
    });
    return stationIds;
  }, [isQuickPlacementMode, selectedJob, snapshot.stations, snapshot.tasks, snapshot.assignments]);

  // Handle station compact - remove gaps between tiles (mock implementation)
  // Respects precedence: tasks cannot start before their predecessor ends
  const handleCompact = useCallback((stationId: string) => {
    setCompactingStationId(stationId);

    // Simulate async operation for UI feedback
    setTimeout(() => {
      // Use extracted helper function to reduce nesting depth
      updateSnapshot((currentSnapshot) =>
        compactStationAssignments(currentSnapshot, stationId, calculateEndTime)
      );

      setSnapshotVersion((v) => v + 1);
      setCompactingStationId(null);
    }, 300); // Small delay for visual feedback
  }, []);

  // Toggle Quick Placement (for TopNavBar button)
  const handleToggleQuickPlacement = useCallback(() => {
    if (selectedJobId) {
      setIsQuickPlacementMode((prev) => !prev);
      setQuickPlacementHover({ stationId: null, y: 0, snappedY: 0 });
    }
  }, [selectedJobId]);

  // Handle global timeline compaction (v0.3.35)
  const handleCompactTimeline = useCallback((horizonHours: CompactHorizon) => {
    setIsCompactingTimeline(true);

    // Simulate async operation for UI feedback
    setTimeout(() => {
      updateSnapshot((currentSnapshot) => {
        const result = compactTimeline({
          snapshot: currentSnapshot,
          horizonHours,
          calculateEndTime,
        });
        return result.snapshot;
      });

      setSnapshotVersion((v) => v + 1);
      setIsCompactingTimeline(false);
    }, 300); // Small delay for visual feedback
  }, []);

  return (
    <>
      {/* REQ-07: Layout restructure - sidebar full height */}
      <div className="h-screen bg-zinc-950 text-zinc-100 flex overflow-hidden">
        {/* Sidebar - full viewport height (REQ-07.1) */}
        <Sidebar />

        {/* Main area - right of sidebar */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Navigation Bar - now only spans width after sidebar (REQ-07.2/07.3) */}
          <TopNavBar
            isQuickPlacementMode={isQuickPlacementMode}
            onToggleQuickPlacement={handleToggleQuickPlacement}
            canEnableQuickPlacement={selectedJobId !== null}
            pixelsPerHour={pixelsPerHour}
            onZoomChange={handleZoomChange}
            onCompactTimeline={handleCompactTimeline}
            isCompacting={isCompactingTimeline}
          />

          {/* Content area */}
          <div className="flex-1 flex overflow-hidden">
          <JobsList
          jobs={snapshot.jobs}
          tasks={snapshot.tasks}
          assignments={snapshot.assignments}
          lateJobs={snapshot.lateJobs}
          conflicts={snapshot.conflicts}
          selectedJobId={selectedJobId}
          onSelectJob={setSelectedJobId}
        />
        <JobDetailsPanel
          job={selectedJob}
          tasks={snapshot.tasks}
          elements={snapshot.elements}
          assignments={snapshot.assignments}
          stations={snapshot.stations}
          activeTaskId={lastUnscheduledTask?.id}
          pickedTaskId={pickedTask?.id}
          onJumpToTask={handleJumpToTask}
          onRecallTask={handleRecallAssignment}
          onPickTask={handlePickTask}
          onClose={() => setSelectedJobId(null)}
          onDateClick={handleDateClick}
        />
        <DateStrip
          startDate={gridStartDate}
          onDateClick={handleDateClick}
          departureDate={departureDate}
          scheduledDays={scheduledDays}
          focusedDate={deferredFocusedDate}
          taskMarkersPerDay={taskMarkersPerDay}
          earliestTaskDate={earliestTaskDate}
        />
        <SchedulingGrid
          ref={gridRef}
          stations={snapshot.stations}
          categories={snapshot.categories}
          jobs={snapshot.jobs}
          tasks={snapshot.tasks}
          elements={snapshot.elements}
          assignments={snapshot.assignments}
          selectedJobId={deferredSelectedJobId}
          startHour={START_HOUR}
          hoursToDisplay={DAY_COUNT * 24}
          onScroll={handleGridScroll}
          startDate={gridStartDate}
          totalDays={DAY_COUNT}
          onSelectJob={setSelectedJobId}
          onSwapUp={handleSwapUp}
          onSwapDown={handleSwapDown}
          onRecallAssignment={handleRecallAssignment}
          onToggleComplete={handleToggleComplete}
          isQuickPlacementMode={isQuickPlacementMode}
          stationsWithAvailableTasks={stationsWithAvailableTasks}
          quickPlacementIndicatorY={quickPlacementHover.snappedY}
          quickPlacementHoverStationId={quickPlacementHover.stationId}
          onQuickPlacementMouseMove={handleQuickPlacementMouseMove}
          onQuickPlacementMouseLeave={handleQuickPlacementMouseLeave}
          onQuickPlacementClick={handleQuickPlacementClick}
          quickPlacementValidation={quickPlacementValidation}
          quickPlacementPrecedenceConstraints={quickPlacementPrecedenceConstraints}
          compactingStationId={compactingStationId}
          onCompact={handleCompact}
          conflicts={snapshot.conflicts}
          pixelsPerHour={pixelsPerHour}
          groups={snapshot.groups}
          providers={snapshot.providers}
          precedenceConstraints={precedenceConstraints}
          dryingTimeInfo={dryingTimeInfo}
          isPickMode={isPicking}
          pickSource={pickSource}
          pickTargetStationId={pickedTask?.type === 'Internal' ? pickedTask.stationId : null}
          pickHoverStationId={pickHover.stationId}
          pickIndicatorY={pickHover.snappedY}
          onPickMouseMove={handlePickMouseMove}
          onPickMouseLeave={handlePickMouseLeave}
          pickValidation={pickValidation}
          onPickTile={handlePickTileFromGrid}
          pickedAssignmentId={originalAssignmentId}
        />
          </div>
        </div>
      </div>

      {/* Pick preview - WYSIWYG ghost tile when a task is picked from sidebar */}
      {/* v0.3.60: Pass conflicts for real-time message generation */}
      {isPicking && pickedTask && pickedJob && (
        <PickPreview
          task={pickedTask}
          job={pickedJob}
          pixelsPerHour={pixelsPerHour}
          startHour={START_HOUR}
          gridStartDate={gridStartDate}
          stations={snapshot.stations}
          conflicts={pickValidation.conflicts}
          isValid={pickValidation.isValid}
          hasWarningOnly={pickValidation.hasWarningOnly}
        />
      )}
    </>
  );
}

// Main App component wrapping with providers
// v0.3.64: Added ViewportPositionProvider for smooth viewport indicator updates
function App() {
  return (
    <PickStateProvider>
      <ViewportPositionProvider>
        <AppContent />
      </ViewportPositionProvider>
    </PickStateProvider>
  );
}

export default App;
