/* eslint-disable react-refresh/only-export-components */
import type { Task, TaskAssignment } from '@flux/types';
import { isInternalTask, isOutsourcedTask } from '@flux/types';

export interface ProgressSegmentsProps {
  /** Tasks for this job */
  tasks: Task[];
  /** Assignments for this job's tasks */
  assignments: TaskAssignment[];
}

/** Task state for visualization */
export type SegmentState = 'unscheduled' | 'scheduled' | 'completed' | 'late';

/** Calculate segment state based on task and assignment */
export function getSegmentState(
  task: Task,
  assignment: TaskAssignment | undefined
): SegmentState {
  if (!assignment) {
    return 'unscheduled';
  }

  if (assignment.isCompleted) {
    return 'completed';
  }

  const now = new Date();
  const scheduledEnd = new Date(assignment.scheduledEnd);

  if (scheduledEnd < now) {
    return 'late';
  }

  return 'scheduled';
}

/** Calculate segment width in pixels based on task duration */
export function getSegmentWidth(task: Task): number {
  if (isOutsourcedTask(task)) {
    // Outsourced tasks: 5× standard width (40px)
    return 40;
  }

  if (isInternalTask(task)) {
    const totalMinutes = task.duration.setupMinutes + task.duration.runMinutes;
    // Width formula: duration / 30 * 8, minimum 8px
    return Math.max(8, Math.round((totalMinutes / 30) * 8));
  }

  // Fallback
  return 8;
}

/** Get outsourced task label (e.g., "2JO") */
export function getOutsourcedLabel(task: Task): string | null {
  if (!isOutsourcedTask(task)) {
    return null;
  }
  return `${task.duration.openDays}JO`;
}

/** Get CSS classes for segment state */
function getStateClasses(state: SegmentState): string {
  switch (state) {
    case 'unscheduled':
      return 'border border-zinc-700 bg-transparent';
    case 'scheduled':
      return 'bg-zinc-500';
    case 'completed':
      return 'bg-emerald-500';
    case 'late':
      return 'bg-red-500';
  }
}

/**
 * Progress segments showing task status and relative size.
 * Replaces ProgressDots with richer visualization (REQ-07).
 */
export function ProgressSegments({ tasks, assignments }: ProgressSegmentsProps) {
  if (tasks.length === 0) return null;

  // Create a map of taskId -> assignment for quick lookup
  const assignmentMap = new Map<string, TaskAssignment>();
  assignments.forEach((a) => assignmentMap.set(a.taskId, a));

  // Sort tasks by sequence order
  const sortedTasks = [...tasks].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  return (
    <div className="flex flex-wrap gap-0.5" data-testid="progress-segments">
      {sortedTasks.map((task) => {
        const assignment = assignmentMap.get(task.id);
        const state = getSegmentState(task, assignment);
        const width = getSegmentWidth(task);
        const label = getOutsourcedLabel(task);
        const stateClasses = getStateClasses(state);

        return (
          <div
            key={task.id}
            className={`h-1.5 rounded-sm ${stateClasses} ${label ? 'flex items-center justify-center' : ''}`}
            style={{ width: `${width}px`, minWidth: `${width}px` }}
            data-testid={`segment-${task.id}`}
            data-state={state}
            aria-hidden="true"
          >
            {label && (
              <span className="text-[6px] font-medium text-white leading-none">
                {label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
