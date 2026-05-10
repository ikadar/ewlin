import type { TaskForRemainingDsl } from './computeRemainingDsl';

export interface JcfDonePanelProps {
  completedTasks: TaskForRemainingDsl[];
  inProgressTask: TaskForRemainingDsl | null;
}

export function JcfDonePanel({
  completedTasks,
  inProgressTask,
}: JcfDonePanelProps) {
  if (completedTasks.length === 0 && inProgressTask === null) {
    return null;
  }

  return (
    <div
      className="bg-zinc-900/60 border border-zinc-800 rounded-[3px] mb-2 px-2 py-1.5"
      data-testid="jcf-done-panel"
    >
      <div className="text-zinc-500 text-[10px] uppercase tracking-wider pb-1 border-b border-dashed border-zinc-700/60 mb-1">
        Déjà fait
      </div>

      {completedTasks.map((t, i) => (
        <div
          key={t.id}
          className={`flex items-baseline justify-between gap-3 py-0.5 text-[12px] leading-snug ${
            i > 0 ? 'border-t border-dotted border-zinc-700/40' : ''
          }`}
        >
          <span className="font-mono text-zinc-400">
            {renderDslLabel(t)}
          </span>
          <span className="text-zinc-500 text-[11px] whitespace-nowrap">
            terminée
          </span>
        </div>
      ))}

      {inProgressTask && (
        <div
          className={`flex items-baseline justify-between gap-3 py-0.5 text-[12px] leading-snug ${
            completedTasks.length > 0
              ? 'border-t border-dotted border-zinc-700/40'
              : ''
          }`}
        >
          <span className="font-mono text-zinc-100 font-medium">
            {renderDslLabel(inProgressTask)}
          </span>
          <span className="text-zinc-400 text-[11px] whitespace-nowrap">
            <span className="text-amber-500 font-semibold">
              {Math.round(inProgressTask.recordedProgressPct ?? 0)}%
            </span>
            {' · '}
            <span className="text-zinc-200">
              {computeRemainingMin(inProgressTask)} / {inProgressTask.runMinutes ?? 0} min
            </span>
            {inProgressTask.lastSetupAt && (
              <span className="text-zinc-500"> · calage fait</span>
            )}
          </span>
        </div>
      )}

      {inProgressTask && (
        <div className="text-zinc-600 text-[10px] italic pt-1 leading-snug">
          Run réduit ci-dessous. Le calage est conservé si le placement le permet.
        </div>
      )}
    </div>
  );
}

function renderDslLabel(task: TaskForRemainingDsl): string {
  if (task.taskType === 'internal') {
    const setup = task.setupMinutes ?? 0;
    const run = task.runMinutes ?? 0;
    return `${task.stationName ?? '?'}(${setup}+${run})`;
  }
  return `ST:${task.providerName ?? '?'}(${task.durationOpenDays ?? 0}j):${task.actionType ?? ''}`;
}

function computeRemainingMin(task: TaskForRemainingDsl): number {
  const fullRun = task.runMinutes ?? 0;
  const pct = Math.max(0, Math.min(100, task.recordedProgressPct ?? 0));
  return Math.max(0, Math.round(fullRun * (1 - pct / 100)));
}
