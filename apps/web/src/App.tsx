import { useState, useMemo, useEffect, useCallback, useRef, useDeferredValue } from 'react';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { Sidebar, JobsList, JobDetailsPanel, DateStrip, SchedulingGrid, timeToYPosition, TopNavBar, DEFAULT_PIXELS_PER_HOUR } from './components';
import type { SchedulingGridHandle, TaskMarker } from './components';
import { snapToGrid, yPositionToTime } from './components/DragPreview';
import { getSnapshot, updateSnapshot } from './mock';
import { useDropValidation } from './hooks';
import { generateId, calculateEndTime, applyPushDown, applySwap, getAvailableTaskForStation, getLastUnscheduledTask, calculateTileTopPosition, compactTimeline, getPredecessorConstraint, getSuccessorConstraint, getDryingTimeInfo, getPrimaryValidationMessage } from './utils';
import type { DryingTimeInfo } from './utils';
import type { CompactHorizon } from './utils';
import {
  DragStateProvider,
  DragLayer,
  useDragState,
  type TaskDragData,
  type StationDropData,
  type DragValidationState,
} from './dnd';
import {
  PickStateProvider,
  PickPreview,
  usePickState,
  PICK_CURSOR_OFFSET_Y,
} from './pick';
import type { Task, Job, InternalTask, TaskAssignment, ScheduleSnapshot, Station, ProposedAssignment } from '@flux/types';
import { validateAssignment } from '@flux/schedule-validator';

// Multi-day grid starts at 00:00 (midnight) for each day
const START_HOUR = 0;
// v0.3.46: Restored to 365 days with virtual scrolling for performance
const DAY_COUNT = 365;

// ============================================================================
// Helper functions extracted to reduce nesting depth (SonarQube S2004)
// ============================================================================

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
// Drag helper functions (extracted to reduce cognitive complexity S3776)
// ============================================================================

/**
 * Find station column element from pointer coordinates.
 */
function findStationColumnFromPointer(clientX: number, clientY: number): HTMLElement | null {
  const elements = document.elementsFromPoint(clientX, clientY);
  return elements.find((el): el is HTMLElement =>
    el instanceof HTMLElement && el.dataset.testid?.startsWith('station-column-') === true
  ) || null;
}

/**
 * Extract station ID from station column element.
 */
function getStationIdFromElement(element: HTMLElement | null): string | null {
  if (!element) return null;
  return element.dataset.testid?.replace('station-column-', '') || null;
}

/**
 * Calculate scheduled start time from pointer position on a station column.
 * REQ-01/02/03: Apply snapToGrid before converting Y to time for consistent validation.
 * @param startDate - Grid start date for multi-day calculations (REQ-14)
 * @param pixelsPerHour - Current zoom level (pixels per hour)
 */
function calculateScheduledStartFromPointer(
  clientX: number,
  clientY: number,
  grabOffsetY: number,
  startDate?: Date,
  pixelsPerHour: number = DEFAULT_PIXELS_PER_HOUR
): string | null {
  const stationElement = findStationColumnFromPointer(clientX, clientY);
  if (!stationElement) return null;

  const rect = stationElement.getBoundingClientRect();
  // rect.top accounts for scroll position (becomes negative when scrolled)
  // so clientY - rect.top gives the absolute position in grid content
  const absoluteY = calculateTileTopPosition(clientY, rect.top, grabOffsetY);

  // REQ-01/02/03: Snap Y position before converting to time
  // This ensures validation uses the same snapped position as visual preview
  const snappedY = snapToGrid(absoluteY, pixelsPerHour);
  const dropTime = yPositionToTime(snappedY, START_HOUR, startDate, pixelsPerHour);
  return dropTime.toISOString();
}

// ============================================================================
// Keyboard shortcut handlers (extracted to reduce cognitive complexity S3776)
// ============================================================================

