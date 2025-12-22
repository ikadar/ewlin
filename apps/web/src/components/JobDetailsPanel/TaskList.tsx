import type { Task, TaskAssignment, Station, Job } from '@flux/types';
import { TaskTile } from './TaskTile';
import { DryTimeLabel } from './DryTimeLabel';

/** Category ID for printing stations (offset press) */
const PRINTING_CATEGORY_ID = 'cat-offset';

export interface TaskListProps {
  /** Tasks to display */
  tasks: Task[];
  /** Job for color */
  job: Job;
  /** All assignments to check if tasks are scheduled */
  assignments: TaskAssignment[];
  /** All stations to get station names */
  stations: Station[];
  /** Task ID that is the active placement target in Quick Placement Mode */
  activeTaskId?: string | null;
  /** Callback when a scheduled task is clicked (jump to grid) */
  onJumpToTask?: (assignment: TaskAssignment) => void;
  /** Callback when a scheduled task is double-clicked (recall) */
  onRecallTask?: (assignmentId: string) => void;
}

/**
 * Scrollable list of task tiles for the selected job.
 */
export function TaskList({ tasks, job, assignments, stations, activeTaskId, onJumpToTask, onRecallTask }: TaskListProps) {
  // Create lookup maps for efficient access
  const assignmentByTaskId = new Map(
    assignments.map((a) => [a.taskId, a])
  );
  const stationById = new Map(
    stations.map((s) => [s.id, s])
  );

  // Sort tasks by sequence order
  const sortedTasks = [...tasks].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  if (sortedTasks.length === 0) {
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

  return (
    <div className="p-3 space-y-2 overflow-y-auto flex-grow bg-zinc-900/30">
      {sortedTasks.map((task, index) => {
        const assignment = assignmentByTaskId.get(task.id);
        // Get station based on task type
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
              onJumpToTask={onJumpToTask}
              onRecallTask={onRecallTask}
            />
          </div>
        );
      })}
    </div>
  );
}
