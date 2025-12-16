import type { Task, TaskAssignment, Station, Job } from '@flux/types';
import { TaskTile } from './TaskTile';

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
}

/**
 * Scrollable list of task tiles for the selected job.
 */
export function TaskList({ tasks, job, assignments, stations, activeTaskId }: TaskListProps) {
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

  return (
    <div className="p-3 space-y-2 overflow-y-auto flex-grow bg-zinc-900/30">
      {sortedTasks.map((task) => {
        const assignment = assignmentByTaskId.get(task.id);
        // Get station based on task type
        const stationId = task.type === 'Internal' ? task.stationId : undefined;
        const station = stationId ? stationById.get(stationId) : undefined;

        return (
          <TaskTile
            key={task.id}
            task={task}
            job={job}
            jobColor={job.color}
            assignment={assignment}
            station={station}
            isActivePlacement={activeTaskId === task.id}
          />
        );
      })}
    </div>
  );
}
