import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { Sidebar, JobsList, JobDetailsPanel, DateStrip, SchedulingGrid, PIXELS_PER_HOUR, timeToYPosition } from './components';
import type { SchedulingGridHandle } from './components';
import { snapToGrid, yPositionToTime } from './components/DragPreview';
import { getSnapshot, updateSnapshot } from './mock';
import { useDropValidation } from './hooks';
import { generateId, calculateEndTime, applyPushDown, applySwap, getAvailableTaskForStation, getLastUnscheduledTask, calculateTileTopPosition } from './utils';
import {
  DragStateProvider,
  DragLayer,
  useDragState,
  type TaskDragData,
  type StationDropData,
  type DragValidationState,
} from './dnd';
import type { Task, Job, InternalTask, TaskAssignment, ScheduleSnapshot, Station, ProposedAssignment } from '@flux/types';
import { validateAssignment } from '@flux/schedule-validator';

const START_HOUR = 6;

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
  let newConflicts = currentSnapshot.conflicts.filter(
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
 */
function calculateScheduledStartFromPointer(
  clientX: number,
  clientY: number,
  grabOffsetY: number
): string | null {
  const stationElement = findStationColumnFromPointer(clientX, clientY);
  if (!stationElement) return null;

  const rect = stationElement.getBoundingClientRect();
  const relativeY = calculateTileTopPosition(clientY, rect.top, grabOffsetY);
  const dropTime = yPositionToTime(relativeY, START_HOUR);
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

function handleToggleQuickPlacement(e: KeyboardEvent, ctx: KeyboardContext): boolean {
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
      const y = timeToYPosition(departureDate, START_HOUR);
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
      const y = timeToYPosition(now, START_HOUR);
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
      const oneDayPixels = 24 * PIXELS_PER_HOUR;
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

  // Get drag state from context (replaces local activeTask/activeJob state)
  const { state: dragState } = useDragState();
  const { activeTask, activeJob, isRescheduleDrag, grabOffset } = dragState;

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

  // Compact station loading state
  const [compactingStationId, setCompactingStationId] = useState<string | null>(null);

  // Grid ref for programmatic scrolling
  const gridRef = useRef<SchedulingGridHandle>(null);

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

  // Create lookup maps
  const jobMap = useMemo(() => {
    const map = new Map<string, Job>();
    snapshot.jobs.forEach((job) => map.set(job.id, job));
    return map;
  }, [snapshot.jobs]);

  // Find selected job
  const selectedJob = selectedJobId ? jobMap.get(selectedJobId) || null : null;

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
      setIsAltPressed,
      setSelectedJobId,
      setIsQuickPlacementMode,
      setQuickPlacementHover,
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Each handler returns true if it handled the event
      handleAltKey(e, ctx) ||
        handleToggleQuickPlacement(e, ctx) ||
        handleEscapeQuickPlacement(e, ctx) ||
        handleJobNavigation(e, ctx) ||
        handleJumpToDeparture(e, ctx) ||
        handleJumpToToday(e, ctx) ||
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
  }, [selectedJobId, isQuickPlacementMode, orderedJobIds, selectedJob]);

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
          setDragValidation((prev) => ({ ...prev, targetStationId: null, scheduledStart: null }));
          return;
        }

        const scheduledStart = calculateScheduledStartFromPointer(clientX, clientY, grabOffset.y);
        setDragValidation((prev) => ({ ...prev, targetStationId: stationId, scheduledStart }));
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
          || calculateScheduledStartFromPointer(clientX, clientY, grabOffset.y);

        // Verify the task belongs to this station
        if (dragData.task.type !== 'Internal' || dragData.task.stationId !== dropData.stationId) {
          console.log('Invalid drop: task does not belong to this station');
          return;
        }

        // Determine if this is a reschedule
        const isRescheduleOp = !!dragData.assignmentId;

        // Check for blocking conflicts
        const blockingConflicts = currentValidation.conflicts.filter(
          (c) => c.type !== 'StationConflict' &&
                 !(c.type === 'PrecedenceConflict' && currentValidation.suggestedStart) &&
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
  }, [activeTask, grabOffset, dragValidation, validation, isAltPressed, snapshot.stations]);

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

    // Calculate Y position from assignment's scheduledStart
    const startTime = new Date(assignment.scheduledStart);
    const y = timeToYPosition(startTime, START_HOUR);

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
  }, [snapshot.stations]);

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

  // Quick Placement: get available task for hovered station (for actual placement)
  // Note: Currently unused but may be needed for future tooltip/preview features
  const _quickPlacementTask = useMemo(() => {
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

  // Quick Placement: get the LAST unscheduled task (for sidebar highlight)
  // In backward scheduling, we always show the last task as the one to place
  const lastUnscheduledTask = useMemo(() => {
    if (!isQuickPlacementMode || !selectedJob) {
      return null;
    }
    return getLastUnscheduledTask(selectedJob, snapshot.tasks, snapshot.assignments);
  }, [isQuickPlacementMode, selectedJob, snapshot.tasks, snapshot.assignments]);

  // Quick Placement: handle mouse move in station column
  const handleQuickPlacementMouseMove = useCallback((stationId: string, y: number) => {
    const snappedY = snapToGrid(Math.max(0, y));
    setQuickPlacementHover({ stationId, y, snappedY });
  }, []);

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

    // Calculate the time from Y position
    const snappedY = snapToGrid(Math.max(0, y));
    const dropTime = yPositionToTime(snappedY, START_HOUR);
    const scheduledStart = dropTime.toISOString();
    const station = snapshot.stations.find((s) => s.id === stationId);
    const scheduledEnd = calculateEndTime(taskToPlace, scheduledStart, station);

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
  }, [selectedJob, isQuickPlacementMode, snapshot.tasks, snapshot.assignments]);

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

  return (
    <>
      <div className="h-screen bg-zinc-950 text-zinc-100 flex overflow-hidden">
        <Sidebar />
        <JobsList
          jobs={snapshot.jobs}
          tasks={snapshot.tasks}
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
          onJumpToTask={handleJumpToTask}
          onRecallTask={handleRecallAssignment}
        />
        <DateStrip
          startDate={(() => {
            const today = new Date();
            today.setDate(today.getDate() - 6); // Start 6 days before today
            return today;
          })()}
          dayCount={21}
        />
        <SchedulingGrid
          ref={gridRef}
          stations={snapshot.stations}
          categories={snapshot.categories}
          jobs={snapshot.jobs}
          tasks={snapshot.tasks}
          assignments={snapshot.assignments}
          selectedJobId={selectedJobId}
          onSelectJob={setSelectedJobId}
          onSwapUp={handleSwapUp}
          onSwapDown={handleSwapDown}
          onRecallAssignment={handleRecallAssignment}
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
          }}
          isQuickPlacementMode={isQuickPlacementMode}
          stationsWithAvailableTasks={stationsWithAvailableTasks}
          quickPlacementIndicatorY={quickPlacementHover.snappedY}
          quickPlacementHoverStationId={quickPlacementHover.stationId}
          onQuickPlacementMouseMove={handleQuickPlacementMouseMove}
          onQuickPlacementMouseLeave={handleQuickPlacementMouseLeave}
          onQuickPlacementClick={handleQuickPlacementClick}
          compactingStationId={compactingStationId}
          onCompact={handleCompact}
          isRescheduleDrag={isRescheduleDrag}
        />
      </div>

      {/* Drag layer - portal-based preview of dragged tile */}
      <DragLayer />
    </>
  );
}

// Main App component wrapping with DragStateProvider
function App() {
  return (
    <DragStateProvider>
      <AppContent />
    </DragStateProvider>
  );
}

export default App;
