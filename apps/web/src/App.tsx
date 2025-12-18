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
import type { Task, Job, InternalTask, TaskAssignment, ScheduleConflict, ScheduleSnapshot, Station } from '@flux/types';

const START_HOUR = 6;

// ============================================================================
// Helper functions extracted to reduce nesting depth (SonarQube S2004)
// ============================================================================

/**
 * Process a drop operation and return the updated snapshot.
 * Extracted from onDrop to reduce function nesting.
 */
function processDropAssignment(
  currentSnapshot: ScheduleSnapshot,
  task: InternalTask,
  stationId: string,
  scheduledStart: string,
  scheduledEnd: string,
  isRescheduleOp: boolean,
  assignmentId: string | undefined,
  bypassedPrecedence: boolean
): ScheduleSnapshot {
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

  let newConflicts = [...currentSnapshot.conflicts];
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
 * Compact station assignments by removing gaps.
 * Extracted from handleCompact to reduce function nesting.
 */
function compactStationAssignments(
  currentSnapshot: ScheduleSnapshot,
  stationId: string,
  calculateEndTimeFn: (task: InternalTask, start: string, station: Station | undefined) => string
): ScheduleSnapshot {
  // Get assignments for this station, sorted by start time
  const stationAssignments = currentSnapshot.assignments
    .filter((a) => a.targetId === stationId && !a.isOutsourced)
    .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

  if (stationAssignments.length === 0) {
    return currentSnapshot;
  }

  // Build task map for predecessor lookup
  const taskMap = new Map(currentSnapshot.tasks.map((t) => [t.id, t]));

  // Get the station for end time calculation
  const station = currentSnapshot.stations.find((s) => s.id === stationId);

  // Build a map to track updated end times (for precedence within same compact)
  const updatedEndTimes = new Map<string, Date>();

  // Start compacting from the first tile's position
  let nextStartTime = new Date(stationAssignments[0].scheduledStart);
  const updatedAssignmentsMap = new Map<string, { scheduledStart: string; scheduledEnd: string }>();

  for (const assignment of stationAssignments) {
    const task = taskMap.get(assignment.taskId);
    let earliestStart = nextStartTime;

    if (task) {
      // Find predecessor task (previous task in same job by sequenceOrder)
      const jobTasks = currentSnapshot.tasks
        .filter((t) => t.jobId === task.jobId)
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
      const taskIndex = jobTasks.findIndex((t) => t.id === task.id);

      if (taskIndex > 0) {
        const predecessorTask = jobTasks[taskIndex - 1];
        const updatedPredecessorEnd = updatedEndTimes.get(predecessorTask.id);

        if (updatedPredecessorEnd && updatedPredecessorEnd > earliestStart) {
          earliestStart = updatedPredecessorEnd;
        } else {
          const predecessorAssignment = currentSnapshot.assignments.find(
            (a) => a.taskId === predecessorTask.id
          );
          if (predecessorAssignment) {
            const predecessorEnd = new Date(predecessorAssignment.scheduledEnd);
            if (predecessorEnd > earliestStart) {
              earliestStart = predecessorEnd;
            }
          }
        }
      }
    }

    const newStart = earliestStart.toISOString();
    const newEnd = task && task.type === 'Internal'
      ? calculateEndTimeFn(task, newStart, station)
      : new Date(earliestStart.getTime() + (new Date(assignment.scheduledEnd).getTime() - new Date(assignment.scheduledStart).getTime())).toISOString();

    updatedAssignmentsMap.set(assignment.id, { scheduledStart: newStart, scheduledEnd: newEnd });
    updatedEndTimes.set(assignment.taskId, new Date(newEnd));
    nextStartTime = new Date(newEnd);
  }

  // Apply updates to all assignments
  const newAssignments = currentSnapshot.assignments.map((assignment) => {
    const updated = updatedAssignmentsMap.get(assignment.id);
    if (updated) {
      return {
        ...assignment,
        scheduledStart: updated.scheduledStart,
        scheduledEnd: updated.scheduledEnd,
        updatedAt: new Date().toISOString(),
      };
    }
    return assignment;
  });

  console.log('Station compacted:', {
    stationId,
    compactedCount: updatedAssignmentsMap.size,
  });

  return {
    ...currentSnapshot,
    assignments: newAssignments,
  };
}

// Inner App component that uses drag state context
function AppContent() {
  // Snapshot version state to force re-render on updates
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshotVersion triggers refetch
  const snapshot = useMemo(() => getSnapshot(), [snapshotVersion]);

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Get drag state from context (replaces local activeTask/activeJob state)
  const { state: dragState, updateValidation } = useDragState();
  const { activeTask, activeJob, isRescheduleDrag, grabOffset, activeAssignmentId } = dragState;

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        e.preventDefault();
        setIsAltPressed(true);
      }
      // ALT+Q to toggle Quick Placement Mode (use e.code for cross-platform support)
      if (e.altKey && e.code === 'KeyQ') {
        e.preventDefault();
        // Only allow quick placement mode when a job is selected
        if (selectedJobId) {
          setIsQuickPlacementMode((prev) => !prev);
          // Reset hover state when toggling
          setQuickPlacementHover({ stationId: null, y: 0, snappedY: 0 });
        }
      }
      // ESC to exit Quick Placement Mode
      if (e.key === 'Escape' && isQuickPlacementMode) {
        setIsQuickPlacementMode(false);
        setQuickPlacementHover({ stationId: null, y: 0, snappedY: 0 });
      }
      // ALT+↑ to select previous job
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        if (orderedJobIds.length > 0) {
          if (!selectedJobId) {
            // No job selected, select the first one
            setSelectedJobId(orderedJobIds[0]);
          } else {
            const currentIndex = orderedJobIds.indexOf(selectedJobId);
            if (currentIndex > 0) {
              setSelectedJobId(orderedJobIds[currentIndex - 1]);
            } else {
              // Wrap around to last job
              setSelectedJobId(orderedJobIds[orderedJobIds.length - 1]);
            }
          }
        }
      }
      // ALT+↓ to select next job
      if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        if (orderedJobIds.length > 0) {
          if (!selectedJobId) {
            // No job selected, select the first one
            setSelectedJobId(orderedJobIds[0]);
          } else {
            const currentIndex = orderedJobIds.indexOf(selectedJobId);
            if (currentIndex < orderedJobIds.length - 1) {
              setSelectedJobId(orderedJobIds[currentIndex + 1]);
            } else {
              // Wrap around to first job
              setSelectedJobId(orderedJobIds[0]);
            }
          }
        }
      }
      // ALT+D to jump to selected job's departure date (use e.code for cross-platform support)
      if (e.altKey && e.code === 'KeyD') {
        e.preventDefault();
        if (selectedJob?.workshopExitDate && gridRef.current) {
          const departureDate = new Date(selectedJob.workshopExitDate);
          const y = timeToYPosition(departureDate, START_HOUR);
          // Position departure date at bottom of viewport
          const viewportHeight = gridRef.current.getViewportHeight();
          const scrollTarget = Math.max(0, y - viewportHeight + 100); // 100px margin from bottom
          gridRef.current.scrollToY(scrollTarget);
        }
      }
      // Home to jump to today
      if (e.key === 'Home' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (gridRef.current) {
          const now = new Date();
          const y = timeToYPosition(now, START_HOUR);
          // Center today in viewport
          const viewportHeight = gridRef.current.getViewportHeight();
          const scrollTarget = Math.max(0, y - viewportHeight / 2);
          gridRef.current.scrollToY(scrollTarget);
        }
      }
      // Page Up to scroll up by one day
      if (e.key === 'PageUp' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (gridRef.current) {
          const oneDayPixels = 24 * PIXELS_PER_HOUR;
          gridRef.current.scrollByY(-oneDayPixels);
        }
      }
      // Page Down to scroll down by one day
      if (e.key === 'PageDown' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (gridRef.current) {
          const oneDayPixels = 24 * PIXELS_PER_HOUR;
          gridRef.current.scrollByY(oneDayPixels);
        }
      }
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
        // Track current pointer position
        currentPointerRef.current = {
          x: location.current.input.clientX,
          y: location.current.input.clientY,
        };

        // Find station column under pointer for validation
        const elements = document.elementsFromPoint(
          location.current.input.clientX,
          location.current.input.clientY
        );
        const stationColumnElement = elements.find(el =>
          el.getAttribute('data-testid')?.startsWith('station-column-')
        );

        if (!stationColumnElement || !activeTask) {
          setDragValidation((prev) => ({
            ...prev,
            targetStationId: null,
            scheduledStart: null,
          }));
          return;
        }

        const testId = stationColumnElement.getAttribute('data-testid');
        const stationId = testId?.replace('station-column-', '') || null;
        const rect = stationColumnElement.getBoundingClientRect();

        // Calculate tile top position using grab offset
        const relativeY = calculateTileTopPosition(
          location.current.input.clientY,
          rect.top,
          grabOffset.y
        );

        // Calculate drop time for validation
        const dropTime = yPositionToTime(relativeY, START_HOUR);

        setDragValidation((prev) => ({
          ...prev,
          targetStationId: stationId,
          scheduledStart: dropTime.toISOString(),
        }));
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
        if (!dragData || dragData.type !== 'task') return;

        // Find the drop target (station column under pointer)
        // Try pragmatic-dnd's dropTargets first, fallback to elementsFromPoint for synthetic events
        let targetStationId: string | null = null;
        const dropTargets = location.current.dropTargets;

        if (dropTargets.length > 0) {
          const dropData = dropTargets[0].data as StationDropData | undefined;
          if (dropData?.type === 'station-column') {
            targetStationId = dropData.stationId;
          }
        }

        // Fallback: use elementsFromPoint (for synthetic events in tests)
        if (!targetStationId) {
          const elements = document.elementsFromPoint(
            location.current.input.clientX,
            location.current.input.clientY
          );
          const stationElement = elements.find(el =>
            el.getAttribute('data-testid')?.startsWith('station-column-')
          );
          if (stationElement) {
            const testId = stationElement.getAttribute('data-testid');
            targetStationId = testId?.replace('station-column-', '') || null;
          }
        }

        if (!targetStationId) {
          console.log('Invalid drop: no station column found');
          return;
        }

        // Create dropData for compatibility with existing code
        const dropData: StationDropData = { type: 'station-column', stationId: targetStationId };

        // Calculate scheduledStart directly from coordinates (don't rely on potentially stale state)
        // This ensures test synthetic events work correctly
        let calculatedScheduledStart = currentDragValidation.scheduledStart;
        if (!calculatedScheduledStart) {
          const elements = document.elementsFromPoint(
            location.current.input.clientX,
            location.current.input.clientY
          );
          const stationColumnElement = elements.find(el =>
            el.getAttribute('data-testid')?.startsWith('station-column-')
          );
          if (stationColumnElement) {
            const rect = stationColumnElement.getBoundingClientRect();
            const relativeY = calculateTileTopPosition(
              location.current.input.clientY,
              rect.top,
              grabOffset.y
            );
            const dropTime = yPositionToTime(relativeY, START_HOUR);
            calculatedScheduledStart = dropTime.toISOString();
          }
        }

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
        const bypassedPrecedence = wasAltPressed && currentValidation.hasPrecedenceConflict;

        // Update snapshot using extracted helper function
        updateSnapshot((currentSnapshot) => processDropAssignment(
          currentSnapshot,
          task,
          dropData.stationId,
          scheduledStart,
          scheduledEnd,
          isRescheduleOp,
          dragData.assignmentId,
          bypassedPrecedence
        ));

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
