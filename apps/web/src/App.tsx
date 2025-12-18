import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
  type CollisionDetection,
  type DroppableContainer,
} from '@dnd-kit/core';
import { Sidebar, JobsList, JobDetailsPanel, DateStrip, SchedulingGrid, PIXELS_PER_HOUR, timeToYPosition } from './components';
import type { SchedulingGridHandle } from './components';
import { DragPreview, snapToGrid, yPositionToTime } from './components/DragPreview';
import { getSnapshot, updateSnapshot } from './mock';
import { useDropValidation } from './hooks';
import { generateId, calculateEndTime, applyPushDown, applySwap, getAvailableTaskForStation, getLastUnscheduledTask, calculateGrabOffset, calculateTileTopPosition } from './utils';
import type { StationDropData } from './components/StationColumns';
import type { Task, Job, InternalTask, TaskAssignment, ScheduleConflict } from '@flux/types';

/** Data attached to draggable task tiles */
export interface TaskDragData {
  type: 'task';
  task: Task;
  job: Job;
  /** Assignment ID if this is a reschedule (existing tile being repositioned) */
  assignmentId?: string;
}

/** Validation state during drag */
export interface DragValidationState {
  targetStationId: string | null;
  scheduledStart: string | null;
  isValid: boolean;
  hasPrecedenceConflict: boolean;
  suggestedStart: string | null;
}

const START_HOUR = 6;

/**
 * Custom collision detection that uses document.elementsFromPoint() to find
 * the station column under the pointer. This bypasses dnd-kit's cached rect values
 * which can be stale during column collapse animations.
 */
const pointerBasedCollision: CollisionDetection = ({
  droppableContainers,
  pointerCoordinates,
}) => {
  if (!pointerCoordinates) {
    return [];
  }

  // Use browser's elementsFromPoint to find actual elements at pointer position
  const elements = document.elementsFromPoint(pointerCoordinates.x, pointerCoordinates.y);

  // Find station column element
  const stationColumnElement = elements.find(el =>
    el.getAttribute('data-testid')?.startsWith('station-column-')
  );

  if (!stationColumnElement) {
    return [];
  }

  // Extract station ID from data-testid
  const testId = stationColumnElement.getAttribute('data-testid');
  const stationId = testId?.replace('station-column-', '');
  const droppableId = `station-${stationId}`;

  // Find the matching droppable container
  const container = droppableContainers.find(c => c.id === droppableId);
  if (!container) {
    return [];
  }

  return [{
    id: droppableId,
    data: { droppableContainer: container },
  }];
};

