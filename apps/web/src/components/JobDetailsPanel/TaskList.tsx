import type { Task, TaskAssignment, Station, Job, Element } from '@flux/types';
import { isMultiElementJob } from '@flux/types';
import { TaskTile } from './TaskTile';
import { DryTimeLabel } from './DryTimeLabel';
import { ElementSection } from './ElementSection';

/** Category ID for printing stations (offset press) */
const PRINTING_CATEGORY_ID = 'cat-offset';

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
  /** Task ID that is currently picked (Pick & Place mode) */
  pickedTaskId?: string | null;
  /** Callback when a scheduled task is clicked (jump to grid) */
  onJumpToTask?: (assignment: TaskAssignment) => void;
  /** Callback when a scheduled task is double-clicked (recall) */
  onRecallTask?: (assignmentId: string) => void;
  /** Callback when an unscheduled task is clicked (Pick & Place mode) */
  onPickTask?: (task: Task, job: Job) => void;
}

/**
 * Scrollable list of task tiles for the selected job, grouped by element.
 */
export function TaskList({ tasks, elements, job, assignments, stations, activeTaskId, pickedTaskId, onJumpToTask, onRecallTask, onPickTask }: TaskListProps) {
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
            onPickTask={onPickTask}
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

        return (
          <ElementSection
            key={element.id}
            element={element}
            allElements={jobElements}
            isSingleElement={isSingleElement}
          >
            {renderTaskTiles(elementTasks)}
          </ElementSection>
        );
      })}
    </div>
  );
}
