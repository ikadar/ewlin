import type { TaskForRemainingDsl } from './computeRemainingDsl';

/**
 * "Déjà fait" panel above the Sequence textarea in JCF modification
 * mode. Shows Completed tasks (greyed out) + the in-progress task
 * (amber, with progress %, calage info). Future tasks are NOT in this
 * panel — they live in the textarea below.
 *
 * Stylistically aligned with the playground we validated together
 * (palette zinc, font-mono, dotted separators between lines).
 *
 * @see playground-jcf-sequence-cell.html
 * @see docs/architecture/preprod-prod-photo-model.md  (Pillar B)
 */
export interface JcfDonePanelProps {
  completedTasks: TaskForRemainingDsl[];
  inProgressTask: TaskForRemainingDsl | null;
}

export function JcfDonePanel({
  completedTasks,
  inProgressTask,
}: JcfDonePanelProps) {
  // Nothing to show if the element hasn't been touched yet.
  if (completedTasks.length === 0 && inProgressTask === null) {
    return null;
  }

  return (
    <div
      className="bg-zinc-900/60 border border-zinc-800 rounded-[3px] mb-2 px-2 py-1.5"
      data-testid="jcf-done-panel"
    >
      <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] uppercase tracking-wider pb-1 border-b border-dashed border-zinc-700/60 mb-1">
        Déjà fait
      </div>

      {completedTasks.map((t, i) => (
        <div
          key={t.id}
          className={`grid grid-cols-[18px_1fr_auto] items-center gap-2 py-0.5 text-[12px] leading-snug ${
            i > 0 ? 'border-t border-dotted border-zinc-700/40' : ''
          }`}
        >
          <span
            className="w-3.5 h-3.5 rounded-full bg-zinc-700/40 text-zinc-400 inline-flex items-center justify-center text-[9px] font-bold"
            aria-label="terminée"
          >
            ✓
          </span>
          <span className="font-mono text-zinc-400">
            {renderDslLabel(t)}
          </span>
          <span className="text-zinc-500 text-[11px] text-right whitespace-nowrap">
            terminée
          </span>
        </div>
      ))}

      {inProgressTask && (
        <div
          className={`grid grid-cols-[18px_1fr_auto] items-center gap-2 py-0.5 text-[12px] leading-snug ${
            completedTasks.length > 0
              ? 'border-t border-dotted border-zinc-700/40'
              : ''
          }`}
        >
          <span
            className="w-3.5 h-3.5 rounded-full bg-amber-500 text-zinc-900 inline-flex items-center justify-center text-[9px] font-bold"
            aria-label="en cours"
          >
            ⏳
          </span>
          <span className="font-mono text-zinc-100 font-medium">
            {renderDslLabel(inProgressTask)}
          </span>
          <span className="text-zinc-400 text-[11px] text-right whitespace-nowrap">
            <span className="text-amber-500 font-semibold">
              {Math.round(inProgressTask.recordedProgressPct ?? 0)}%
            </span>{' '}
            ·{' '}
            <span className="text-zinc-200">
              {computeRemainingMin(inProgressTask)} / {inProgressTask.runMinutes ?? 0} min
            </span>
            {inProgressTask.lastSetupAt && (
              <span className="text-zinc-500"> · calage {formatTime(inProgressTask.lastSetupAt)}</span>
            )}
          </span>
        </div>
      )}

      {inProgressTask && (
        <div className="text-zinc-600 text-[10px] italic pt-1 pl-[26px] leading-snug">
          ↳ Run réduit ci-dessous ; setup conservé (l'engine décide s'il honore le calage selon le placement).
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

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}
