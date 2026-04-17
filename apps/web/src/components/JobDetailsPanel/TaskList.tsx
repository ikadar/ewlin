import { useMemo } from 'react';
import type { Task, TaskAssignment, Station, StationCategory, Job, Element, OutsourcedProvider, InternalTask } from '@flux/types';
import { isMultiElementJob } from '@flux/types';
import { isLastTaskOfJob, compareTaskOrder } from '../../utils/taskHelpers';
import { TaskTile } from './TaskTile';
import { DryTimeLabel } from './DryTimeLabel';
import { ElementSection } from './ElementSection';

export interface TaskListProps {
  /** Tasks to display */
  tasks: Task[];
  /** Elements for the job */
  elements: Element[];
  /** Job for color */
  job: Job;
  /** All assignments to check if tasks are scheduled */
  assignments: TaskAssignment[];
  /** All stations to get station names */
  stations: Station[];
  /** Station categories for printing/die-cutting detection */
  categories?: StationCategory[];
  /** v0.5.11: All providers for outsourced tasks */
  providers?: OutsourcedProvider[];
  /** Task ID that is the active placement target in Quick Placement Mode */
  activeTaskId?: string | null;
  /** Task IDs involved in precedence conflicts (for amber glow highlighting) */
  conflictTaskIds?: Set<string>;
  /** Job IDs that are late (past workshop exit date) */
  lateJobIds?: Set<string>;
  /** Job IDs that are shipped (highest priority tile coloring) */
  shippedJobIds?: Set<string>;
  /** Callback when a scheduled task is clicked (jump to grid) */
  onJumpToTask?: (assignment: TaskAssignment) => void;
  /** Callback to recall (unschedule) a task, triggered via context menu */
  onRecallTask?: (assignmentId: string) => void;
  /** v0.5.11: Callback when manual departure changes for outsourced task */
  onDepartureChange?: (taskId: string, departure: Date | undefined) => void;
  /** v0.5.11: Callback when manual return changes for outsourced task */
  onReturnChange?: (taskId: string, returnDate: Date | undefined) => void;
  /** Callback when completion icon is clicked (assignmentId) */
  onToggleComplete?: (assignmentId: string) => void;
  /** Callback when outsourced task done circle is clicked (taskId) */
  onToggleOutsourcedDone?: (taskId: string) => void;
  /** Callback when pin icon is clicked (assignmentId) */
  onTogglePin?: (assignmentId: string) => void;
  /** Callback when right-clicking a scheduled tile (context menu) */
  onContextMenu?: (x: number, y: number, assignmentId: string, isCompleted: boolean, isPinned: boolean) => void;
  /** Operators from snapshot (for displaying names on assignments) */
  snapshotOperators?: Array<{ id: string; firstName: string; lastName: string }>;
  /** Callback to scroll the grid to a specific operator slice (operator view) */
  onJumpToOperatorSlice?: (operatorId: string, from: Date) => void;
}

/**
 * Scrollable list of task tiles for the selected job, grouped by element.
 */