function App() {
  // Snapshot version state to force re-render on updates
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshotVersion triggers refetch
  const snapshot = useMemo(() => getSnapshot(), [snapshotVersion]);

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  // Track if this is a reschedule drag (grid tile repositioning vs sidebar drag)
  const [isRescheduleDrag, setIsRescheduleDrag] = useState(false);

  // Alt key state for precedence bypass
  const [isAltPressed, setIsAltPressed] = useState(false);

  // Drag validation state
  const [dragValidation, setDragValidation] = useState<DragValidationState>({
    targetStationId: null,
    scheduledStart: null,
    isValid: false,
    hasPrecedenceConflict: false,
    suggestedStart: null,
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

  // Track current mouse position during drag (dnd-kit's delta doesn't give us this directly)
  const currentPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Track grab offset (where user grabbed within the tile) for tile-based drop positioning
  const grabOffsetRef = useRef<{ y: number }>({ y: 0 });

  // The mock snapshot is already a ScheduleSnapshot type
  // Just use it directly for validation

  // Use drop validation hook
  const validation = useDropValidation({
    snapshot,
    task: activeTask,
    targetStationId: dragValidation.targetStationId,
    scheduledStart: dragValidation.scheduledStart,
    bypassPrecedence: isAltPressed,
  });

  // Configure pointer sensor with activation constraint
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    })
  );

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

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as TaskDragData | undefined;
    if (data?.type === 'task') {
      setActiveTask(data.task);
      setActiveJob(data.job);
      // Track if this is a reschedule (grid tile repositioning) vs new placement (sidebar drag)
      setIsRescheduleDrag(!!data.assignmentId);
      // Reset validation state
      setDragValidation({
        targetStationId: null,
        scheduledStart: null,
        isValid: false,
        hasPrecedenceConflict: false,
        suggestedStart: null,
      });

      // Calculate grab offset (where user grabbed within the tile)
      // This enables tile-based drop positioning instead of cursor-based
      // Find the tile element from the activator event target
      // Look for both sidebar task tiles (task-tile-*) and grid tiles (tile-*)
      const activatorEvent = event.activatorEvent as PointerEvent | MouseEvent;
      const target = activatorEvent?.target as HTMLElement | null;
      const tileElement = (
        target?.closest('[data-testid^="task-tile-"]') ||
        target?.closest('[data-testid^="tile-"]')
      ) as HTMLElement | null;
      if (activatorEvent && tileElement) {
        const rect = tileElement.getBoundingClientRect();
        grabOffsetRef.current = { y: calculateGrabOffset(activatorEvent.clientY, rect.top) };
      } else {
        grabOffsetRef.current = { y: 0 };
      }

      // Set up pointer tracking during drag
      const handlePointerMove = (e: PointerEvent) => {
        currentPointerRef.current = { x: e.clientX, y: e.clientY };
      };
      window.addEventListener('pointermove', handlePointerMove);

      // Store cleanup function reference
      (window as unknown as { __cleanupPointerTracking?: () => void }).__cleanupPointerTracking = () => {
        window.removeEventListener('pointermove', handlePointerMove);
      };
    }
  };

  // Handle drag move - real-time validation
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const { over } = event;

    if (!over || !activeTask) {
      setDragValidation((prev) => ({
        ...prev,
        targetStationId: null,
        scheduledStart: null,
      }));
      return;
    }

    const dropData = over.data.current as StationDropData | undefined;
    if (dropData?.type !== 'station-column') {
      return;
    }

    // Get the droppable element's position to calculate Y offset
    const droppableElement = document.querySelector(`[data-testid="station-column-${dropData.stationId}"]`);
    if (!droppableElement) return;

    const rect = droppableElement.getBoundingClientRect();

    // Calculate tile top position using tile-based positioning
    // This subtracts the grab offset to get where the tile's top edge should be
    const relativeY = calculateTileTopPosition(
      currentPointerRef.current.y,
      rect.top,
      grabOffsetRef.current.y
    );

    // Snap to 30-minute grid
    const snappedY = snapToGrid(relativeY);
    const dropTime = yPositionToTime(snappedY, START_HOUR);

    setDragValidation((prev) => ({
      ...prev,
      targetStationId: dropData.stationId,
      scheduledStart: dropTime.toISOString(),
    }));
  }, [activeTask]);

  // Handle drag end - create or reschedule assignment on valid drop
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Capture current drag state before resetting
    const currentDragValidation = { ...dragValidation };
    const currentValidation = { ...validation };
    const wasAltPressed = isAltPressed;

    // Reset active state and validation
    setActiveTask(null);
    setActiveJob(null);
    setIsRescheduleDrag(false);
    setDragValidation({
      targetStationId: null,
      scheduledStart: null,
      isValid: false,
      hasPrecedenceConflict: false,
      suggestedStart: null,
    });

    // Clean up pointer tracking
    const cleanup = (window as unknown as { __cleanupPointerTracking?: () => void }).__cleanupPointerTracking;
    if (cleanup) {
      cleanup();
      delete (window as unknown as { __cleanupPointerTracking?: () => void }).__cleanupPointerTracking;
    }

    // If not dropped on a valid target, do nothing
    if (!over) return;

    // Get drop data
    const dropData = over.data.current as StationDropData | undefined;
    const dragData = active.data.current as TaskDragData | undefined;

    if (dropData?.type !== 'station-column' || dragData?.type !== 'task') return;

    // Verify the task belongs to this station
    if (dragData.task.type !== 'Internal' || dragData.task.stationId !== dropData.stationId) {
      console.log('Invalid drop: task does not belong to this station', {
        taskType: dragData.task.type,
        taskStationId: dragData.task.type === 'Internal' ? dragData.task.stationId : 'N/A',
        dropStationId: dropData.stationId,
      });
      return;
    }

    // Determine if this is a reschedule (moving existing tile) or new placement
    const isReschedule = !!dragData.assignmentId;

    // Use the validation result to determine if drop is valid
    // StationConflict is allowed because push-down will resolve it
    // Reschedule (moving existing tile) is always allowed within same station
    const blockingConflicts = currentValidation.conflicts.filter(
      (c) => c.type !== 'StationConflict'
    );
    const hasBlockingConflicts = blockingConflicts.length > 0;

    if (hasBlockingConflicts && !wasAltPressed && !isReschedule) {
      console.log('Invalid drop: validation failed', blockingConflicts);
      return;
    }

    // Calculate the drop position (use suggested start if precedence conflict without Alt)
    const scheduledStart = currentValidation.hasPrecedenceConflict && !wasAltPressed && currentValidation.suggestedStart
      ? currentValidation.suggestedStart
      : currentDragValidation.scheduledStart;

    if (!scheduledStart) {
      console.log('Invalid drop: no scheduled start');
      return;
    }

    // Create the assignment
    const task = dragData.task as InternalTask;
    const scheduledEnd = calculateEndTime(task, scheduledStart);
    const bypassedPrecedence = wasAltPressed && currentValidation.hasPrecedenceConflict;

    // Update snapshot with new/updated assignment and push-down logic
    updateSnapshot((currentSnapshot) => {
      let assignmentsWithoutCurrent = currentSnapshot.assignments;
      let existingAssignment: TaskAssignment | undefined;

      // For reschedule, find and remove the existing assignment first
      if (isReschedule && dragData.assignmentId) {
        existingAssignment = currentSnapshot.assignments.find(
          (a) => a.id === dragData.assignmentId
        );
        assignmentsWithoutCurrent = currentSnapshot.assignments.filter(
          (a) => a.id !== dragData.assignmentId
        );
      }

      // Apply push-down to remaining assignments (excluding the one being moved)
      const { updatedAssignments, shiftedIds } = applyPushDown(
        assignmentsWithoutCurrent,
        dropData.stationId,
        scheduledStart,
        scheduledEnd,
        task.id
      );

      if (shiftedIds.length > 0) {
        console.log('Push-down applied to assignments:', shiftedIds);
      }

      // Create the new/updated assignment
      const finalAssignment: TaskAssignment = isReschedule && existingAssignment
        ? {
            ...existingAssignment,
            scheduledStart,
            scheduledEnd,
            updatedAt: new Date().toISOString(),
          }
        : {
            id: generateId(),
            taskId: task.id,
            targetId: dropData.stationId,
            isOutsourced: false,
            scheduledStart,
            scheduledEnd,
            isCompleted: false,
            completedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

      // Add conflict if precedence was bypassed
      let newConflicts = [...currentSnapshot.conflicts];
      if (bypassedPrecedence) {
        const precedenceConflict: ScheduleConflict = {
          type: 'PrecedenceConflict',
          message: `Task placed before predecessor completes (Alt-key bypass)`,
          taskId: task.id,
          targetId: dropData.stationId,
          details: {
            bypassedByUser: true,
          },
        };
        newConflicts = [...newConflicts, precedenceConflict];
        console.log('Added precedence conflict for bypass');
      }

      return {
        ...currentSnapshot,
        assignments: [...updatedAssignments, finalAssignment],
        conflicts: newConflicts,
      };
    });

    // Trigger re-render
    setSnapshotVersion((v) => v + 1);

    console.log(isReschedule ? 'Assignment rescheduled:' : 'Assignment created:', {
      assignmentId: dragData.assignmentId || 'new',
      taskId: task.id,
      stationId: dropData.stationId,
      scheduledStart,
      scheduledEnd,
      bypassedPrecedence,
    });
  };

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
    const scheduledEnd = calculateEndTime(taskToPlace, scheduledStart);

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
  const handleCompact = useCallback((stationId: string) => {
    setCompactingStationId(stationId);

    // Simulate async operation for UI feedback
    setTimeout(() => {
      updateSnapshot((currentSnapshot) => {
        // Get assignments for this station, sorted by start time
        const stationAssignments = currentSnapshot.assignments
          .filter((a) => a.targetId === stationId && !a.isOutsourced)
          .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

        if (stationAssignments.length === 0) {
          return currentSnapshot;
        }

        // Start compacting from the first tile's position
        let nextStartTime = new Date(stationAssignments[0].scheduledStart);
        const updatedAssignments = new Map<string, { scheduledStart: string; scheduledEnd: string }>();

        stationAssignments.forEach((assignment) => {
          const duration = new Date(assignment.scheduledEnd).getTime() - new Date(assignment.scheduledStart).getTime();
          const newStart = nextStartTime.toISOString();
          const newEnd = new Date(nextStartTime.getTime() + duration).toISOString();

          updatedAssignments.set(assignment.id, { scheduledStart: newStart, scheduledEnd: newEnd });
          nextStartTime = new Date(nextStartTime.getTime() + duration);
        });

        // Apply updates to all assignments
        const newAssignments = currentSnapshot.assignments.map((assignment) => {
          const updated = updatedAssignments.get(assignment.id);
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
          compactedCount: updatedAssignments.size,
        });

        return {
          ...currentSnapshot,
          assignments: newAssignments,
        };
      });

      setSnapshotVersion((v) => v + 1);
      setCompactingStationId(null);
    }, 300); // Small delay for visual feedback
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerBasedCollision}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      autoScroll={false}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.Always,
        },
      }}
    >
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
            // Reschedule (moving existing tile) is always allowed within same station
            isValid: validation.isValid ||
              validation.conflicts.every((c) => c.type === 'StationConflict') ||
              isRescheduleDrag,
            hasPrecedenceConflict: validation.hasPrecedenceConflict,
            suggestedStart: validation.suggestedStart,
            isAltPressed,
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

      {/* Drag overlay - shows preview of dragged tile */}
      <DragOverlay dropAnimation={null}>
        {activeTask && activeJob && (
          <DragPreview task={activeTask} job={activeJob} />
        )}
      </DragOverlay>
    </DndContext>
  );
}

export default App;
