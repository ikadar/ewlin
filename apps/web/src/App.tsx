import { useState, useMemo, useEffect, useCallback, useRef, useDeferredValue } from 'react';
import { Sidebar, JobsList, JobDetailsPanel, DateStrip, SchedulingGrid, timeToYPosition, TopNavBar, DEFAULT_PIXELS_PER_HOUR, TileContextMenu, JcfModal, JcfJobHeader, generateJobId } from './components';
import type { SchedulingGridHandle, TaskMarker } from './components';
import { snapToGrid, yPositionToTime, SNAP_INTERVAL_MINUTES } from './components/DragPreview';
import { getSnapshot, updateSnapshot } from './mock';
import { generateId, calculateEndTime, applyPushDown, applySwap, getAvailableTaskForStation, getLastUnscheduledTask, compactTimeline, getPredecessorConstraint, getSuccessorConstraint, getDryingTimeInfo, getPrimaryValidationMessage, getTasksForJob, getJobIdForTask } from './utils';
import { useDropValidation } from './hooks/useDropValidation';
import type { DryingTimeInfo } from './utils';
import type { CompactHorizon } from './utils';
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
 * Tasks in the same element (job) share the same elementId.
 */
function findPredecessorEndTime(
  task: Task,
  tasks: Task[],
  assignments: TaskAssignment[],
  updatedEndTimes: Map<string, Date>
): Date | null {
  // Tasks in the same element share the same elementId
  const elementTasks = tasks
    .filter((t) => t.elementId === task.elementId)
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const taskIndex = elementTasks.findIndex((t) => t.id === task.id);

  if (taskIndex <= 0) return null;

  const predecessorTask = elementTasks[taskIndex - 1];
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

  // v0.3.54: Pick & Place state
  // v0.3.57: Added assignmentId for grid picks (reschedule)
  const { state: pickState, actions: pickActions } = usePickState();
  const { pickedTask, pickedJob, isPicking, targetStationId: pickTargetStationId, pickSource, assignmentId: pickedAssignmentId } = pickState;

  // Alt key state for precedence bypass
  const [isAltPressed, setIsAltPressed] = useState(false);

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

  // v0.3.58: Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    assignmentId: string;
    isCompleted: boolean;
  } | null>(null);

  // v0.4.6: JCF modal state
  const [isJcfModalOpen, setIsJcfModalOpen] = useState(false);
  // v0.4.7: JCF form state (lifted from JcfJobHeader)
  const [jcfJobId, setJcfJobId] = useState('');
  const [jcfIntitule, setJcfIntitule] = useState('');
  const [jcfQuantity, setJcfQuantity] = useState('');
  const [jcfDeadline, setJcfDeadline] = useState('');
  // v0.4.8: Client and Template autocomplete state
  const [jcfClient, setJcfClient] = useState('');
  const [jcfTemplate, setJcfTemplate] = useState('');

  const handleOpenJcf = useCallback(() => {
    setJcfJobId(generateJobId());
    setIsJcfModalOpen(true);
  }, []);

  const handleCloseJcf = useCallback(() => {
    setIsJcfModalOpen(false);
    setJcfClient('');
    setJcfTemplate('');
    setJcfIntitule('');
    setJcfQuantity('');
    setJcfDeadline('');
  }, []);

  // v0.3.54: Sync pixelsPerHour to PickStateContext for zoom-aware ghost snapping
  useEffect(() => {
    pickActions.setPixelsPerHour(pixelsPerHour);
  }, [pixelsPerHour, pickActions]);

  // v0.3.56: Toggle body class for global grabbing cursor during pick mode
  useEffect(() => {
    if (isPicking) {
      document.body.classList.add('pick-mode-active');
    } else {
      document.body.classList.remove('pick-mode-active');
    }
    return () => document.body.classList.remove('pick-mode-active');
  }, [isPicking]);

  // Grid ref for programmatic scrolling
  const gridRef = useRef<SchedulingGridHandle>(null);

  // v0.3.55: Saved scroll position for sidebar pick cancel restoration
  const savedScrollRef = useRef<{ x: number; y: number } | null>(null);

  // v0.3.56: Track last validated slot for early-exit optimization
  const lastPickSlotRef = useRef<string | null>(null);

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
      getTasksForJob(selectedJobId, snapshot.tasks, snapshot.elements)
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
  }, [selectedJobId, snapshot.tasks, snapshot.elements, snapshot.assignments]);

  // v0.3.47: Task markers per day for DateStrip
  // Groups tasks by date and determines their status (completed, late, conflict, scheduled)
  const taskMarkersPerDay = useMemo((): Map<string, TaskMarker[]> => {
    const markers = new Map<string, TaskMarker[]>();
    if (!selectedJobId) return markers;

    const now = new Date();
    const conflictTaskIds = new Set(snapshot.conflicts.map((c) => c.taskId));

    // Get all tasks for the selected job
    const jobTasks = getTasksForJob(selectedJobId, snapshot.tasks, snapshot.elements);
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
  }, [selectedJobId, snapshot.tasks, snapshot.elements, snapshot.assignments, snapshot.conflicts]);

  // v0.3.47: Earliest task date for timeline (first scheduled task)
  const earliestTaskDate = useMemo((): Date | null => {
    if (!selectedJobId) return null;

    const jobTaskIds = new Set(
      getTasksForJob(selectedJobId, snapshot.tasks, snapshot.elements).map((t) => t.id)
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
  }, [selectedJobId, snapshot.tasks, snapshot.elements, snapshot.assignments]);

  // REQ-09.2: Focused date for DateStrip sync
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);

  // v0.3.47: Viewport hours for DateStrip indicator
  const [viewportStartHour, setViewportStartHour] = useState<number>(0);
  const [viewportEndHour, setViewportEndHour] = useState<number>(8);
  const lastScrollTopRef = useRef<number>(0);

  // Ref to avoid stale closure in scroll handler when zoom changes
  const pixelsPerHourRef = useRef(pixelsPerHour);
  pixelsPerHourRef.current = pixelsPerHour;

  // REQ-09.2: Handle grid scroll to calculate focused date
  // v0.3.47: Also calculate viewport hours for DateStrip indicator
  const handleGridScroll = useCallback((scrollTop: number) => {
    // Store scrollTop for recalculation on zoom change
    lastScrollTopRef.current = scrollTop;

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
      if (task) {
        const jobId = getJobIdForTask(task, snapshot.elements);
        if (jobId) conflictJobIds.add(jobId);
      }
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
  }, [snapshot.jobs, snapshot.lateJobs, snapshot.conflicts, snapshot.tasks, snapshot.elements]);

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
      // v0.3.55: Also restore scroll position for sidebar picks
      if (handleEscapePick(e, () => {
        // Restore scroll position for sidebar picks
        if (pickSource === 'sidebar' && savedScrollRef.current && gridRef.current) {
          gridRef.current.scrollTo(savedScrollRef.current.x, savedScrollRef.current.y, 'smooth');
          savedScrollRef.current = null;
        }
        lastPickSlotRef.current = null; // v0.3.56: Clear slot tracking
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
  }, [selectedJobId, isQuickPlacementMode, orderedJobIds, selectedJob, pixelsPerHour, gridStartDate, isPicking, pickActions, pickSource]);

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

  // v0.3.58: Handle context menu open
  const handleContextMenuOpen = useCallback((x: number, y: number, assignmentId: string, isCompleted: boolean) => {
    setContextMenu({ x, y, assignmentId, isCompleted });
  }, []);

  // v0.3.58: Handle context menu close
  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  // v0.3.58: Handle context menu "View details" action
  const handleContextMenuViewDetails = useCallback(() => {
    if (!contextMenu) return;
    const assignment = snapshot.assignments.find((a) => a.id === contextMenu.assignmentId);
    if (assignment) {
      const task = snapshot.tasks.find((t) => t.id === assignment.taskId);
      if (task) {
        const jobId = getJobIdForTask(task, snapshot.elements);
        if (jobId) setSelectedJobId(jobId);
      }
    }
  }, [contextMenu, snapshot.assignments, snapshot.tasks, snapshot.elements]);

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

  // v0.3.58: Handle context menu "Toggle completion" action
  const handleContextMenuToggleComplete = useCallback(() => {
    if (!contextMenu) return;
    handleToggleComplete(contextMenu.assignmentId);
  }, [contextMenu, handleToggleComplete]);

  // v0.3.58: Handle context menu "Move up" action
  const handleContextMenuMoveUp = useCallback(() => {
    if (!contextMenu) return;
    handleSwapUp(contextMenu.assignmentId);
  }, [contextMenu, handleSwapUp]);

  // v0.3.58: Handle context menu "Move down" action
  const handleContextMenuMoveDown = useCallback(() => {
    if (!contextMenu) return;
    handleSwapDown(contextMenu.assignmentId);
  }, [contextMenu, handleSwapDown]);

  // v0.3.58: Calculate if swap is available for context menu
  const getContextMenuSwapAvailability = useCallback(() => {
    if (!contextMenu) return { canSwapUp: false, canSwapDown: false };

    const assignment = snapshot.assignments.find((a) => a.id === contextMenu.assignmentId);
    if (!assignment) return { canSwapUp: false, canSwapDown: false };

    // Find adjacent tiles on the same station
    const stationAssignments = snapshot.assignments
      .filter((a) => a.targetId === assignment.targetId)
      .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

    const currentIndex = stationAssignments.findIndex((a) => a.id === contextMenu.assignmentId);

    return {
      canSwapUp: currentIndex > 0,
      canSwapDown: currentIndex < stationAssignments.length - 1,
    };
  }, [contextMenu, snapshot.assignments]);

  // Quick Placement: get the LAST unscheduled task (for sidebar highlight)
  // In backward scheduling, we always show the last task as the one to place
  const lastUnscheduledTask = useMemo(() => {
    if (!isQuickPlacementMode || !selectedJob) {
      return null;
    }
    return getLastUnscheduledTask(selectedJob, snapshot.tasks, snapshot.elements, snapshot.assignments);
  }, [isQuickPlacementMode, selectedJob, snapshot.tasks, snapshot.elements, snapshot.assignments]);

  // Quick Placement: get the task for the hovered station (for validation)
  const quickPlacementTask = useMemo(() => {
    if (!isQuickPlacementMode || !selectedJob || !quickPlacementHover.stationId) {
      return null;
    }
    return getAvailableTaskForStation(
      selectedJob,
      snapshot.tasks,
      snapshot.elements,
      snapshot.assignments,
      quickPlacementHover.stationId
    );
  }, [isQuickPlacementMode, selectedJob, quickPlacementHover.stationId, snapshot.tasks, snapshot.elements, snapshot.assignments]);

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
      snapshot.elements,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Only react to specific snapshot properties, not entire object
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
        snapshot.elements,
        snapshot.assignments,
        station.id
      );
      if (task) {
        stationIds.add(station.id);
      }
    });
    return stationIds;
  }, [isQuickPlacementMode, selectedJob, snapshot.stations, snapshot.tasks, snapshot.elements, snapshot.assignments]);

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
  // v0.3.55: Added scroll to target column and save scroll position
  const handlePickTask = useCallback((task: Task, job: Job) => {
    pickActions.pickFromSidebar(task, job);
    // Initialize ghost position at cursor (will be updated on mouse move)
    pickActions.updateGhostPosition(0, 0);

    // v0.3.55: Save current scroll position for cancel restoration
    if (gridRef.current) {
      savedScrollRef.current = {
        x: gridRef.current.getScrollX(),
        y: gridRef.current.getScrollY(),
      };

      // Scroll to target station column (for internal tasks)
      if (task.type === 'Internal') {
        const targetStationId = task.stationId;
        const stationIndex = snapshot.stations.findIndex((s) => s.id === targetStationId);
        if (stationIndex >= 0) {
          // Calculate X position: padding (12px) + index * (column width 240px + gap 12px)
          const PADDING = 12;
          const COLUMN_WIDTH = 240;
          const GAP = 12;
          const targetX = PADDING + stationIndex * (COLUMN_WIDTH + GAP);
          gridRef.current.scrollToX(targetX, 'smooth');
        }
      }
    }
  }, [pickActions, snapshot.stations]);

  // v0.3.57: Handle pick from grid (reschedule existing task)
  // No scroll needed as user is already at tile location
  const handlePickFromGrid = useCallback((task: InternalTask, job: Job, assignmentId: string) => {
    pickActions.pickFromGrid(task, job, assignmentId);
    // Initialize ghost position at cursor (will be updated on mouse move)
    pickActions.updateGhostPosition(0, 0);
    // No scroll position saving for grid picks - no scroll restoration needed
  }, [pickActions]);

  // v0.3.54: Handle mouse move during pick (update ghost position and validate)
  // v0.3.56: Added early-exit optimization when cursor stays in same slot
  const handlePickMouseMove = useCallback((stationId: string, clientX: number, clientY: number, relativeY: number) => {
    // Update ghost position for RAF rendering (PickPreview handles offset internally)
    pickActions.updateGhostPosition(clientX, clientY);

    // Calculate tile top from cursor position (cursor is PICK_CURSOR_OFFSET_Y pixels inside the tile)
    const tileTopY = relativeY - PICK_CURSOR_OFFSET_Y;
    const snappedTileTop = snapToGrid(Math.max(0, tileTopY), pixelsPerHour);

    // v0.3.56: Early-exit if cursor is in the same slot (skip redundant validation)
    const slotKey = `${stationId}-${snappedTileTop}`;
    if (slotKey === lastPickSlotRef.current) {
      return; // Ghost position already updated, skip validation
    }
    lastPickSlotRef.current = slotKey;

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
    const validationResult = pickedTask ? validateAssignment(proposedAssignment, snapshot) : { valid: false, conflicts: [] };

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

    if (validationResult.valid) {
      ringState = 'valid';
    } else if (blockingConflicts.length === 0) {
      ringState = validationResult.conflicts.some((c) => c.type === 'ApprovalGateConflict') ? 'warning' : 'valid';
    } else if (isAltPressed && validationResult.conflicts.some((c) => c.type === 'PrecedenceConflict')) {
      ringState = 'bypass';
    } else {
      ringState = 'invalid';
    }

    // Get validation message for display
    const message = getPrimaryValidationMessage(validationResult.conflicts, validationResult.valid, hasWarningOnly);

    // Debug: store conflicts for overlay
    const debugConflicts = validationResult.conflicts.map(c => ({ type: c.type, message: c.message }));

    setPickValidation({ scheduledStart, ringState, message, debugConflicts });
  }, [pickActions, pickedTask, snapshot, isAltPressed, pixelsPerHour, gridStartDate]);

  // v0.3.54: Handle mouse leave during pick
  const handlePickMouseLeave = useCallback(() => {
    setPickValidation({ scheduledStart: null, ringState: 'none', message: null, debugConflicts: [] });
  }, []);

  // v0.3.54: Handle click to place during pick
  // v0.3.57: Added reschedule support (when pickedAssignmentId exists)
  const handlePickClick = useCallback((stationId: string, clientX: number, clientY: number, relativeY: number) => {
    if (!pickedTask || !pickedJob) return;

    // Calculate tile top from cursor position (cursor is PICK_CURSOR_OFFSET_Y pixels inside the tile)
    const tileTopY = relativeY - PICK_CURSOR_OFFSET_Y;
    const snappedTileTop = snapToGrid(Math.max(0, tileTopY), pixelsPerHour);
    const dropTime = yPositionToTime(snappedTileTop, START_HOUR, gridStartDate, pixelsPerHour);
    const rawScheduledStart = dropTime.toISOString();

    // Snap to grid interval (SNAP_INTERVAL_MINUTES)
    const startDate = new Date(rawScheduledStart);
    const minutes = startDate.getMinutes();
    const snappedMinutes = Math.round(minutes / SNAP_INTERVAL_MINUTES) * SNAP_INTERVAL_MINUTES;
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
    // StationConflict is NOT blocking - push-down will handle overlapping tiles
    // PrecedenceConflict with suggestedStart is NOT blocking (can be placed at suggested time)
    // ApprovalGateConflict for Plates is NOT blocking
    const blockingConflicts = validationResult.conflicts.filter(
      (c) => c.type !== 'StationConflict' &&
             !(c.type === 'PrecedenceConflict' &&
               c.details?.constraintType === 'predecessor' &&
               validationResult.suggestedStart) &&
             !(c.type === 'ApprovalGateConflict' && c.details?.gate === 'Plates')
    );

    if (blockingConflicts.length > 0 && !isAltPressed) {
      console.log('Pick placement blocked: validation failed', blockingConflicts);
      // Cancel pick so the tile returns to its original state
      pickActions.cancelPick();
      setPickValidation({ scheduledStart: null, ringState: 'none', message: null, debugConflicts: [] });
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

    // v0.3.57: Determine if this is a reschedule (grid pick with assignmentId)
    const isRescheduleOp = pickedAssignmentId !== null;

    // Create/update assignment
    updateSnapshot((currentSnapshot) => processDropAssignment({
      currentSnapshot,
      task,
      stationId,
      scheduledStart,
      scheduledEnd,
      isRescheduleOp,
      assignmentId: pickedAssignmentId ?? undefined,
      bypassedPrecedence,
    }));

    setSnapshotVersion((v) => v + 1);
    pickActions.completePlacement();
    lastPickSlotRef.current = null; // v0.3.56: Clear slot tracking on successful placement
    setPickValidation({ scheduledStart: null, ringState: 'none', message: null, debugConflicts: [] });
    console.log(isRescheduleOp ? 'Pick reschedule completed:' : 'Pick placement created:', { taskId: task.id, scheduledStart });
  }, [pickedTask, pickedJob, snapshot, isAltPressed, pixelsPerHour, gridStartDate, pickActions, pickedAssignmentId]);

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
          elements={snapshot.elements}
          assignments={snapshot.assignments}
          lateJobs={snapshot.lateJobs}
          conflicts={snapshot.conflicts}
          selectedJobId={selectedJobId}
          onSelectJob={setSelectedJobId}
          onAddJob={handleOpenJcf}
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
          isPicking={isPicking}
          pickTargetStationId={pickTargetStationId}
          pickRingState={pickValidation.ringState}
          pickSource={pickSource}
          onPickMouseMove={handlePickMouseMove}
          onPickMouseLeave={handlePickMouseLeave}
          onPickClick={handlePickClick}
          pickPrecedenceConstraints={pickPrecedenceConstraints}
          pickDryingTimeInfo={pickDryingTimeInfo}
          pickedAssignmentId={pickedAssignmentId}
          onPickFromGrid={handlePickFromGrid}
          onContextMenu={handleContextMenuOpen}
        />
          </div>
        </div>
      </div>

      {/* v0.3.54: Pick preview - ghost tile during pick */}
      <PickPreview
        validationMessage={pickValidation.message}
        debugInfo={{
          ringState: pickValidation.ringState,
          scheduledStart: pickValidation.scheduledStart,
          conflicts: pickValidation.debugConflicts,
        }}
      />

      {/* v0.3.58: Context menu for tiles */}
      {contextMenu && (
        <TileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isCompleted={contextMenu.isCompleted}
          canSwapUp={getContextMenuSwapAvailability().canSwapUp}
          canSwapDown={getContextMenuSwapAvailability().canSwapDown}
          onViewDetails={handleContextMenuViewDetails}
          onToggleComplete={handleContextMenuToggleComplete}
          onSwapUp={handleContextMenuMoveUp}
          onSwapDown={handleContextMenuMoveDown}
          onClose={handleContextMenuClose}
        />
      )}

      {/* v0.4.6: JCF Modal */}
      <JcfModal isOpen={isJcfModalOpen} onClose={handleCloseJcf}>
        <JcfJobHeader
          jobId={jcfJobId}
          client={jcfClient}
          onClientChange={setJcfClient}
          template={jcfTemplate}
          onTemplateChange={setJcfTemplate}
          intitule={jcfIntitule}
          onIntituleChange={setJcfIntitule}
          quantity={jcfQuantity}
          onQuantityChange={setJcfQuantity}
          deadline={jcfDeadline}
          onDeadlineChange={setJcfDeadline}
        />
      </JcfModal>
    </>
  );
}

// Main App component wrapping with PickStateProvider
function App() {
  return (
    <PickStateProvider>
      <AppContent />
    </PickStateProvider>
  );
}

export default App;
