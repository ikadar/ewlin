import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { ScheduleSnapshot, Job } from '@flux/types';
import type { ComputeScheduleResult } from '../../store';

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

const PRIORITY_LABELS = ['Impératif', 'Important', 'Standard', 'Flexible'];
const PRIORITY_COLORS = ['#ef4444', '#f97316', '#fbbf24', '#22c55e'];

// ─── Late jobs calculation ───

function findLateJobs(snapshot: ScheduleSnapshot, result: ComputeScheduleResult): LateJob[] {
  const endByTask = new Map<string, string>();
  for (const a of result.assignments) {
    if (a.scheduledEnd) endByTask.set(a.taskId, a.scheduledEnd);
  }

  const jobMap = new Map(snapshot.jobs.map((j) => [j.id, j]));

  const lateJobs: LateJob[] = [];
  for (const job of snapshot.jobs) {
    if (!job.workshopExitDate) continue;
    const deadline = new Date(job.workshopExitDate);
    let latestEnd: Date | null = null;

    for (const task of snapshot.tasks) {
      if (task.jobId !== job.id) continue;
      const endStr = endByTask.get(task.id);
      if (endStr) {
        const end = new Date(endStr);
        if (!latestEnd || end > latestEnd) latestEnd = end;
      }
    }

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
) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [result, setResult] = useState<ComputeScheduleResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

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
              {/* Mini progress bar */}
              <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: pct >= 80 ? '#22c55e' : pct >= 50 ? '#fbbf24' : '#ef4444',
                  }}
                />
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
  const { steps, result, elapsed, error } = useComputeStream(mode, jobId, onDone);

  const snapshotReady = !result || snapshot.assignments.length > 0;
  const isDone = result !== null && snapshotReady;
  const isComputing = mode !== null && !isDone && !error;

  const lateJobs = useMemo(() => {
    if (!result || !snapshotReady) return [];
    const engineLate = findLateJobs(snapshot, result);
    const engineByRef = new Map(engineLate.map((lj) => [lj.ref, lj]));
    return snapshot.lateJobs
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

  const totalJobs = snapshot.jobs.length;
  const hasLate = lateJobs.length > 0;
  const onTimePct = totalJobs > 0 ? Math.round(((totalJobs - lateJobs.length) / totalJobs) * 100) : 100;

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

  const targetJob = useMemo(() => {
    if (!jobId) return null;
    return snapshot.jobs.find((j: Job) => j.id === jobId) ?? null;
  }, [jobId, snapshot.jobs]);

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
              {/* On-time ratio bar */}
              <div className="mb-3">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-2xl font-bold tabular-nums text-zinc-100">
                    {onTimePct}%
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {totalJobs - lateJobs.length} à l'heure sur {totalJobs} jobs
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
              <PriorityBreakdown snapshot={snapshot} lateJobs={lateJobs} />

              {/* Late jobs list */}
              {lateJobs.length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-800">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
                    {lateJobs.length > 5 ? `Jobs les plus en retard (${lateJobs.length} au total)` : 'Jobs en retard'}
                  </div>
                  {lateJobs.slice(0, 5).map((lj, i) => (
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
                  {lateJobs.length > 5 && (
                    <div className="text-[11px] text-zinc-500 px-1.5 py-1">et {lateJobs.length - 5} autres...</div>
                  )}
                </div>
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

export default ComputeModal;
