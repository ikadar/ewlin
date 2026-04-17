import type { Task, TaskAssignment } from '@flux/types';
import { compareTaskOrder } from '../../utils/taskHelpers';
import { getDotState, type DotState } from './ProgressDots';

export interface ProgressBarProps {
  tasks: Task[];
  assignments: TaskAssignment[];
}

const STATE_CLASSES: Record<DotState, string> = {
  unscheduled: 'bg-zinc-600',
  scheduled: 'bg-blue-500',
  completed: 'bg-emerald-500',
  late: 'bg-red-500',
};

export function ProgressBar({ tasks, assignments }: ProgressBarProps) {
  if (tasks.length === 0) return null;

  const assignmentMap = new Map<string, TaskAssignment>();
  assignments.forEach((a) => assignmentMap.set(a.taskId, a));
  const sortedTasks = [...tasks].sort(compareTaskOrder);

  return (
    <div
      className="flex gap-0.5 h-[3px] w-[72px] rounded-sm overflow-hidden shrink-0"
      data-testid="progress-bar"
    >
      {sortedTasks.map((task) => {
        const assignment = assignmentMap.get(task.id);
        const state = getDotState(task, assignment);
        return (
          <div
            key={task.id}
            className={`flex-1 min-w-[4px] rounded-[1px] ${STATE_CLASSES[state]}`}
            data-testid={`bar-seg-${task.id}`}
            data-state={state}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}
