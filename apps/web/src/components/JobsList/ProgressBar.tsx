import type { Task, TaskAssignment } from '@flux/types';
import { compareTaskOrder } from '../../utils/taskHelpers';
import { computeTileState, type TileState } from '../Tile/colorUtils';

export interface ProgressBarProps {
  tasks: Task[];
  assignments: TaskAssignment[];
  /** Whole-job: job.shipped */
  isJobShipped?: boolean;
  /** Whole-job: job is in the lateJobs set */
  isJobLate?: boolean;
  /** Task-level conflict set (precedence violations). */
  conflictTaskIds?: Set<string>;
}

// Extended: TileState + 'unscheduled' (when a task has no assignment — not a TileState).
type SegmentState = TileState | 'unscheduled';

const SEGMENT_BG: Record<SegmentState, string> = {
  unscheduled: 'bg-zinc-600',
  default: 'bg-blue-500',
  shipped: 'bg-emerald-500',
  completed: 'bg-green-500',
  conflict: 'bg-amber-500',
  late: 'bg-red-500',
  blocked: 'bg-zinc-500',
};

interface SegmentCtx {
  isJobShipped: boolean;
  isJobLate: boolean;
  conflictTaskIds: Set<string>;
  now: Date;
}

function computeSegmentState(
  task: Task,
  assignment: TaskAssignment | undefined,
  ctx: SegmentCtx,
): SegmentState {
  if (!assignment) return 'unscheduled';
  const isLate = ctx.isJobLate || new Date(assignment.scheduledEnd) < ctx.now;
  const hasConflict = ctx.conflictTaskIds.has(task.id);
  const isCompleted = assignment.isCompleted === true;
  // TODO: blocked state requires prerequisite cache from stationTileData; not
  // threaded into JobsList context yet. Blocked tasks render as their
  // underlying state until that data pipeline is wired up.
  const isBlocked = false;
  return computeTileState(ctx.isJobShipped, isLate, hasConflict, isBlocked, isCompleted);
}

export function ProgressBar({
  tasks,
  assignments,
  isJobShipped = false,
  isJobLate = false,
  conflictTaskIds,
}: ProgressBarProps) {
  if (tasks.length === 0) return null;

  const assignmentMap = new Map<string, TaskAssignment>();
  assignments.forEach((a) => assignmentMap.set(a.taskId, a));
  const sortedTasks = [...tasks].sort(compareTaskOrder);

  const ctx: SegmentCtx = {
    isJobShipped,
    isJobLate,
    conflictTaskIds: conflictTaskIds ?? new Set<string>(),
    now: new Date(),
  };

  return (
    <div
      className="flex gap-0.5 h-[3px] w-[140px] overflow-hidden shrink-0"
      data-testid="progress-bar"
    >
      {sortedTasks.map((task) => {
        const assignment = assignmentMap.get(task.id);
        const state = computeSegmentState(task, assignment, ctx);
        return (
          <div
            key={task.id}
            className={`flex-1 min-w-[4px] ${SEGMENT_BG[state]}`}
            data-testid={`bar-seg-${task.id}`}
            data-state={state}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}