export function TaskList({
  tasks,
  elements,
  job,
  assignments,
  stations,
  providers = [],
  categories = [],
  activeTaskId,
  conflictTaskIds,
  lateJobIds,
  shippedJobIds,
  onJumpToTask,
  onRecallTask,
  onDepartureChange,
  onReturnChange,
  onToggleComplete,
  onToggleOutsourcedDone,
  onTogglePin,
  onContextMenu,
  snapshotOperators,
  onJumpToOperatorSlice,
}: TaskListProps) {
  // Create lookup maps for efficient access (memoized to avoid rebuilding on every render)
  const { assignmentByTaskId, stationById, taskById, providerById } = useMemo(() => ({
    assignmentByTaskId: new Map(assignments.map((a) => [a.taskId, a])),
    stationById: new Map(stations.map((s) => [s.id, s])),
    taskById: new Map(tasks.map((t) => [t.id, t])),
    providerById: new Map(providers.map((p) => [p.id, p])),
  }), [assignments, stations, tasks, providers]);

  if (tasks.length === 0) {
    return (
      <div className="p-3 flex-grow bg-transparent">
        <div className="text-zinc-500 text-sm text-center py-4">
          Aucune tâche
        </div>
      </div>
    );
  }

  /**
   * Get category name for a station.
   */
  const getCategoryName = (categoryId: string): string => {
    return categories.find((c) => c.id === categoryId)?.name.toLowerCase() ?? '';
  };

  /**
   * Check if a task is assigned to a printing station (offset press).
   * Used by the dry-time separator to render between print and follow-up tasks.
   */
  const isPrintingTask = (task: Task): boolean => {
    if (task.type !== 'Internal') return false;
    const station = stationById.get(task.stationId);
    if (!station) return false;
    return getCategoryName(station.categoryId).includes('offset');
  };

  /**
   * Get the latest scheduledEnd from cross-element predecessor tasks.
   * Used when the first task in an element needs a predecessorEndTime from prerequisite elements.
   */
  const getCrossElementPredecessorEnd = (element: Element): string | undefined => {
    if (element.prerequisiteElementIds.length === 0) return undefined;

    // Only return a value when ALL prerequisite elements' last tasks are scheduled
    let latest: string | undefined;
    for (const prereqId of element.prerequisiteElementIds) {
      const prereqElem = elements.find((e) => e.id === prereqId);
      if (!prereqElem) return undefined;
      const prereqTasks = prereqElem.taskIds
        .map((id) => taskById.get(id))
        .filter((t): t is Task => t !== undefined)
        .sort(compareTaskOrder);
      const lastTask = prereqTasks[prereqTasks.length - 1];
      if (!lastTask) return undefined;
      const lastAssignment = assignmentByTaskId.get(lastTask.id);
      if (!lastAssignment?.scheduledEnd) return undefined;
      if (!latest || lastAssignment.scheduledEnd > latest) {
        latest = lastAssignment.scheduledEnd;
      }
    }
    return latest;
  };

  /**
   * Render task tiles for an element
   */
  const renderTaskTiles = (elementTasks: Task[], element: Element) => {
    const sortedTasks = [...elementTasks].sort(compareTaskOrder);

    return sortedTasks.map((task, index) => {
      const assignment = assignmentByTaskId.get(task.id);
      const stationId = task.type === 'Internal' ? task.stationId : undefined;
      const station = stationId ? stationById.get(stationId) : undefined;

      // v0.5.11: Get provider for outsourced tasks
      const provider = task.type === 'Outsourced' ? providerById.get(task.providerId) : undefined;

      // v0.5.11: Get predecessor end time for outsourcing calculations
      // First try intra-element predecessor, then fall back to cross-element predecessors
      const prevTask = index > 0 ? sortedTasks[index - 1] : null;
      const prevAssignment = prevTask ? assignmentByTaskId.get(prevTask.id) : undefined;
      const predecessorEndTime = prevAssignment?.scheduledEnd
          ?? (index === 0 ? getCrossElementPredecessorEnd(element) : undefined);

      // Check if previous task is a printing task (for dry time label)
      // Skip dry time between parts of the same split group (still same print run)
      const sameGroup = prevTask
        && task.type === 'Internal' && prevTask.type === 'Internal'
        && (task as InternalTask).splitGroupId != null
        && (task as InternalTask).splitGroupId === (prevTask as InternalTask).splitGroupId;
      const showDryTimeLabel = prevTask && isPrintingTask(prevTask) && !sameGroup;

      // One-way shipping: last outsourced task of a job ships directly to client
      const isLastTask = task.type === 'Outsourced' && isLastTaskOfJob(task.id, elements, tasks);

      // Compute tile state for state-based coloring
      const isScheduled = !!assignment;
      // Outsourced tasks use task.status (shared with Flux ST column); internal use assignment
      const isCompleted = task.type === 'Outsourced'
        ? task.status === 'Completed'
        : (assignment?.isCompleted ?? false);
      const isJobShipped = shippedJobIds?.has(job.id) ?? false;
      const isJobLate = lateJobIds?.has(job.id) ?? false;
      const isTaskOverdue = isScheduled && !isCompleted && new Date(assignment!.scheduledEnd) < new Date();
      // Outsourced tasks with manual dates but no assignment: check manual return/departure
      const isOutsourcedOverdue = !isScheduled && task.type === 'Outsourced' && (() => {
        // One-way tasks (last task of job) use departure; others use return
        const dateToCheck = isLastTask ? task.manualDeparture : (task.manualReturn ?? undefined);
        return !!dateToCheck && new Date(dateToCheck) < new Date();
      })();
      const isLate = isJobLate || isTaskOverdue || isOutsourcedOverdue;
      const hasConflictFlag = conflictTaskIds?.has(task.id) ?? false;

      // Outsourced tasks with manual dates look "placed" even without a schedule assignment
      const hasManualDates = task.type === 'Outsourced'
        && (task.manualDeparture || task.manualReturn);
      const effectivelyScheduled = isScheduled || hasManualDates;

      let tileState: 'unplaced' | 'shipped' | 'default' | 'completed' | 'late' | 'conflict';
      if (!effectivelyScheduled) tileState = 'unplaced';
      else if (isJobShipped) tileState = 'shipped';
      else if (isLate) tileState = 'late';
      else if (hasConflictFlag) tileState = 'conflict';
      else if (isCompleted) tileState = 'completed';
      else tileState = 'default';

      return (
        <div key={task.id}>
          {showDryTimeLabel && <DryTimeLabel />}
          <TaskTile
            task={task}
            job={job}
            tileState={tileState}
            assignment={assignment}
            station={station}
            isActivePlacement={activeTaskId === task.id}
            onJumpToTask={onJumpToTask}
            onRecallTask={onRecallTask}
            provider={provider}
            predecessorEndTime={predecessorEndTime}
            isLastTaskOfJob={isLastTask}
            onDepartureChange={onDepartureChange}
            onReturnChange={onReturnChange}
            isCompleted={isCompleted}
            isPinned={assignment?.isPinned ?? false}
            onToggleComplete={onToggleComplete}
            onToggleOutsourcedDone={onToggleOutsourcedDone}
            onTogglePin={onTogglePin}
            onContextMenu={onContextMenu}
            operatorAssignments={assignment?.operators?.map(op => {
              const opObj = snapshotOperators?.find(o => o.id === op.operatorId);
              return {
                operatorId: op.operatorId,
                name: opObj ? `${opObj.firstName} ${opObj.lastName}` : op.operatorId.slice(0, 8),
                attention: op.attention,
                from: op.from,
                to: op.to,
              };
            })}
            onJumpToOperatorSlice={onJumpToOperatorSlice}
          />
        </div>
      );
    });
  };

  // Check if this is a single-element job
  const isSingleElement = !isMultiElementJob(job.elementIds);

  // Get elements for this job, preserving order from job.elementIds (matches JCF order)
  const jobElements = elements
    .filter((e) => job.elementIds.includes(e.id))
    .sort((a, b) => job.elementIds.indexOf(a.id) - job.elementIds.indexOf(b.id));

  return (
    <div className="p-3 overflow-y-auto flex-grow bg-transparent">
      {jobElements.map((element) => {
        const elementTasks = element.taskIds
          .map((id) => taskById.get(id))
          .filter((t): t is Task => t !== undefined);

        return (
          <ElementSection
            key={element.id}
            element={element}
            allElements={jobElements}
            isSingleElement={isSingleElement}
          >
            {renderTaskTiles(elementTasks, element)}
          </ElementSection>
        );
      })}
    </div>
  );
}
