import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { ScheduleSnapshot, Job } from '@flux/types';
import type { ComputeScheduleResult } from '../../store';
import { resolveScenarioHeader } from '../../store/api/realBaseQuery';
import { useAutoRecomputeCtx } from '../../contexts/AutoRecomputeContext';
import { getJobIdForTask } from '../../utils/taskHelpers';
import { VISIBLE_WARNING_KINDS } from '../ComputeReportToast/ComputeReportToast';

// ─── Types ───

export type ComputeMode = 'full' | 'selective' | 'incremental';

interface Step {
  label: string;
  detail?: string;
  state: 'pending' | 'active' | 'done';
}

interface LateJob {
  ref: string;
  client: string;
  lateByMinutes: number;
  priority: number;
}

interface ComputeModalProps {
  /** null = closed, set to trigger a compute */
  mode: ComputeMode | null;
  jobId?: string;
  snapshot: ScheduleSnapshot;
  onDone: (result: ComputeScheduleResult) => void;
  onDismiss: () => void;
  onComputeIncremental?: () => void;
  onComputeFull?: () => void;
}

// ─── Priority helpers ───

const PRIORITY_LABELS = ['Vital', 'Impératif', 'Important', 'Standard', 'Flexible'];
const PRIORITY_COLORS = ['#dc2626', '#ef4444', '#f97316', '#fbbf24', '#22c55e'];

// ─── Late jobs calculation ───

function findLateJobs(snapshot: ScheduleSnapshot, result: ComputeScheduleResult): LateJob[] {
  // Pull ends from BOTH halves of the engine response: internal
  // `assignments` (machine-bound tiles) and `outsourcedAssignments` (ST
  // steps like an Aller-simple PLIAGE). The validation-service iterates
  // the merged Schedule.assignments map post-persist and catches ST
  // returns that overshoot the deadline; this mirror has to do the same
  // or "Calcul terminé · 100 %" lies while the JDP paints the row red.
  const endByTask = new Map<string, string>();
  for (const a of result.assignments) {
    if (a.scheduledEnd) endByTask.set(a.taskId, a.scheduledEnd);
  }
  for (const o of result.outsourcedAssignments ?? []) {
    if (o.scheduledEnd) endByTask.set(o.taskId, o.scheduledEnd);
  }

  // Resolve each task to its job via the element layer (Task only carries
  // elementId; element.jobId is the real link). Walking task.jobId — which
  // does not exist on the Task type — left latestEnd null for every job, so
  // findLateJobs always returned [] and the recap claimed "0 en retard".
  const latestEndByJob = new Map<string, Date>();
  for (const task of snapshot.tasks) {
    const endStr = endByTask.get(task.id);
    if (!endStr) continue;
    const jobId = getJobIdForTask(task, snapshot.elements);
    if (!jobId) continue;
    const end = new Date(endStr);
    const current = latestEndByJob.get(jobId);
    if (!current || end > current) latestEndByJob.set(jobId, end);
  }

  const lateJobs: LateJob[] = [];
  for (const job of snapshot.jobs) {
    if (!job.workshopExitDate) continue;
    const deadline = new Date(job.workshopExitDate);
    const latestEnd = latestEndByJob.get(job.id) ?? null;

    if (latestEnd && latestEnd > deadline) {
      lateJobs.push({
        ref: job.reference,
        client: job.client,
        lateByMinutes: Math.round((latestEnd.getTime() - deadline.getTime()) / 60000),
        priority: job.deadlinePriority ?? 2,
      });
    }
  }
  return lateJobs.sort((a, b) => a.priority - b.priority || b.lateByMinutes - a.lateByMinutes);
}

