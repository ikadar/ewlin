import type { Task, TaskAssignment, Station, Job, Element, PaperStatus, BatStatus, PlateStatus, FormeStatus } from '@flux/types';
import { isMultiElementJob } from '@flux/types';
import { TaskTile } from './TaskTile';
import { DryTimeLabel } from './DryTimeLabel';
import { ElementSection } from './ElementSection';
import type { ElementStatusUpdate } from './JobDetailsPanel';
import { DIE_CUTTING_CATEGORY_ID } from '../../utils';

/** Category ID for printing stations (offset press) */
const PRINTING_CATEGORY_ID = 'cat-offset';

/** Keywords for detecting die-cutting in outsourced action types */
const DIE_CUTTING_KEYWORDS = ['découpe', 'die-cut', 'die cut', 'stancolás'];

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
  /** Task ID that is the active placement target in Quick Placement Mode */
  activeTaskId?: string | null;
  /** Task ID that is currently picked (v0.3.54 Pick & Place) */
  pickedTaskId?: string | null;
  /** Callback when a scheduled task is clicked (jump to grid) */
  onJumpToTask?: (assignment: TaskAssignment) => void;
  /** Callback when a scheduled task is double-clicked (recall) */
  onRecallTask?: (assignmentId: string) => void;
  /** Callback when an unscheduled task is clicked (pick for placement) - v0.3.54 */
  onPick?: (task: Task, job: Job, clientX: number, clientY: number) => void;
  /** Callback when element prerequisite status changes (v0.4.32a) */
  onElementStatusChange?: (update: ElementStatusUpdate) => void;
}

/**
 * Scrollable list of task tiles for the selected job, grouped by element.
 */
export function TaskList({ tasks, elements, job, assignments, stations, activeTaskId, pickedTaskId, onJumpToTask, onRecallTask, onPick, onElementStatusChange }: TaskListProps) {
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
   * Check if a task is assigned to a printing station (offset press).
   */
  const isPrintingTask = (task: Task): boolean => {
    if (task.type !== 'Internal') return false;
    const station = stationById.get(task.stationId);
    return station?.categoryId === PRINTING_CATEGORY_ID;
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
      return station?.categoryId === DIE_CUTTING_CATEGORY_ID;
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
   * Check if an element is an assembly element (has prerequisite elements but no printing).
   * Assembly elements typically only combine other elements without their own printing.
   */
  const isAssemblyElement = (element: Element): boolean => {
    // An element is considered "assembly" if it has prerequisites but no tasks
    // or if all its statuses are 'none' (explicitly marked as assembly)
    return element.paperStatus === 'none' && element.batStatus === 'none' && element.plateStatus === 'none';
  };

  /**
   * Render task tiles for an element
   */
  const renderTaskTiles = (elementTasks: Task[]) => {
    const sortedTasks = [...elementTasks].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

    return sortedTasks.map((task, index) => {
      const assignment = assignmentByTaskId.get(task.id);
      const stationId = task.type === 'Internal' ? task.stationId : undefined;
      const station = stationId ? stationById.get(stationId) : undefined;

      // Check if previous task is a printing task (for dry time label)
      const prevTask = index > 0 ? sortedTasks[index - 1] : null;
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
            onJumpToTask={onJumpToTask}
            onRecallTask={onRecallTask}
            onPick={!assignment ? onPick : undefined}
          />
        </div>
      );
    });
  };

  // Check if this is a single-element job
  const isSingleElement = !isMultiElementJob(job.elementIds);

  // Get elements for this job, preserving order
  const jobElements = elements.filter((e) => job.elementIds.includes(e.id));

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
            {renderTaskTiles(elementTasks)}
          </ElementSection>
        );
      })}
    </div>
  );
}
