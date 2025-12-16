import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Sidebar, JobsList, JobDetailsPanel, DateStrip, SchedulingGrid } from './components';
import { DragPreview, snapToGrid, yPositionToTime } from './components/DragPreview';
import { getSnapshot, updateSnapshot } from './mock';
import { useDropValidation } from './hooks';
import { generateId, calculateEndTime, applyPushDown } from './utils';
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

  // Track Alt key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        e.preventDefault();
        setIsAltPressed(true);
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
  }, []);

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
    if (!currentValidation.isValid && !wasAltPressed) {
      console.log('Invalid drop: validation failed', currentValidation.conflicts);
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
          stations={snapshot.stations}
          categories={snapshot.categories}
          jobs={snapshot.jobs}
          tasks={snapshot.tasks}
          assignments={snapshot.assignments}
          selectedJobId={selectedJobId}
          onSelectJob={setSelectedJobId}
          activeTask={activeTask}
          activeJob={activeJob}
          validationState={{
            targetStationId: dragValidation.targetStationId,
            isValid: validation.isValid,
            hasPrecedenceConflict: validation.hasPrecedenceConflict,
            suggestedStart: validation.suggestedStart,
            isAltPressed,
          }}
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