interface KeyboardContext {
  selectedJobId: string | null;
  isQuickPlacementMode: boolean;
  orderedJobIds: string[];
  selectedJob: Job | null;
  gridRef: React.RefObject<SchedulingGridHandle | null>;
  pixelsPerHour: number;
  gridStartDate: Date;
  setIsAltPressed: (v: boolean) => void;
  setSelectedJobId: (id: string | null) => void;
  setIsQuickPlacementMode: (fn: (prev: boolean) => boolean) => void;
  setQuickPlacementHover: (v: { stationId: string | null; y: number; snappedY: number }) => void;
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
  if (e.key === 'Escape' && ctx.isQuickPlacementMode) {
    ctx.setIsQuickPlacementMode(() => false);
    ctx.setQuickPlacementHover({ stationId: null, y: 0, snappedY: 0 });
    return true;
  }
  return false;
}

// v0.3.54: Handle ESC to cancel pick
function handleEscapePick(e: KeyboardEvent, cancelPick: () => void, isPicking: boolean): boolean {
  if (e.key === 'Escape' && isPicking) {
    cancelPick();
    return true;
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

  // Get drag state from context (replaces local activeTask/activeJob state)
  const { state: dragState, setPixelsPerHour: setContextPixelsPerHour } = useDragState();
  const { activeTask, activeJob, isRescheduleDrag, grabOffset } = dragState;

  // v0.3.54: Pick & Place state
  const { state: pickState, actions: pickActions } = usePickState();
  const { pickedTask, pickedJob, isPicking, targetStationId: pickTargetStationId } = pickState;

  // Alt key state for precedence bypass
  const [isAltPressed, setIsAltPressed] = useState(false);

  // Drag validation state (for real-time position tracking)
  const [dragValidation, setDragValidation] = useState<DragValidationState>({
    targetStationId: null,
    scheduledStart: null,
    isValid: false,
    hasPrecedenceConflict: false,
    suggestedStart: null,
    hasWarningOnly: false,
  });

  // Quick Placement Mode state
  const [isQuickPlacementMode, setIsQuickPlacementMode] = useState(false);
  const [quickPlacementHover, setQuickPlacementHover] = useState<{
    stationId: string | null;
    y: number;
    snappedY: number;
  }>({ stationId: null, y: 0, snappedY: 0 });

  // v0.3.54: Pick & Place validation state
  const [pickValidation, setPickValidation] = useState<{
    scheduledStart: string | null;
    ringState: 'none' | 'valid' | 'invalid' | 'warning' | 'bypass';
    message: string | null;
    debugConflicts: Array<{ type: string; message?: string }>;
  }>({ scheduledStart: null, ringState: 'none', message: null, debugConflicts: [] });

  // Compact station loading state
  const [compactingStationId, setCompactingStationId] = useState<string | null>(null);

  // Global timeline compact loading state (v0.3.35)
  const [isCompactingTimeline, setIsCompactingTimeline] = useState(false);

  // Zoom state (v0.3.34)
  const [pixelsPerHour, setPixelsPerHour] = useState(DEFAULT_PIXELS_PER_HOUR);

  // v0.3.48: Sync pixelsPerHour to DragStateContext for zoom-aware snapping
  useEffect(() => {
    setContextPixelsPerHour(pixelsPerHour);
  }, [pixelsPerHour, setContextPixelsPerHour]);

  // v0.3.54: Sync pixelsPerHour to PickStateContext for zoom-aware ghost snapping
  useEffect(() => {
    pickActions.setPixelsPerHour(pixelsPerHour);
  }, [pixelsPerHour, pickActions]);

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

  // Track current mouse position during drag
  const currentPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Use drop validation hook
  const validation = useDropValidation({
    snapshot,
    task: activeTask,
    targetStationId: dragValidation.targetStationId,
    scheduledStart: dragValidation.scheduledStart,
    bypassPrecedence: isAltPressed,
  });

  // DEBUG: Log validation state during drag (disabled for performance - v0.3.46)
  // Uncomment for debugging validation issues:
  // useEffect(() => {
  //   if (activeTask && dragValidation.targetStationId) {
  //     console.log('[Validation Debug]', {
  //       targetStationId: dragValidation.targetStationId,
  //       scheduledStart: dragValidation.scheduledStart,
  //       isValid: validation.isValid,
  //       hasPrecedenceConflict: validation.hasPrecedenceConflict,
  //       hasWarningOnly: validation.hasWarningOnly,
  //       hasGroupCapacityConflict: validation.hasGroupCapacityConflict,
  //       suggestedStart: validation.suggestedStart,
  //       conflicts: validation.conflicts.map(c => ({ type: c.type, message: c.message, details: c.details })),
  //       isAltPressed,
  //     });
  //   }
  // }, [activeTask, dragValidation.targetStationId, dragValidation.scheduledStart, validation, isAltPressed]);

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

  // REQ-10: Calculate precedence constraint Y positions during drag
  const precedenceConstraints = useMemo(() => {
    if (!activeTask) {
      return { earliestY: null, latestY: null };
    }
    const earliestY = getPredecessorConstraint(activeTask, snapshot, START_HOUR, pixelsPerHour, gridStartDate);
    const latestY = getSuccessorConstraint(activeTask, snapshot, START_HOUR, pixelsPerHour, gridStartDate);
    return { earliestY, latestY };
  }, [activeTask, snapshot, pixelsPerHour, gridStartDate]);

  // v0.3.54: Calculate precedence constraints for pick
  const pickPrecedenceConstraints = useMemo(() => {
    if (!pickedTask) {
      return { earliestY: null, latestY: null };
    }
    const earliestY = getPredecessorConstraint(pickedTask, snapshot, START_HOUR, pixelsPerHour, gridStartDate);
    const latestY = getSuccessorConstraint(pickedTask, snapshot, START_HOUR, pixelsPerHour, gridStartDate);
    return { earliestY, latestY };
  }, [pickedTask, snapshot, pixelsPerHour, gridStartDate]);

  // v0.3.54: Calculate drying time info during pick
  const pickDryingTimeInfo = useMemo((): DryingTimeInfo | null => {
    if (!pickedTask) {
      return null;
    }
    return getDryingTimeInfo(pickedTask, snapshot, START_HOUR, pixelsPerHour, gridStartDate);
  }, [pickedTask, snapshot, pixelsPerHour, gridStartDate]);

  // v0.3.51: Calculate drying time info during drag
  const dryingTimeInfo = useMemo((): DryingTimeInfo | null => {
    if (!activeTask) {
      return null;
    }
    return getDryingTimeInfo(activeTask, snapshot, START_HOUR, pixelsPerHour, gridStartDate);
  }, [activeTask, snapshot, pixelsPerHour, gridStartDate]);

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
  const scrollTimeoutRef = useRef<number | null>(null);

  // v0.3.47: Viewport hours for DateStrip indicator
  const [viewportStartHour, setViewportStartHour] = useState<number>(0);
  const [viewportEndHour, setViewportEndHour] = useState<number>(8);
  const lastScrollTopRef = useRef<number>(0);

  // Ref to track drag state without causing callback recreation
  const isDraggingRef = useRef(false);
  isDraggingRef.current = activeTask !== null;

  // Ref to avoid stale closure in scroll handler when zoom changes
  const pixelsPerHourRef = useRef(pixelsPerHour);
  pixelsPerHourRef.current = pixelsPerHour;

  // REQ-09.2: Handle grid scroll to calculate focused date
  // v0.3.47: Also calculate viewport hours for DateStrip indicator
  // CRITICAL: Skip updates during drag to prevent performance degradation
  const handleGridScroll = useCallback((scrollTop: number) => {
    // Store scrollTop for recalculation on zoom change
    lastScrollTopRef.current = scrollTop;

    // Skip focusedDate updates during drag operations - this is the primary performance fix
    // Use ref to avoid adding activeTask to dependencies (which would cause callback recreation)
    if (isDraggingRef.current) {
      return;
    }

    // Debounce: cancel previous timeout and set new one
    if (scrollTimeoutRef.current !== null) {
      cancelAnimationFrame(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = requestAnimationFrame(() => {
      // Use ref to get current pixelsPerHour (avoids stale closure on zoom change)
      const currentPixelsPerHour = pixelsPerHourRef.current;

      // Calculate focused date from scroll position
      // The focused date is the one visible at the center of the viewport
      const viewportHeight = gridRef.current?.getViewportHeight() ?? 600;
      const centerY = scrollTop + viewportHeight / 2;
      const hoursFromStart = centerY / currentPixelsPerHour;
      const focusedTime = new Date(gridStartDate);
      focusedTime.setTime(gridStartDate.getTime() + hoursFromStart * 60 * 60 * 1000);
      setFocusedDate(focusedTime);

      // v0.3.47: Calculate viewport hours from grid start (not clamped to single day)
      // This allows viewport indicator to span multiple days
      const startHourFromGridStart = scrollTop / currentPixelsPerHour;
      const endHourFromGridStart = (scrollTop + viewportHeight) / currentPixelsPerHour;

      setViewportStartHour(startHourFromGridStart);
      setViewportEndHour(endHourFromGridStart);
    });
  }, [gridStartDate]);

  // v0.3.47: Recalculate viewport when zoom (pixelsPerHour) changes
  // This ensures the viewport indicator stays on the correct day after zoom
  useEffect(() => {
    if (lastScrollTopRef.current > 0) {
      // Trigger recalculation with the stored scrollTop
      handleGridScroll(lastScrollTopRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixelsPerHour]); // handleGridScroll is stable, pixelsPerHour triggers recalc

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
      orderedJobIds,
      selectedJob,
      gridRef,
      pixelsPerHour,
      gridStartDate,
      setIsAltPressed,
      setSelectedJobId,
      setIsQuickPlacementMode,
      setQuickPlacementHover,
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Each handler returns true if it handled the event
      if (handleAltKey(e, ctx)) return;
      // v0.3.54: Handle ESC to cancel pick (priority over quick placement)
      if (handleEscapePick(e, () => {
        pickActions.cancelPick();
        setPickValidation({ scheduledStart: null, ringState: 'none', message: null, debugConflicts: [] });
      }, isPicking)) return;
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
  }, [selectedJobId, isQuickPlacementMode, orderedJobIds, selectedJob, pixelsPerHour, gridStartDate, isPicking, pickActions]);

  // Set up global drag monitoring using pragmatic-drag-and-drop
  // Handles: position tracking during drag, drop processing
  useEffect(() => {
    return monitorForElements({
      onDragStart: () => {
        // Reset validation state when drag starts
        setDragValidation({
          targetStationId: null,
          scheduledStart: null,
          isValid: false,
          hasPrecedenceConflict: false,
          suggestedStart: null,
          hasWarningOnly: false,
        });
      },
      onDrag: ({ location }) => {
        const { clientX, clientY } = location.current.input;
        currentPointerRef.current = { x: clientX, y: clientY };

        const stationElement = findStationColumnFromPointer(clientX, clientY);
        const stationId = getStationIdFromElement(stationElement);

        if (!stationElement || !activeTask) {
          // v0.3.46: Only update if values actually changed
          setDragValidation((prev) => {
            if (prev.targetStationId === null && prev.scheduledStart === null) return prev;
            return { ...prev, targetStationId: null, scheduledStart: null };
          });
          return;
        }

        const scheduledStart = calculateScheduledStartFromPointer(clientX, clientY, grabOffset.y, gridStartDate, pixelsPerHour);
        // v0.3.46: Only update state if values actually changed (performance optimization)
        setDragValidation((prev) => {
          if (prev.targetStationId === stationId && prev.scheduledStart === scheduledStart) {
            return prev; // No change, skip re-render
          }
          return { ...prev, targetStationId: stationId, scheduledStart };
        });
      },
      onDrop: ({ source, location }) => {
        // Capture current state before reset
        const currentDragValidation = { ...dragValidation };
        const currentValidation = { ...validation };
        const wasAltPressed = isAltPressed;

        // Reset validation state
        setDragValidation({
          targetStationId: null,
          scheduledStart: null,
          isValid: false,
          hasPrecedenceConflict: false,
          suggestedStart: null,
          hasWarningOnly: false,
        });

        // Get drag data
        const dragData = source.data as TaskDragData | undefined;
        if (dragData?.type !== 'task') return;

        // Find the drop target station
        const { clientX, clientY } = location.current.input;
        const dropTargets = location.current.dropTargets;

        // Try pragmatic-dnd's dropTargets first
        let targetStationId: string | null = null;
        if (dropTargets.length > 0) {
          const targetData = dropTargets[0].data as StationDropData | undefined;
          if (targetData?.type === 'station-column') {
            targetStationId = targetData.stationId;
          }
        }

        // Fallback: use elementsFromPoint (for synthetic events in tests)
        if (!targetStationId) {
          targetStationId = getStationIdFromElement(findStationColumnFromPointer(clientX, clientY));
        }

        if (!targetStationId) {
          console.log('Invalid drop: no station column found');
          return;
        }

        const dropData: StationDropData = { type: 'station-column', stationId: targetStationId };

        // Calculate scheduledStart (use cached or calculate from pointer)
        const calculatedScheduledStart = currentDragValidation.scheduledStart
          || calculateScheduledStartFromPointer(clientX, clientY, grabOffset.y, gridStartDate, pixelsPerHour);

        // Verify the task belongs to this station
        if (dragData.task.type !== 'Internal' || dragData.task.stationId !== dropData.stationId) {
          console.log('Invalid drop: task does not belong to this station');
          return;
        }

        // Determine if this is a reschedule
        const isRescheduleOp = !!dragData.assignmentId;

        // Check for blocking conflicts
        // Predecessor conflicts with suggestedStart can be auto-resolved by snapping
        // Successor conflicts are always blocking (no valid position exists)
        const blockingConflicts = currentValidation.conflicts.filter(
          (c) => c.type !== 'StationConflict' &&
                 !(c.type === 'PrecedenceConflict' &&
                   c.details?.constraintType === 'predecessor' &&
                   currentValidation.suggestedStart) &&
                 !(c.type === 'ApprovalGateConflict' && c.details?.gate === 'Plates')
        );

        if (blockingConflicts.length > 0 && !wasAltPressed) {
          console.log('Invalid drop: validation failed', JSON.stringify(blockingConflicts), JSON.stringify({
            currentValidation,
            currentDragValidation,
            calculatedScheduledStart,
            targetStationId,
          }));
          return;
        }

        // Calculate drop position
        const rawScheduledStart = currentValidation.hasPrecedenceConflict && !wasAltPressed && currentValidation.suggestedStart
          ? currentValidation.suggestedStart
          : calculatedScheduledStart;

        if (!rawScheduledStart) {
          console.log('Invalid drop: no scheduled start', { calculatedScheduledStart, currentDragValidation });
          return;
        }

        // Snap to 30-minute grid
        const startDate = new Date(rawScheduledStart);
        const minutes = startDate.getMinutes();
        const snappedMinutes = Math.round(minutes / 30) * 30;
        startDate.setMinutes(snappedMinutes, 0, 0);
        const scheduledStart = startDate.toISOString();

        // Create the assignment
        const task = dragData.task as InternalTask;
        const station = snapshot.stations.find((s) => s.id === dropData.stationId);
        const scheduledEnd = calculateEndTime(task, scheduledStart, station);

        // Fix for REQ-13: Check for precedence conflict WITHOUT bypass
        // The currentValidation may have been run with bypassPrecedence=true (when Alt pressed),
        // which skips precedence validation. We need to check if there's actually a conflict.
        let bypassedPrecedence = false;
        if (wasAltPressed) {
          const conflictCheckProposal: ProposedAssignment = {
            taskId: task.id,
            targetId: dropData.stationId,
            isOutsourced: false,
            scheduledStart,
            bypassPrecedence: false, // Check WITHOUT bypass to detect actual conflict
          };
          const conflictCheckResult = validateAssignment(conflictCheckProposal, snapshot);
          bypassedPrecedence = conflictCheckResult.conflicts.some(c => c.type === 'PrecedenceConflict');
        }

        // Update snapshot using extracted helper function
        updateSnapshot((currentSnapshot) => processDropAssignment({
          currentSnapshot,
          task,
          stationId: dropData.stationId,
          scheduledStart,
          scheduledEnd,
          isRescheduleOp,
          assignmentId: dragData.assignmentId,
          bypassedPrecedence,
        }));

        setSnapshotVersion((v) => v + 1);
        console.log(isRescheduleOp ? 'Rescheduled:' : 'Created:', { taskId: task.id, scheduledStart });
      },
    });
  }, [activeTask, grabOffset, dragValidation, validation, isAltPressed, snapshot.stations, gridStartDate, pixelsPerHour]);

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
      const STATION_WIDTH = 240; // w-60
      const GAP = 12; // gap-3
      const PADDING_LEFT = 12; // px-3

      // Calculate station's X position
      const stationX = PADDING_LEFT + stationIndex * (STATION_WIDTH + GAP);

      // Center the station in the viewport (accounting for timeline column width)
      const TIMELINE_WIDTH = 48; // w-12
      const viewportWidth = gridRef.current.getViewportWidth();
      scrollTargetX = Math.max(0, stationX - (viewportWidth - TIMELINE_WIDTH - STATION_WIDTH) / 2);
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
  }, [snapshot.stations, pixelsPerHour, gridStartDate]);

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

    // Check for blocking conflicts (same logic as drag & drop)
    const blockingConflicts = validationResult.conflicts.filter(
      (c) => c.type !== 'StationConflict' &&
             !(c.type === 'PrecedenceConflict' &&
               c.details?.constraintType === 'predecessor' &&
               validationResult.suggestedStart) &&
             !(c.type === 'ApprovalGateConflict' && c.details?.gate === 'Plates')
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

  // v0.3.54: Handle pick from sidebar (unscheduled task)
  const handlePickTask = useCallback((task: Task, job: Job) => {
    pickActions.pickFromSidebar(task, job);
    // Initialize ghost position at cursor (will be updated on mouse move)
    pickActions.updateGhostPosition(0, 0);
  }, [pickActions]);

  // v0.3.54: Handle mouse move during pick (update ghost position and validate)
  const handlePickMouseMove = useCallback((stationId: string, clientX: number, clientY: number, relativeY: number) => {
    // Update ghost position for RAF rendering (PickPreview handles offset internally)
    pickActions.updateGhostPosition(clientX, clientY);

    // Calculate tile top from cursor position (cursor is PICK_CURSOR_OFFSET_Y pixels inside the tile)
    const tileTopY = relativeY - PICK_CURSOR_OFFSET_Y;
    const snappedTileTop = snapToGrid(Math.max(0, tileTopY), pixelsPerHour);
    const dropTime = yPositionToTime(snappedTileTop, START_HOUR, gridStartDate, pixelsPerHour);
    const scheduledStart = dropTime.toISOString();

    // Validate placement
    const proposedAssignment: ProposedAssignment = {
      taskId: pickedTask?.id || '',
      targetId: stationId,
      isOutsourced: false,
      scheduledStart,
      bypassPrecedence: isAltPressed,
    };
    const validationResult = pickedTask ? validateAssignment(proposedAssignment, snapshot) : { isValid: false, conflicts: [] };

    // Check for blocking conflicts
    // Note: Unlike drag-and-drop, pick mode does NOT auto-snap to suggestedStart,
    // so PrecedenceConflict is always blocking (unless Alt-bypassed).
    // StationConflict IS blocking in pick mode (means overlap with another task).
    const blockingConflicts = validationResult.conflicts.filter(
      (c) => !(c.type === 'ApprovalGateConflict' && c.details?.gate === 'Plates')
    );

    // Determine ring state
    let ringState: 'none' | 'valid' | 'invalid' | 'warning' | 'bypass' = 'none';
    const hasWarningOnly = blockingConflicts.length === 0 &&
      validationResult.conflicts.some((c) => c.type === 'ApprovalGateConflict' && c.details?.gate === 'Plates');

    if (validationResult.isValid) {
      ringState = 'valid';
    } else if (blockingConflicts.length === 0) {
      ringState = validationResult.conflicts.some((c) => c.type === 'ApprovalGateConflict') ? 'warning' : 'valid';
    } else if (isAltPressed && validationResult.conflicts.some((c) => c.type === 'PrecedenceConflict')) {
      ringState = 'bypass';
    } else {
      ringState = 'invalid';
    }

    // Get validation message for display
    const message = getPrimaryValidationMessage(validationResult.conflicts, validationResult.isValid, hasWarningOnly);

    // Debug: store conflicts for overlay
    const debugConflicts = validationResult.conflicts.map(c => ({ type: c.type, message: c.message }));

    setPickValidation({ scheduledStart, ringState, message, debugConflicts });
  }, [pickActions, pickedTask, snapshot, isAltPressed, pixelsPerHour, gridStartDate]);

  // v0.3.54: Handle mouse leave during pick
  const handlePickMouseLeave = useCallback(() => {
    setPickValidation({ scheduledStart: null, ringState: 'none', message: null, debugConflicts: [] });
  }, []);

  // v0.3.54: Handle click to place during pick
  const handlePickClick = useCallback((stationId: string, clientX: number, clientY: number, relativeY: number) => {
    if (!pickedTask || !pickedJob) return;

    // Calculate tile top from cursor position (cursor is PICK_CURSOR_OFFSET_Y pixels inside the tile)
    const tileTopY = relativeY - PICK_CURSOR_OFFSET_Y;
    const snappedTileTop = snapToGrid(Math.max(0, tileTopY), pixelsPerHour);
    const dropTime = yPositionToTime(snappedTileTop, START_HOUR, gridStartDate, pixelsPerHour);
    const rawScheduledStart = dropTime.toISOString();

    // Snap to 30-minute grid
    const startDate = new Date(rawScheduledStart);
    const minutes = startDate.getMinutes();
    const snappedMinutes = Math.round(minutes / 30) * 30;
    startDate.setMinutes(snappedMinutes, 0, 0);
    const scheduledStart = startDate.toISOString();

    // Validate
    const proposedAssignment: ProposedAssignment = {
      taskId: pickedTask.id,
      targetId: stationId,
      isOutsourced: false,
      scheduledStart,
      bypassPrecedence: isAltPressed,
    };
    const validationResult = validateAssignment(proposedAssignment, snapshot);

    // Check for blocking conflicts
    // StationConflict IS blocking in pick mode (means overlap with another task)
    const blockingConflicts = validationResult.conflicts.filter(
      (c) => !(c.type === 'PrecedenceConflict' &&
               c.details?.constraintType === 'predecessor' &&
               validationResult.suggestedStart) &&
             !(c.type === 'ApprovalGateConflict' && c.details?.gate === 'Plates')
    );

    if (blockingConflicts.length > 0 && !isAltPressed) {
      console.log('Pick placement blocked: validation failed', blockingConflicts);
      return;
    }

    // Calculate end time
    const task = pickedTask as InternalTask;
    const station = snapshot.stations.find((s) => s.id === stationId);
    const scheduledEnd = calculateEndTime(task, scheduledStart, station);

    // Check for bypassed precedence
    let bypassedPrecedence = false;
    if (isAltPressed) {
      const conflictCheckProposal: ProposedAssignment = {
        taskId: task.id,
        targetId: stationId,
        isOutsourced: false,
        scheduledStart,
        bypassPrecedence: false,
      };
      const conflictCheckResult = validateAssignment(conflictCheckProposal, snapshot);
      bypassedPrecedence = conflictCheckResult.conflicts.some(c => c.type === 'PrecedenceConflict');
    }

    // Create assignment
    updateSnapshot((currentSnapshot) => processDropAssignment({
      currentSnapshot,
      task,
      stationId,
      scheduledStart,
      scheduledEnd,
      isRescheduleOp: false,
      assignmentId: undefined,
      bypassedPrecedence,
    }));

    setSnapshotVersion((v) => v + 1);
    pickActions.completePlacement();
    setPickValidation({ scheduledStart: null, ringState: 'none', message: null, debugConflicts: [] });
    console.log('Pick placement created:', { taskId: task.id, scheduledStart });
  }, [pickedTask, pickedJob, snapshot, isAltPressed, pixelsPerHour, gridStartDate, pickActions]);

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
          assignments={snapshot.assignments}
          stations={snapshot.stations}
          activeTaskId={lastUnscheduledTask?.id}
          pickedTaskId={pickedTask?.id}
          onJumpToTask={handleJumpToTask}
          onRecallTask={handleRecallAssignment}
          onPick={handlePickTask}
          onClose={() => setSelectedJobId(null)}
          onDateClick={handleDateClick}
        />
        <DateStrip
          startDate={gridStartDate}
          onDateClick={handleDateClick}
          departureDate={departureDate}
          scheduledDays={scheduledDays}
          focusedDate={focusedDate}
          viewportStartHour={viewportStartHour}
          viewportEndHour={viewportEndHour}
          taskMarkersPerDay={taskMarkersPerDay}
          earliestTaskDate={earliestTaskDate}
        />
        <SchedulingGrid
          ref={gridRef}
          stations={snapshot.stations}
          categories={snapshot.categories}
          jobs={snapshot.jobs}
          tasks={snapshot.tasks}
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
          activeTask={activeTask}
          activeJob={activeJob}
          validationState={{
            targetStationId: dragValidation.targetStationId,
            // StationConflict is allowed because push-down will resolve it
            isValid: validation.isValid ||
              validation.conflicts.every((c) => c.type === 'StationConflict'),
            hasPrecedenceConflict: validation.hasPrecedenceConflict,
            suggestedStart: validation.suggestedStart,
            isAltPressed,
            // Warning-only if we have Plates approval conflict but no blocking conflicts
            // Show warning even during reschedule for visual feedback
            hasWarningOnly: validation.hasWarningOnly,
            // REQ-18: Group capacity conflict
            hasGroupCapacityConflict: validation.hasGroupCapacityConflict,
          }}
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
          isRescheduleDrag={isRescheduleDrag}
          conflicts={snapshot.conflicts}
          pixelsPerHour={pixelsPerHour}
          groups={snapshot.groups}
          providers={snapshot.providers}
          precedenceConstraints={precedenceConstraints}
          dryingTimeInfo={dryingTimeInfo}
          isPicking={isPicking}
          pickTargetStationId={pickTargetStationId}
          pickRingState={pickValidation.ringState}
          onPickMouseMove={handlePickMouseMove}
          onPickMouseLeave={handlePickMouseLeave}
          onPickClick={handlePickClick}
          pickPrecedenceConstraints={pickPrecedenceConstraints}
          pickDryingTimeInfo={pickDryingTimeInfo}
        />
          </div>
        </div>
      </div>

      {/* Drag layer - portal-based preview of dragged tile */}
      {/* v0.3.52: Pass validation message for display during invalid drag */}
      <DragLayer validationMessage={validation.message} />

      {/* v0.3.54: Pick preview - ghost tile during pick */}
      <PickPreview
        validationMessage={pickValidation.message}
        debugInfo={{
          ringState: pickValidation.ringState,
          scheduledStart: pickValidation.scheduledStart,
          conflicts: pickValidation.debugConflicts,
        }}
      />
    </>
  );
}

// Main App component wrapping with DragStateProvider and PickStateProvider
function App() {
  return (
    <DragStateProvider>
      <PickStateProvider>
        <AppContent />
      </PickStateProvider>
    </DragStateProvider>
  );
}

export default App;
