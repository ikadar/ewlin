/**
 * Compute the "remaining" DSL for an Element in modification mode :
 * exclude Completed tasks (they're shown read-only in the Done panel
 * above the textarea), include in-progress + future tasks.
 *
 * In-progress tasks show their *remaining* run (reduced by progress)
 * so the chef sees what's left to do. The backend ignores this value
 * for tasks with wall progress — canonical runMinutes is preserved.
 *
 * @see docs/architecture/preprod-prod-photo-model.md  (Pillar B)
 */

export type TaskStatus = 'defined' | 'ready' | 'assigned' | 'completed' | 'cancelled';

export interface TaskForRemainingDsl {
  id: string;
  sequenceOrder: number;
  taskType: 'internal' | 'outsourced';
  status: TaskStatus;
  /** Stations name (or provider name for ST) — used to regenerate the DSL. */
  stationName?: string | null;
  providerName?: string | null;
  setupMinutes: number | null;
  runMinutes: number | null;
  durationOpenDays: number | null;
  actionType: string | null;
  comment: string | null;
  /** 0-100. Drives the run reduction for in-progress tasks. */
  recordedProgressPct?: number | null;
  /** ISO datetime — non-null means calage was completed. */
  lastSetupAt?: string | null;
}

export interface RemainingDslResult {
  /** Lines joined with '\n', ready to drop into a textarea. */
  dsl: string;
  /** Tasks that are completed — shown read-only in the Done panel. */
  completedTasks: TaskForRemainingDsl[];
  /** Task currently in-progress (≤ 1 per element by domain rule). */
  inProgressTask: TaskForRemainingDsl | null;
}

/**
 * Build the remaining DSL string + the metadata the FE needs to render
 * the Done panel above the textarea.
 */
export function computeRemainingDsl(tasks: TaskForRemainingDsl[]): RemainingDslResult {
  const completedTasks: TaskForRemainingDsl[] = [];
  let inProgressTask: TaskForRemainingDsl | null = null;
  const remainingLines: string[] = [];

  // Order by sequenceOrder for deterministic output.
  const ordered = [...tasks].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  for (const task of ordered) {
    if (task.status === 'cancelled') {
      // Cancelled tasks never appear — they're history.
      continue;
    }
    if (task.status === 'completed') {
      completedTasks.push(task);
      continue;
    }

    // In-progress detection : non-terminal status with progress > 0
    // OR with a calage timestamp recorded.
    const isInProgress =
      (task.recordedProgressPct ?? 0) > 0 || task.lastSetupAt != null;

    if (isInProgress && inProgressTask === null) {
      inProgressTask = task;
      remainingLines.push(taskToDslLineWithRemainingRun(task));
    } else {
      // Future task
      remainingLines.push(taskToDslLine(task));
    }
  }

  return {
    dsl: remainingLines.join('\n'),
    completedTasks,
    inProgressTask,
  };
}

function taskToDslLineWithRemainingRun(task: TaskForRemainingDsl): string {
  if (task.taskType === 'internal') {
    const station = task.stationName ?? '?';
    const setup = task.setupMinutes ?? 0;
    const fullRun = task.runMinutes ?? 0;
    const pct = Math.max(0, Math.min(100, task.recordedProgressPct ?? 0));
    const remainingRun = Math.max(0, Math.round(fullRun * (1 - pct / 100)));
    return `${station}(${setup}+${remainingRun})`;
  }
  return taskToDslLine(task);
}


function taskToDslLine(task: TaskForRemainingDsl): string {
  if (task.taskType === 'internal') {
    const station = task.stationName ?? '?';
    const setup = task.setupMinutes ?? 0;
    const run = task.runMinutes ?? 0;
    return `${station}(${setup}+${run})`;
  }
  // ST:Provider(Nj):description
  const provider = task.providerName ?? '?';
  const days = task.durationOpenDays ?? 0;
  const action = task.actionType ?? '';
  return `ST:${provider}(${days}j):${action}`;
}