function formatLateness(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}j ${remHours}h` : `${days}j`;
}

// ─── SSE reader hook ───

function useComputeStream(
  mode: ComputeMode | null,
  jobId: string | undefined,
  onResult: (result: ComputeScheduleResult) => void,
  showToast: ReturnType<typeof useAutoRecomputeCtx>['showToast'],
) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [result, setResult] = useState<ComputeScheduleResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  // Track the snapshot's lateJobCount at compute-start so the Waze
  // toast can report the delta once lnsDone arrives.
  const baselineLateRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mode) {
      setSteps([]);
      setResult(null);
      setElapsed(0);
      setError(null);
      return;
    }

    let cancelled = false;
    const startTime = Date.now();
    const timer = setInterval(() => {
      if (!cancelled) setElapsed(Date.now() - startTime);
    }, 100);

    const currentSteps: Step[] = [];
    let activeIdx = -1;

    function addStep(label: string, detail?: string) {
      if (activeIdx >= 0 && activeIdx < currentSteps.length) {
        currentSteps[activeIdx].state = 'done';
      }
      activeIdx = currentSteps.length;
      currentSteps.push({ label, detail, state: 'active' });
      if (!cancelled) setSteps([...currentSteps]);
    }

    function finishCurrent() {
      if (activeIdx >= 0 && activeIdx < currentSteps.length) {
        currentSteps[activeIdx].state = 'done';
        if (!cancelled) setSteps([...currentSteps]);
      }
    }

    const token = localStorage.getItem('flux_auth_token') || '';
    const scenarioHeader = resolveScenarioHeader();

    const body = JSON.stringify({
      mode,
      ...(jobId ? { jobId } : {}),
    });

    (async () => {
      try {
        const response = await fetch('/api/v1/schedule/compute-stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(scenarioHeader ? { 'X-Flux-Scenario': scenarioHeader } : {}),
          },
          body,
        });

        if (!response.ok || !response.body) {
          setError(`HTTP ${response.status}`);
          clearInterval(timer);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;

          buffer += decoder.decode(value, { stream: true });

          let pos: number;
          while ((pos = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.substring(0, pos);
            buffer = buffer.substring(pos + 2);

            let eventType = 'message';
            let data = '';
            for (const line of block.split('\n')) {
              if (line.startsWith('event: ')) eventType = line.substring(7);
              else if (line.startsWith('data: ')) data = line.substring(6);
            }

            if (!data) continue;
            const parsed = JSON.parse(data);

            if (eventType === 'step') {
              const step = parsed.step as string;
              if (step === 'payload_start') {
                addStep('Lecture des jobs et machines');
              } else if (step === 'payload_done') {
                finishCurrent();
                addStep('Données prêtes', `${parsed.jobCount} jobs, ${parsed.taskCount} tâches à placer`);
                finishCurrent();
              } else if (step === 'engine_start') {
                addStep('Lancement de l\'optimisation');
              } else if (step === 'engine_done') {
                finishCurrent();
              } else if (step === 'persist_start') {
                addStep('Enregistrement du planning');
              } else if (step === 'persist_done') {
                finishCurrent();
              } else if (step === 'outsourced_start') {
                addStep('Planification de la sous-traitance');
              } else if (step === 'outsourced_done') {
                finishCurrent();
              } else if (step === 'complete') {
                finishCurrent();
              }
            } else if (eventType === 'engine') {
              const type = parsed.type as string;
              if (type === 'fbiStart') {
                addStep(
                  `Optimisation — passe ${parsed.iteration}/${parsed.maxIterations}`,
                  'Analyse des deadlines et contraintes...',
                );
              } else if (type === 'backwardDone') {
                if (activeIdx >= 0) {
                  currentSteps[activeIdx].detail = 'Placement des tâches sur les machines...';
                  setSteps([...currentSteps]);
                }
              } else if (type === 'fbiIterationDone') {
                if (activeIdx >= 0) {
                  const late = parsed.lateJobCount ?? 0;
                  const placed = parsed.scheduledTasks ?? 0;
                  currentSteps[activeIdx].detail = late > 0
                    ? `${placed} tâches placées, ${late} job${late > 1 ? 's' : ''} en retard`
                    : `${placed} tâches placées, aucun retard`;
                  // Capture the late count FBI reached before LNS runs,
                  // so lnsDone can compute a meaningful delta for the
                  // Waze toast.
                  baselineLateRef.current = typeof parsed.lateJobCount === 'number'
                    ? parsed.lateJobCount
                    : baselineLateRef.current;
                }
                finishCurrent();
              } else if (type === 'fbiConverged') {
                addStep('Planning stabilisé', `Convergence après ${parsed.iteration} passes`);
                finishCurrent();
              } else if (type === 'lnsIteration') {
                if (activeIdx >= 0 && currentSteps[activeIdx].label.startsWith('Recherche')) {
                  const best = parsed.bestLateJobCount;
                  const improved = parsed.improved ? ' — amélioration trouvée' : '';
                  currentSteps[activeIdx].detail = `Tentative ${parsed.iteration}, meilleur : ${best} retard${best > 1 ? 's' : ''}${improved}`;
                  setSteps([...currentSteps]);
                } else {
                  addStep('Recherche d\'améliorations', `Tentative ${parsed.iteration}`);
                }
              } else if (type === 'lnsDone') {
                if (activeIdx >= 0) {
                  currentSteps[activeIdx].detail = parsed.improved
                    ? `${parsed.iterations} tentatives, réduit à ${parsed.bestLateJobCount} retard${parsed.bestLateJobCount > 1 ? 's' : ''}`
                    : `${parsed.iterations} tentatives, pas d'amélioration possible`;
                }
                finishCurrent();
                // Unify with auto-recompute: surface a Waze-style toast
                // so the user sees the improvement even after the modal
                // closes. Only when LNS actually moved the late count
                // (baseline was captured at fbiIterationDone).
                if (
                  parsed.improved === true
                  && baselineLateRef.current !== null
                  && typeof parsed.bestLateJobCount === 'number'
                ) {
                  const delta = parsed.bestLateJobCount - baselineLateRef.current;
                  if (delta < 0) {
                    showToastRef.current({
                      type: 'waze',
                      title: 'Optimisation LNS trouvée',
                      detail: 'Le moteur a réduit le nombre de retards pendant ce compute manuel.',
                      metrics: [
                        { label: 'Retards', value: `${delta}`, bad: false },
                      ],
                    });
                  }
                }
              }
            } else if (eventType === 'result') {
              if (!cancelled) {
                setResult(parsed);
                onResultRef.current(parsed);
              }
            } else if (eventType === 'error') {
              if (!cancelled) setError(parsed.message || 'Unknown error');
            }
          }
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        clearInterval(timer);
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- onResult via ref
  }, [mode, jobId]);

  return { steps, result, elapsed, error };
}

