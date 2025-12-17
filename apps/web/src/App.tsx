import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
} from '@dnd-kit/core';
import { Sidebar, JobsList, JobDetailsPanel, DateStrip, SchedulingGrid, PIXELS_PER_HOUR, timeToYPosition } from './components';
import type { SchedulingGridHandle } from './components';
import { DragPreview, snapToGrid, yPositionToTime } from './components/DragPreview';
import { getSnapshot, updateSnapshot } from './mock';
import { useDropValidation } from './hooks';
import { generateId, calculateEndTime, applyPushDown, applySwap, getAvailableTaskForStation } from './utils';
import type { StationDropData } from './components/StationColumns';
import type { Task, Job, InternalTask, TaskAssignment, ScheduleConflict } from '@flux/types';

/** Data attached to draggable task tiles */
export interface TaskDragData {
  type: 'task';
  task: Task;
  job: Job;
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

function App() {
  // Snapshot version state to force re-render on updates
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshotVersion triggers refetch
  const snapshot = useMemo(() => getSnapshot(), [snapshotVersion]);

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeJob, setActiveJob] = useState<Job | null>(null);

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

  // Grid ref for programmatic scrolling
  const gridRef = useRef<SchedulingGridHandle>(null);

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
      // Reset validation state
      setDragValidation({
        targetStationId: null,
        scheduledStart: null,
        isValid: false,
        hasPrecedenceConflict: false,
        suggestedStart: null,
      });
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

    // Calculate relative Y position in the column
    // delta.y is from where the drag started, we need cursor position
    // Use the pointer position from the event
    const pointerY = (event.activatorEvent as PointerEvent)?.clientY ?? 0;
    const deltaY = event.delta.y;
    const relativeY = pointerY + deltaY - rect.top;

    // Snap to 30-minute grid
    const snappedY = snapToGrid(Math.max(0, relativeY));
    const dropTime = yPositionToTime(snappedY, START_HOUR);

    setDragValidation((prev) => ({
      ...prev,
      targetStationId: dropData.stationId,
      scheduledStart: dropTime.toISOString(),
    }));
  }, [activeTask]);

  // Handle drag end - create assignment on valid drop
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Capture current drag state before resetting
    const currentDragValidation = { ...dragValidation };
    const currentValidation = { ...validation };
    const wasAltPressed = isAltPressed;

    // Reset active state and validation
    setActiveTask(null);
    setActiveJob(null);
    setDragValidation({
      targetStationId: null,
      scheduledStart: null,
      isValid: false,
      hasPrecedenceConflict: false,
      suggestedStart: null,
    });

    // If not dropped on a valid target, do nothing
    if (!over) return;

    // Get drop data
    const dropData = over.data.current as StationDropData | undefined;
    const dragData = active.data.current as TaskDragData | undefined;

    if (dropData?.type !== 'station-column' || dragData?.type !== 'task') return;

    // Verify the task belongs to this station
    if (dragData.task.type !== 'Internal' || dragData.task.stationId !== dropData.stationId) {
      console.log('Invalid drop: task does not belong to this station');
      return;
    }

    // Use the validation result to determine if drop is valid
    // StationConflict is allowed because push-down will resolve it
    const blockingConflicts = currentValidation.conflicts.filter(
      (c) => c.type !== 'StationConflict'
    );
    const hasBlockingConflicts = blockingConflicts.length > 0;

    if (hasBlockingConflicts && !wasAltPressed) {
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

    const newAssignment: TaskAssignment = {
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

    // Update snapshot with new assignment and push-down logic
    updateSnapshot((currentSnapshot) => {
      // Apply push-down to existing assignments
      const { updatedAssignments, shiftedIds } = applyPushDown(
        currentSnapshot.assignments,
        dropData.stationId,
        scheduledStart,
        scheduledEnd,
        task.id
      );

      if (shiftedIds.length > 0) {
        console.log('Push-down applied to assignments:', shiftedIds);
      }

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
        assignments: [...updatedAssignments, newAssignment],
        conflicts: newConflicts,
      };
    });

    // Trigger re-render
    setSnapshotVersion((v) => v + 1);

    console.log('Assignment created:', {
      assignmentId: newAssignment.id,
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

  // Quick Placement: get available task for hovered station
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

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      autoScroll={false}
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
          activeTaskId={quickPlacementTask?.id}
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
            isValid: validation.isValid || validation.conflicts.every((c) => c.type === 'StationConflict'),
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
