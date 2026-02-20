import type { Task, TaskAssignment, Station, StationCategory, Job, Element, PaperStatus, BatStatus, PlateStatus, FormeStatus, OutsourcedProvider } from '@flux/types';
import { isMultiElementJob, DIE_CUTTING_KEYWORDS } from '@flux/types';
import { TaskTile } from './TaskTile';
import { DryTimeLabel } from './DryTimeLabel';
import { ElementSection } from './ElementSection';
import type { ElementStatusUpdate } from './JobDetailsPanel';

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
  /** Task ID that is currently picked (v0.3.54 Pick & Place) */
  pickedTaskId?: string | null;
  /** Task IDs involved in precedence conflicts (for amber glow highlighting) */
  conflictTaskIds?: Set<string>;
  /** Callback when a scheduled task is clicked (jump to grid) */
  onJumpToTask?: (assignment: TaskAssignment) => void;
  /** Callback when a scheduled task is double-clicked (recall) */
  onRecallTask?: (assignmentId: string) => void;
  /** Callback when an unscheduled task is clicked (pick for placement) - v0.3.54 */
  onPick?: (task: Task, job: Job, clientX: number, clientY: number) => void;
  /** Callback when element prerequisite status changes (v0.4.32a) */
  onElementStatusChange?: (update: ElementStatusUpdate) => void;
  /** v0.5.11: Callback when work days changes for outsourced task */
  onWorkDaysChange?: (taskId: string, workDays: number) => void;
  /** v0.5.11: Callback when manual departure changes for outsourced task */
  onDepartureChange?: (taskId: string, departure: Date | undefined) => void;
  /** v0.5.11: Callback when manual return changes for outsourced task */
  onReturnChange?: (taskId: string, returnDate: Date | undefined) => void;
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
  pickedTaskId,
  conflictTaskIds,
  onJumpToTask,
  onRecallTask,
  onPick,
  onElementStatusChange,
  onWorkDaysChange,
  onDepartureChange,
  onReturnChange,
}: TaskListProps) {
  // Create lookup maps for efficient access
  const assignmentByTaskId = new Map(
    assignments.map((a) => [a.taskId, a])
  );
  const stationById = new Map(
    stations.map((s) => [s.id, s])
  );
  const taskById = new Map(
    tasks.map((t) => [t.id, t])
  );
  // v0.5.11: Provider lookup map
  const providerById = new Map(
    providers.map((p) => [p.id, p])
  );

  if (tasks.length === 0) {
    return (
      <div className="p-3 flex-grow bg-zinc-900/30">
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
   */
  const isPrintingTask = (task: Task): boolean => {
    if (task.type !== 'Internal') return false;
    const station = stationById.get(task.stationId);
    if (!station) return false;
    return getCategoryName(station.categoryId).includes('offset');
  };

  /**
   * Check if an element has any offset printing tasks.
   */
  const elementHasOffset = (element: Element): boolean => {
    return element.taskIds.some((taskId) => {
      const task = taskById.get(taskId);
      return task ? isPrintingTask(task) : false;
    });
  };

  /**
   * Check if a task is a die-cutting task (internal or outsourced).
   */
  const isDieCuttingTask = (task: Task): boolean => {
    if (task.type === 'Internal') {
      const station = stationById.get(task.stationId);
      if (!station) return false;
      return getCategoryName(station.categoryId).includes('découpe') || getCategoryName(station.categoryId).includes('die-cut');
    }
    if (task.type === 'Outsourced') {
      const actionLower = task.actionType?.toLowerCase() || '';
      return DIE_CUTTING_KEYWORDS.some((keyword) => actionLower.includes(keyword));
    }
    return false;
  };

  /**
   * Check if an element has any die-cutting tasks.
   */
  const elementHasDieCutting = (element: Element): boolean => {
    return element.taskIds.some((taskId) => {
      const task = taskById.get(taskId);
      return task ? isDieCuttingTask(task) : false;
    });
  };

  /**
   * Check if an element is an assembly element (no printing or die-cutting tasks).
   * Uses structural task-type check rather than mutable status values so that
   * manually setting all statuses to 'none' doesn't hide the dropdowns.
   */
  const isAssemblyElement = (element: Element): boolean => {
    return !elementHasOffset(element) && !elementHasDieCutting(element);
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
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
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
    const sortedTasks = [...elementTasks].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

    return sortedTasks.map((task, index) => {
      const assignment = assignmentByTaskId.get(task.id);
      const stationId = task.type === 'Internal' ? task.stationId : undefined;
      const station = stationId ? stationById.get(stationId) : undefined;

      // v0.5.11: Get provider for outsourced tasks
      const provider = task.type === 'Outsourced' ? providerById.get(task.providerId) : undefined;

      // v0.5.11: Get predecessor end time for outsourcing calculations
      // First try intra-element predecessor, then fall back to cross-element predecessors
      // v0.5.14: Only pass predecessorEndTime for outsourced tasks that have an assignment
      // (unassigned outsourced tasks should show empty dates, e.g. during grid pick)
      const prevTask = index > 0 ? sortedTasks[index - 1] : null;
      const prevAssignment = prevTask ? assignmentByTaskId.get(prevTask.id) : undefined;
      const predecessorEndTime = (task.type === 'Outsourced' && !assignment)
        ? undefined
        : (prevAssignment?.scheduledEnd
          ?? (index === 0 ? getCrossElementPredecessorEnd(element) : undefined));

      // Check if previous task is a printing task (for dry time label)
      const showDryTimeLabel = prevTask && isPrintingTask(prevTask);

      return (
        <div key={task.id}>
          {showDryTimeLabel && <DryTimeLabel />}
          <TaskTile
            task={task}
            job={job}
            jobColor={job.color}
            assignment={assignment}
            station={station}
            isActivePlacement={activeTaskId === task.id}
            isPicked={pickedTaskId === task.id}
            hasConflict={conflictTaskIds?.has(task.id)}
            onJumpToTask={onJumpToTask}
            onRecallTask={onRecallTask}
            onPick={!assignment ? onPick : undefined}
            provider={provider}
            predecessorEndTime={predecessorEndTime}
            onWorkDaysChange={onWorkDaysChange}
            onDepartureChange={onDepartureChange}
            onReturnChange={onReturnChange}
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
    <div className="p-3 overflow-y-auto flex-grow bg-zinc-900/30">
      {jobElements.map((element) => {
        // Get tasks for this element
        const elementTasks = element.taskIds
          .map((id) => taskById.get(id))
          .filter((t): t is Task => t !== undefined);

        // Create status change handlers for this element
        const handlePaperStatusChange = onElementStatusChange
          ? (value: PaperStatus) => onElementStatusChange({ elementId: element.id, field: 'paperStatus', value })
          : undefined;
        const handleBatStatusChange = onElementStatusChange
          ? (value: BatStatus) => onElementStatusChange({ elementId: element.id, field: 'batStatus', value })
          : undefined;
        const handlePlateStatusChange = onElementStatusChange
          ? (value: PlateStatus) => onElementStatusChange({ elementId: element.id, field: 'plateStatus', value })
          : undefined;
        const handleFormeStatusChange = onElementStatusChange
          ? (value: FormeStatus) => onElementStatusChange({ elementId: element.id, field: 'formeStatus', value })
          : undefined;

        return (
          <ElementSection
            key={element.id}
            element={element}
            allElements={jobElements}
            isSingleElement={isSingleElement}
            hasOffset={elementHasOffset(element)}
            hasDieCutting={elementHasDieCutting(element)}
            isAssembly={isAssemblyElement(element)}
            onPaperStatusChange={handlePaperStatusChange}
            onBatStatusChange={handleBatStatusChange}
            onPlateStatusChange={handlePlateStatusChange}
            onFormeStatusChange={handleFormeStatusChange}
          >
            {renderTaskTiles(elementTasks, element)}
          </ElementSection>
        );
      })}
    </div>
  );
}