// ─── Priority breakdown ───

function PriorityBreakdown({ snapshot, lateJobs }: { snapshot: ScheduleSnapshot; lateJobs: LateJob[] }) {
  const lateByRef = new Map(lateJobs.map((lj) => [lj.ref, lj]));

  const tiers = [0, 1, 2, 3].map((tier) => {
    const jobs = snapshot.jobs.filter((j) => (j.deadlinePriority ?? 2) === tier);
    const total = jobs.length;
    const late = jobs.filter((j) => lateByRef.has(j.reference)).length;
    const onTime = total - late;
    return { tier, total, onTime, late };
  }).filter((t) => t.total > 0);

  if (tiers.length <= 1) return null;

  return (
    <div className="mt-3 pt-3 border-t border-zinc-800">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
        Par priorité
      </div>
      <div className="flex flex-col gap-1.5">
        {tiers.map(({ tier, total, onTime, late }) => {
          const pct = total > 0 ? Math.round((onTime / total) * 100) : 100;
          return (
            <div key={tier} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: PRIORITY_COLORS[tier] }}
              />
              <span className="text-[11px] text-zinc-400 w-16 shrink-0">
                {PRIORITY_LABELS[tier]}
              </span>
              {/* Green/red stacked bar */}
              <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden flex">
                {pct > 0 && (
                  <div
                    className="h-full"
                    style={{ width: `${pct}%`, background: '#22c55e' }}
                  />
                )}
                {pct < 100 && (
                  <div
                    className="h-full"
                    style={{ width: `${100 - pct}%`, background: '#ef4444' }}
                  />
                )}
              </div>
              <span className="text-[11px] tabular-nums text-zinc-400 w-16 text-right shrink-0">
                {onTime}/{total}
                <span className="text-zinc-600 ml-0.5">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Component ───

export const ComputeModal = memo(function ComputeModal({
  mode,
  jobId,
  snapshot,
  onDone,
  onDismiss,
  onComputeIncremental,
  onComputeFull,
}: ComputeModalProps) {
  const { showToast } = useAutoRecomputeCtx();
  const { steps, result, elapsed, error } = useComputeStream(mode, jobId, onDone, showToast);

  const snapshotReady = !result || snapshot.assignments.length > 0;
  const isDone = result !== null && snapshotReady;
  const isComputing = mode !== null && !isDone && !error;

  const lateJobs = useMemo(() => {
    if (!result || !snapshotReady) return [];
    const engineLate = findLateJobs(snapshot, result);
    const engineByRef = new Map(engineLate.map((lj) => [lj.ref, lj]));
    // Build the set of placed jobs FROM THE ENGINE RESULT (not the
    // pre-compute snapshot — see placedJobsCount comment above) so we
    // can drop snapshot.lateJobs entries pointing at jobs the engine
    // did not schedule. Check 1 in the validation service flags jobs
    // with past workshopExitDate as late regardless of assignments —
    // those entries must not surface in the post-compute report.
    const placedJobs = new Set<string>();
    {
      const taskToJob = new Map<string, string>();
      for (const task of snapshot.tasks) {
        const jid = getJobIdForTask(task, snapshot.elements);
        if (jid) taskToJob.set(task.id, jid);
      }
      for (const a of result.assignments) {
        const jid = taskToJob.get(a.taskId);
        if (jid) placedJobs.add(jid);
      }
    }
    return snapshot.lateJobs
      .filter((lj) => placedJobs.has(lj.jobId))
      .map((lj) => {
        const job = snapshot.jobs.find((j) => j.id === lj.jobId);
        const ref = job?.reference ?? '?';
        const exact = engineByRef.get(ref);
        return {
          ref,
          client: job?.client ?? '',
          lateByMinutes: exact?.lateByMinutes ?? (lj.delayDays ?? 1) * 24 * 60,
          priority: job?.deadlinePriority ?? 2,
        };
      })
      .sort((a, b) => a.priority - b.priority || b.lateByMinutes - a.lateByMinutes);
  }, [result, snapshot, snapshotReady]);

  const targetJob = useMemo(() => {
    if (!jobId) return null;
    return snapshot.jobs.find((j: Job) => j.id === jobId) ?? null;
  }, [jobId, snapshot.jobs]);

  // In selective mode, scope stats to the target job only
  const scopedLateJobs = useMemo(() => {
    if (mode === 'selective' && targetJob) {
      return lateJobs.filter(lj => lj.ref === targetJob.reference);
    }
    return lateJobs;
  }, [mode, targetJob, lateJobs]);

  const isSelective = mode === 'selective' && targetJob != null;
  // Count only placed jobs (with assignments) from the ENGINE RESULT,
  // not from the pre-compute snapshot — the latter can be empty if
  // the user cleared assignments before triggering this compute,
  // which would degenerate totalJobs to 0 and the pct math to 100%
  // with 0 denominator.
  const placedJobsCount = useMemo(() => {
    if (!result) return 0;
    const taskToJob = new Map<string, string>();
    for (const task of snapshot.tasks) {
      const jid = getJobIdForTask(task, snapshot.elements);
      if (jid) taskToJob.set(task.id, jid);
    }
    const placed = new Set<string>();
    for (const a of result.assignments) {
      const jid = taskToJob.get(a.taskId);
      if (jid) placed.add(jid);
    }
    return placed.size;
  }, [result, snapshot.tasks, snapshot.elements]);
  const totalJobs = isSelective ? 1 : placedJobsCount;
  const hasLate = scopedLateJobs.length > 0;
  const onTimePct = totalJobs > 0 ? Math.round(((totalJobs - scopedLateJobs.length) / totalJobs) * 100) : 100;

  const accentColor = error
    ? 'bg-red-500'
    : isComputing
      ? 'bg-blue-500'
      : hasLate
        ? 'bg-amber-500'
        : 'bg-green-500';

  // Auto-dismiss after 8s if no late jobs
  useEffect(() => {
    if (!isDone || hasLate) return;
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [isDone, hasLate, onDismiss]);

  const title = (() => {
    if (mode === 'selective' && targetJob) return `Placement — Job ${targetJob.reference}`;
    if (mode === 'incremental') return 'Placement incrémental';
    return 'Calcul du planning';
  })();

  if (!mode) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={isDone ? onDismiss : undefined}
      onKeyDown={e => { if (e.key === 'Escape' && isDone) onDismiss(); }}
      tabIndex={-1}
      ref={el => el?.focus()}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl flex flex-col"
        style={{ width: '28rem', maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className={`h-[3px] w-full ${accentColor}`} />

        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="text-sm font-semibold text-zinc-100">
            {isDone && !error ? (hasLate ? 'Calcul terminé' : 'Calcul terminé') : title}
          </h2>
          {(isDone || error) && (
            <button onClick={onDismiss} className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="px-5 py-3 overflow-y-auto flex-1">
          {/* Error */}
          {error && (
            <div className="text-red-400 text-sm">{error}</div>
          )}

          {/* Steps during computing */}
          {isComputing && (
            <div className="flex flex-col gap-0.5">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5 py-1 min-h-[24px]">
                  <div className="w-4 h-4 mt-0.5 flex items-center justify-center flex-shrink-0">
                    {step.state === 'done' && <span className="text-green-500 text-xs">✓</span>}
                    {step.state === 'active' && <div className="w-3.5 h-3.5 border-2 border-zinc-600 border-t-blue-500 rounded-full animate-spin" />}
                    {step.state === 'pending' && <span className="text-zinc-700 text-xs">○</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs leading-relaxed ${step.state === 'active' ? 'text-zinc-100 font-medium' : step.state === 'done' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      {step.label}
                    </div>
                    {step.detail && step.state !== 'pending' && (
                      <div className="text-[11px] text-zinc-500">{step.detail}</div>
                    )}
                  </div>
                  {step.state === 'active' && (
                    <span className="text-[11px] text-zinc-500 tabular-nums flex-shrink-0">
                      {(elapsed / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Result */}
          {isDone && result && (
            <>
              {isSelective && targetJob ? (
                /* ── Selective mode: compact single-job result ── */
                <div className="mb-3">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${hasLate ? 'bg-amber-500' : 'bg-green-500'}`}
                    />
                    <span className="text-sm font-semibold text-zinc-100">
                      Job {targetJob.reference}
                    </span>
                    <span className={`text-sm font-medium ${hasLate ? 'text-amber-400' : 'text-green-400'}`}>
                      {hasLate
                        ? `en retard de ${formatLateness(scopedLateJobs[0].lateByMinutes)}`
                        : 'à l\'heure'}
                    </span>
                  </div>
                  <div className="flex gap-4 text-[11px] text-zinc-500">
                    <span>
                      {result.stats.scheduledTasks}/{result.stats.totalTasks} tâches placées
                    </span>
                    <span>
                      {result.computeTimeMs >= 1000
                        ? `${(result.computeTimeMs / 1000).toFixed(1)}s`
                        : `${result.computeTimeMs}ms`}
                    </span>
                  </div>
                </div>
              ) : (
                /* ── Full / incremental mode: all-jobs dashboard ── */
                <>
                  {/* On-time ratio bar */}
                  <div className="mb-3">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-2xl font-bold tabular-nums text-zinc-100">
                        {onTimePct}%
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {totalJobs - scopedLateJobs.length} à l'heure sur {totalJobs} jobs
                      </span>
                    </div>
                    <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden flex">
                      <div
                        className="h-full rounded-l-full transition-all"
                        style={{
                          width: `${onTimePct}%`,
                          background: '#22c55e',
                        }}
                      />
                      {onTimePct < 100 && (
                        <div
                          className="h-full rounded-r-full"
                          style={{
                            width: `${100 - onTimePct}%`,
                            background: '#ef4444',
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Key stats */}
                  <div className="flex gap-4 text-[11px] text-zinc-500">
                    <span>
                      {result.stats.scheduledTasks}/{result.stats.totalTasks} tâches placées
                    </span>
                    <span>
                      {result.computeTimeMs >= 1000
                        ? `${(result.computeTimeMs / 1000).toFixed(1)}s`
                        : `${result.computeTimeMs}ms`}
                    </span>
                    {result.fbiIterations > 0 && (
                      <span>{result.fbiIterations} passes d'optimisation</span>
                    )}
                  </div>

                  {/* Priority breakdown */}
                  <PriorityBreakdown snapshot={snapshot} lateJobs={scopedLateJobs} />

                  {/* Late jobs list */}
                  {scopedLateJobs.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-zinc-800">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
                        {scopedLateJobs.length > 5 ? `Jobs les plus en retard (${scopedLateJobs.length} au total)` : 'Jobs en retard'}
                      </div>
                      {scopedLateJobs.slice(0, 5).map((lj, i) => (
                        <div key={i} className="flex items-center gap-2 py-1 px-1.5 rounded text-xs hover:bg-zinc-800/50">
                          <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: PRIORITY_COLORS[lj.priority] ?? PRIORITY_COLORS[2] }}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-zinc-100">{lj.ref}</span>
                            <span className="text-zinc-500 ml-1.5">{lj.client}</span>
                          </div>
                          <span className={`font-semibold tabular-nums shrink-0 ${lj.lateByMinutes > 7 * 24 * 60 ? 'text-red-400' : 'text-amber-400'}`}>
                            +{formatLateness(lj.lateByMinutes)}
                          </span>
                        </div>
                      ))}
                      {scopedLateJobs.length > 5 && (
                        <div className="text-[11px] text-zinc-500 px-1.5 py-1">et {scopedLateJobs.length - 5} autres...</div>
                      )}
                    </div>
                  )}

                  {/* Engine warnings — only actionable kinds shown by default */}
                  <ComputeWarnings warnings={result.warnings} snapshot={snapshot} />
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {(isDone || error) && (
          <div className="flex items-center justify-end gap-2 px-5 pb-4">
            {isDone && mode === 'selective' && onComputeIncremental && (
              <button onClick={() => { onDismiss(); onComputeIncremental(); }} className="px-3 py-1.5 rounded-md text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">
                Calculer tous les non-placés
              </button>
            )}
            {isDone && mode === 'incremental' && hasLate && onComputeFull && (
              <button onClick={() => { onDismiss(); onComputeFull(); }} className="px-3 py-1.5 rounded-md text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">
                Recalcul complet
              </button>
            )}
            <button onClick={onDismiss} className="px-3 py-1.5 rounded-md text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors">
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
});

function ComputeWarnings({ warnings, snapshot }: {
  warnings: ComputeScheduleResult['warnings'] | undefined;
  snapshot: ScheduleSnapshot;
}) {
  const [showHidden, setShowHidden] = useState(false);
  const visible = warnings?.filter((w) => VISIBLE_WARNING_KINDS.has(w.kind)) ?? [];
  const hidden = warnings?.filter((w) => !VISIBLE_WARNING_KINDS.has(w.kind)) ?? [];
  if (visible.length === 0 && hidden.length === 0) return null;

  const renderRow = (w: (typeof visible)[number], i: number, dimmed: boolean) => {
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
      <div key={`${dimmed ? 'h' : 'v'}-${i}`} className={`flex items-start gap-2 py-1 px-1.5 rounded text-xs hover:bg-zinc-800/50 ${dimmed ? 'opacity-50' : ''}`}>
        <AlertCircle size={12} className={`shrink-0 mt-px ${dimmed ? 'text-zinc-500' : 'text-amber-500'}`} />
        <div className="flex-1 min-w-0">
          {jobRef && <span className="font-semibold text-zinc-100 mr-1.5">{jobRef}</span>}
          <span className={dimmed ? 'text-zinc-500' : 'text-zinc-300'}>{w.message}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-3 pt-3 border-t border-zinc-800" data-testid="compute-warnings">
      {visible.length > 0 && (
        <>
          <div className="text-[10px] uppercase tracking-wider text-amber-500 font-semibold mb-2">
            Avertissements ({visible.length})
          </div>
          {visible.map((w, i) => renderRow(w, i, false))}
        </>
      )}
      {hidden.length > 0 && (
        <button
          onClick={() => setShowHidden((v) => !v)}
          className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-400 mt-1.5"
        >
          {showHidden ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          {showHidden ? 'Masquer' : `${hidden.length} détail${hidden.length > 1 ? 's' : ''} technique${hidden.length > 1 ? 's' : ''}`}
        </button>
      )}
      {showHidden && hidden.map((w, i) => renderRow(w, i, true))}
    </div>
  );
}

export default ComputeModal;
