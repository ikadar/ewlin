/**
 * ComputeReportToast — rich compute-feedback toast.
 *
 * Renders the "pendant" (steps list) and "après" (ratio + priority
 * breakdown + late jobs) content of ComputeModal inside a toast-style
 * card positioned top-right, 380px wide. Validated in
 * playground-compute-info-toast.html.
 *
 * Unlike ComputeToastStack, this is a single-slot renderer: only one
 * report toast is visible at a time. Re-triggering replaces it.
 */

import { memo, useEffect } from 'react';
import { CheckCircle2, Loader2, X, AlertCircle } from 'lucide-react';
import type { ComputeReportState, ComputeReportLateJob } from '../../hooks/useComputeReportStream';
import { getDeadlineDate } from '@flux/types';
import type { ScheduleSnapshot } from '@flux/types';
import type { ComputeScheduleResult } from '../../store';
import { useGetSnapshotQuery } from '../../store';
import { getJobIdForTask } from '../../utils/taskHelpers';

// Conflict types that the FluxTable's "Conflits" chip surfaces — must
// stay aligned with `apps/web/src/pages/FluxPage.tsx` (lines 70–83).
// DeadlineConflict is excluded because it overlaps with "En retard";
// ApprovalGateConflict is excluded because it surfaces via the BAT lane.
const NON_LATE_CONFLICT_EXCLUSIONS = new Set(['DeadlineConflict', 'ApprovalGateConflict']);

interface Props {
  state: ComputeReportState;
  onDismiss: () => void;
}

const PRIORITY_LABELS = ['Vital', 'Impératif', 'Important', 'Standard', 'Flexible'];
const PRIORITY_COLORS = ['#dc2626', '#ef4444', '#f97316', '#fbbf24', '#22c55e'];

const AUTO_DISMISS_NO_LATE_MS = 8000;

function formatLateness(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}j ${remHours}h` : `${days}j`;
}

function formatDelta(minutes: number): string {
  if (minutes === 0) return '±0';
  const abs = Math.abs(minutes);
  const sign = minutes > 0 ? '+' : '-';
  if (abs < 60) return `${sign}${abs}min`;
  const hours = Math.floor(abs / 60);
  if (hours < 24) return `${sign}${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${sign}${days}j ${remHours}h` : `${sign}${days}j`;
}

/**
 * Build the set of job IDs that have at least one assignment in the
 * engine RESULT (post-compute). A job with zero result assignments
 * is "unplaced" — it should not be counted as on-time (that would
 * silently inflate the ratio) nor as late (the engine hasn't even
 * scheduled it). Uses `result.assignments`, not `snapshot.assignments`,
 * because the snapshot is captured at compute START and can be empty
 * (e.g. right after a clearAllAssignments), which would make totalJobs
 * collapse to 0 and the pct math degenerate.
 */
function buildPlacedJobIds(
  snapshot: ScheduleSnapshot,
  resultAssignments: ComputeScheduleResult['assignments'],
): Set<string> {
  const taskToJob = new Map<string, string>();
  for (const task of snapshot.tasks) {
    const jid = getJobIdForTask(task, snapshot.elements);
    if (jid) taskToJob.set(task.id, jid);
  }
  const placed = new Set<string>();
  for (const a of resultAssignments) {
    const jid = taskToJob.get(a.taskId);
    if (jid) placed.add(jid);
  }
  return placed;
}

function buildPriorityBreakdown(
  snapshot: ScheduleSnapshot,
  lateJobs: ComputeReportLateJob[],
  placedJobIds: Set<string>,
  result: ComputeScheduleResult,
) {
  const lateByRef = new Map(lateJobs.map((l) => [l.ref, l]));

  const taskToJob = new Map<string, string>();
  for (const task of snapshot.tasks) {
    const jid = getJobIdForTask(task, snapshot.elements);
    if (jid) taskToJob.set(task.id, jid);
  }

  const endByTask = new Map<string, string>();
  for (const a of result.assignments) {
    if (a.scheduledEnd) endByTask.set(a.taskId, a.scheduledEnd);
  }
  for (const o of result.outsourcedAssignments ?? []) {
    if (o.scheduledEnd) endByTask.set(o.taskId, o.scheduledEnd);
  }

  const latestEndByJob = new Map<string, Date>();
  for (const [taskId, endStr] of endByTask) {
    const jobId = taskToJob.get(taskId);
    if (!jobId) continue;
    const end = new Date(endStr);
    const current = latestEndByJob.get(jobId);
    if (!current || end > current) latestEndByJob.set(jobId, end);
  }

  return [0, 1, 2, 3]
    .map((tier) => {
      const jobs = snapshot.jobs
        .filter((j) => (j.deadlinePriority ?? 2) === tier)
        .filter((j) => placedJobIds.has(j.id));
      const total = jobs.length;
      const late = jobs.filter((j) => lateByRef.has(j.reference)).length;

      const deltas: number[] = [];
      for (const job of jobs) {
        if (!job.workshopExitDate) continue;
        const deadline = getDeadlineDate(job.workshopExitDate);
        const latestEnd = latestEndByJob.get(job.id);
        if (!latestEnd) continue;
        deltas.push(Math.round((latestEnd.getTime() - deadline.getTime()) / 60000));
      }
      const avgDeltaMinutes = deltas.length > 0
        ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length)
        : null;

      return { tier, total, onTime: total - late, late, avgDeltaMinutes };
    })
    .filter((t) => t.total > 0);
}

export const ComputeReportToast = memo(function ComputeReportToast({ state, onDismiss }: Props) {
  const { phase, mode, jobId, snapshot, steps, elapsedMs, result, error, lateJobs } = state;

  // Subscribe to the live snapshot so the conflict count reflects the
  // post-compute validation (engine result doesn't carry conflicts —
  // they're enriched server-side by the validation-service after the
  // mutation invalidates the Snapshot tag).
  const { data: liveSnapshot } = useGetSnapshotQuery();
  const nonLateConflictCount = liveSnapshot
    ? liveSnapshot.conflicts.filter((c) => !NON_LATE_CONFLICT_EXCLUSIONS.has(c.type)).length
    : 0;

  const hasLate = lateJobs.length > 0;
  const hasWarnings = !!result?.warnings?.length;
  const hasConflicts = nonLateConflictCount > 0;

  // Auto-dismiss when done with NO late jobs, NO warnings, AND NO conflicts —
  // any of these signals is something the user must see, so we keep the
  // toast pinned until they dismiss it manually.
  useEffect(() => {
    if (phase !== 'done' || hasLate || hasWarnings || hasConflicts) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_NO_LATE_MS);
    return () => clearTimeout(timer);
  }, [phase, hasLate, hasWarnings, hasConflicts, onDismiss]);

  if (phase === 'idle') return null;

  const targetJob = jobId && snapshot ? snapshot.jobs.find((j) => j.id === jobId) ?? null : null;
  const isSelective = mode === 'selective' && targetJob != null;

  const title = (() => {
    if (phase === 'error') return 'Erreur de calcul';
    if (phase === 'computing') {
      if (mode === 'selective' && targetJob) return `Placement — Job ${targetJob.reference}`;
      if (mode === 'incremental') return 'Placement incrémental';
      return 'Calcul du planning';
    }
    // done
    if (mode === 'selective' && targetJob) return `Placement — Job ${targetJob.reference}`;
    return 'Calcul terminé';
  })();

  const headerMeta = (() => {
    if (phase !== 'done' || !result) return null;
    const timeLabel = result.computeTimeMs >= 1000
      ? `${(result.computeTimeMs / 1000).toFixed(1)}s`
      : `${result.computeTimeMs}ms`;
    const bits = [timeLabel];
    if (!isSelective && result.fbiIterations > 0) bits.push(`${result.fbiIterations} passes`);
    return `· ${bits.join(' · ')}`;
  })();

  return (
    <div
      className="fixed top-20 right-6 z-[510] w-[380px] pointer-events-none"
      aria-live="polite"
      data-testid="compute-report-toast"
      data-phase={phase}
    >
      <div
        role={phase === 'error' ? 'alert' : 'status'}
        className="pointer-events-auto bg-flux-elevated border border-flux-border-light border-l-[3px] border-l-violet-500 rounded-lg px-3.5 py-3 shadow-xl shadow-black/40 animate-in slide-in-from-top-2 fade-in duration-200"
      >
        {/* Header */}
        <div className="flex items-start gap-2.5">
          {phase === 'computing' && (
            <Loader2 className="w-[15px] h-[15px] shrink-0 mt-0.5 text-violet-400 animate-spin" />
          )}
          {phase === 'done' && (
            <CheckCircle2 className="w-[15px] h-[15px] shrink-0 mt-0.5 text-violet-400" />
          )}
          {phase === 'error' && (
            <AlertCircle className="w-[15px] h-[15px] shrink-0 mt-0.5 text-red-400" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-flux-text-primary leading-tight">
              {title}
              {headerMeta && (
                <span className="text-[11px] font-normal text-flux-text-muted ml-1.5">
                  {headerMeta}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Fermer"
            className="text-flux-text-muted hover:text-flux-text-primary transition-colors -m-0.5 p-0.5 leading-none"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body — branch by phase */}
        {phase === 'error' && error && (
          <div className="mt-2 text-[11.5px] text-red-300 leading-snug">{error}</div>
        )}

        {phase === 'computing' && <StepsList steps={steps} elapsedMs={elapsedMs} />}

        {phase === 'done' && result && snapshot && (
          isSelective && targetJob
            ? <SelectiveSection hasLate={hasLate} lateJob={lateJobs[0] ?? null} result={result} targetRef={targetJob.reference} />
            : <FullSection snapshot={snapshot} result={result} lateJobs={lateJobs} conflictCount={nonLateConflictCount} />
        )}
      </div>
    </div>
  );
});

function StepsList({ steps, elapsedMs }: { steps: { label: string; detail?: string; state: 'pending' | 'active' | 'done' }[]; elapsedMs: number }) {
  return (
    <div className="mt-2 flex flex-col gap-0.5">
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-2 py-0.5 min-h-[22px]">
          <div className="w-3.5 h-3.5 mt-0.5 flex items-center justify-center shrink-0">
            {step.state === 'done' && <span className="text-emerald-400 text-[11px]">✓</span>}
            {step.state === 'active' && (
              <div className="w-3 h-3 border-[1.5px] border-zinc-700 border-t-violet-400 rounded-full animate-spin" />
            )}
            {step.state === 'pending' && <span className="text-zinc-700 text-[10px]">○</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div
              className={`text-[11.5px] leading-snug ${
                step.state === 'active'
                  ? 'text-flux-text-primary font-medium'
                  : step.state === 'done'
                  ? 'text-flux-text-tertiary'
                  : 'text-zinc-600'
              }`}
            >
              {step.label}
            </div>
            {step.detail && step.state !== 'pending' && (
              <div className="text-[10.5px] text-flux-text-muted leading-snug">{step.detail}</div>
            )}
          </div>
          {step.state === 'active' && (
            <span className="text-[10.5px] text-flux-text-muted tabular-nums shrink-0">
              {(elapsedMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function SelectiveSection({
  hasLate,
  lateJob,
  result,
  targetRef,
}: {
  hasLate: boolean;
  lateJob: ComputeReportLateJob | null;
  result: { stats: { scheduledTasks: number; totalTasks: number }; computeTimeMs: number };
  targetRef: string;
}) {
  const accent = hasLate ? '#f59e0b' : '#22c55e';
  const accentText = hasLate ? 'text-amber-400' : 'text-emerald-400';
  return (
    <>
      <div className="flex items-center gap-2 mt-2.5">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: accent }} />
        <span className="text-xs font-semibold text-flux-text-primary">Job {targetRef}</span>
        <span className={`text-xs font-medium ${accentText}`}>
          {hasLate && lateJob ? `en retard de ${formatLateness(lateJob.lateByMinutes)}` : "à l'heure"}
        </span>
      </div>
      <div className="flex gap-3.5 mt-1.5 text-[10.5px] text-flux-text-muted">
        <span>{result.stats.scheduledTasks}/{result.stats.totalTasks} tâches placées</span>
      </div>
    </>
  );
}

function FullSection({
  snapshot,
  result,
  lateJobs,
  conflictCount,
}: {
  snapshot: ScheduleSnapshot;
  result: ComputeScheduleResult;
  lateJobs: ComputeReportLateJob[];
  conflictCount: number;
}) {
  // Denominator must be placed jobs only — counting unplaced jobs as
  // "on time" silently inflates the ratio. Uses the engine's fresh
  // result, not the compute-start snapshot (which can be empty right
  // after a clearAllAssignments), so the number reflects the schedule
  // that was just produced.
  const placedJobIds = buildPlacedJobIds(snapshot, result.assignments);
  const totalJobs = placedJobIds.size;
  const onTime = Math.max(0, totalJobs - lateJobs.length);
  const pct = totalJobs > 0 ? Math.round((onTime / totalJobs) * 100) : 100;
  const tiers = buildPriorityBreakdown(snapshot, lateJobs, placedJobIds, result);

  return (
    <>
      {/* On-time ratio */}
      <div className="mt-2.5 mb-1.5 flex items-baseline justify-between">
        <span className="text-[22px] font-bold tabular-nums text-flux-text-primary leading-none tracking-tight">
          {pct}%
        </span>
        <span className="text-[10.5px] text-flux-text-muted">
          {onTime} à l'heure sur {totalJobs} jobs
        </span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden flex">
        {pct > 0 && <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />}
        {pct < 100 && <div className="h-full bg-red-500" style={{ width: `${100 - pct}%` }} />}
      </div>

      <div className="flex gap-3.5 mt-2 text-[10.5px] text-flux-text-muted">
        <span>{result.stats.scheduledTasks}/{result.stats.totalTasks} tâches placées</span>
        {conflictCount > 0 && (
          <span className="text-amber-400 font-medium">
            {conflictCount} conflit{conflictCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Priority breakdown */}
      {tiers.length > 1 && (
        <>
          <div className="my-2.5 h-px bg-flux-border" />
          <div className="text-[9.5px] uppercase tracking-wider text-flux-text-muted font-semibold mb-1.5">
            Par priorité
          </div>
          {tiers.map((t) => {
            const p = Math.round((t.onTime / t.total) * 100);
            return (
              <div key={t.tier} className="flex items-center gap-1.5 mb-1">
                <div
                  className="w-[7px] h-[7px] rounded-full shrink-0"
                  style={{ background: PRIORITY_COLORS[t.tier] }}
                />
                <span className="text-[10.5px] text-flux-text-tertiary w-[54px] shrink-0">
                  {PRIORITY_LABELS[t.tier]}
                </span>
                <div className="flex-1 h-[7px] bg-zinc-800 rounded-full overflow-hidden flex">
                  {p > 0 && <div className="h-full bg-emerald-500" style={{ width: `${p}%` }} />}
                  {p < 100 && <div className="h-full bg-red-500" style={{ width: `${100 - p}%` }} />}
                </div>
                <span className="text-[10.5px] text-flux-text-tertiary tabular-nums shrink-0">
                  {t.onTime}/{t.total}
                </span>
                {t.avgDeltaMinutes != null && (
                  <span className={`text-[10px] tabular-nums shrink-0 ${
                    t.avgDeltaMinutes > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {formatDelta(t.avgDeltaMinutes)}
                  </span>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Engine warnings (pin displacements, unplaced tasks, …) */}
      {result.warnings && result.warnings.length > 0 && (
        <>
          <div className="my-2.5 h-px bg-flux-border" />
          <div className="text-[9.5px] uppercase tracking-wider text-amber-500 font-semibold mb-1.5">
            Avertissements ({result.warnings.length})
          </div>
          {result.warnings.map((w, i) => {
            let jobRef: string | null = null;
            if (w.taskId) {
              const task = snapshot.tasks.find((t) => t.id === w.taskId);
              if (task) {
                const jobId = getJobIdForTask(task, snapshot.elements);
                if (jobId) {
                  const job = snapshot.jobs.find((j) => j.id === jobId);
                  if (job) jobRef = job.reference;
                }
              }
            }
            return (
              <div key={i} className="flex items-start gap-2 py-0.5 text-[11px]">
                <span className="text-amber-500 shrink-0 mt-px">⚠</span>
                <div className="flex-1 min-w-0 leading-snug">
                  {jobRef && <span className="font-semibold text-flux-text-primary mr-1.5">{jobRef}</span>}
                  <span className="text-flux-text-tertiary">{w.message}</span>
                </div>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}
