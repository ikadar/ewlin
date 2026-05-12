/**
 * useComputeReportStream — headless SSE reader for the "compute report" toast.
 *
 * Mirrors the stream logic used by ComputeModal but exposes a structured
 * state object (steps + elapsed + result + error) instead of rendering a
 * modal. The ComputeReportToast subscribes to this state and renders the
 * "pendant" (in-progress) and "après" (done) sections inside a toast.
 *
 * Validated visually in playground-compute-info-toast.html.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScheduleSnapshot } from '@flux/types';
import { getDeadlineDate, isInternalTask, SHIPPING_DEPARTURE_HOUR } from '@flux/types';
import type { ComputeScheduleResult } from '../store';
import { resolveScenarioHeader } from '../store/api/realBaseQuery';
import { getJobIdForTask } from '../utils/taskHelpers';

export type ComputeReportMode = 'full' | 'selective' | 'incremental';
export type ComputeReportPhase = 'idle' | 'computing' | 'done' | 'error';

export interface ComputeReportStep {
  label: string;
  detail?: string;
  state: 'pending' | 'active' | 'done';
}

export interface ComputeReportLateJob {
  ref: string;
  client: string;
  lateByMinutes: number;
  priority: number;
}

export interface ComputeReportState {
  phase: ComputeReportPhase;
  mode: ComputeReportMode | null;
  jobId: string | undefined;
  snapshot: ScheduleSnapshot | null;
  steps: ComputeReportStep[];
  elapsedMs: number;
  result: ComputeScheduleResult | null;
  error: string | null;
  lateJobs: ComputeReportLateJob[];
}

const INITIAL_STATE: ComputeReportState = {
  phase: 'idle',
  mode: null,
  jobId: undefined,
  snapshot: null,
  steps: [],
  elapsedMs: 0,
  result: null,
  error: null,
  lateJobs: [],
};

/**
 * Mirror of validation-service `identifyLateJobs` (services/validation-service/
 * src/routes/enrich.ts) so the toast's "à l'heure" ratio agrees with the
 * FluxTable's "En retard" chip — both must apply the same three checks.
 *
 * Uses `result.assignments` for fresh end timestamps but falls back to the
 * pre-compute snapshot for `isCompleted` (compute never mutates completion).
 */
function findLateJobs(
  snapshot: ScheduleSnapshot,
  result: ComputeScheduleResult,
): ComputeReportLateJob[] {
  const now = new Date();
  const today = new Date(now);
  today.setHours(SHIPPING_DEPARTURE_HOUR, 0, 0, 0);

  // Both halves of the engine response feed the lateness mirror. The
  // internal `assignments` array carries machine-bound tasks; the
  // outsourced `outsourcedAssignments` array carries ST steps (PLIAGE
  // Aller-simple etc.) whose return date can land after the deadline
  // even when every internal task fits inside it. PHP merges both into
  // the persisted Schedule.assignments map, so SnapshotBuilder catches
  // ST lateness — but if the toast only reads `result.assignments`, it
  // happily reports "100 % à l'heure" while the JDP renders the row red.
  const endByTask = new Map<string, string>();
  for (const a of result.assignments) {
    if (a.scheduledEnd) endByTask.set(a.taskId, a.scheduledEnd);
  }
  for (const o of result.outsourcedAssignments ?? []) {
    if (o.scheduledEnd) endByTask.set(o.taskId, o.scheduledEnd);
  }

  const assignmentByTask = new Map<string, ScheduleSnapshot['assignments'][number]>();
  for (const a of snapshot.assignments) {
    assignmentByTask.set(a.taskId, a);
  }

  // Precompute task → jobId via elements so we don't rescan for each job.
  const taskToJob = new Map<string, string>();
  for (const task of snapshot.tasks) {
    const jid = getJobIdForTask(task, snapshot.elements);
    if (jid) taskToJob.set(task.id, jid);
  }

  const late: ComputeReportLateJob[] = [];
  for (const job of snapshot.jobs) {
    if (!job.workshopExitDate) continue;
    const deadline = getDeadlineDate(job.workshopExitDate);

    let isLate = deadline < today;
    let latestEnd: Date | null = null;

    for (const task of snapshot.tasks) {
      if (taskToJob.get(task.id) !== job.id) continue;
      const endStr = endByTask.get(task.id);
      if (!endStr) continue;
      const end = new Date(endStr);
      if (!latestEnd || end > latestEnd) latestEnd = end;
      if (end > deadline) isLate = true;
      // Silence = consent: only flag past-window tasks as late when an
      // operator has explicitly declared partial progress (saisie).
      const assignment = assignmentByTask.get(task.id);
      if (!assignment?.isCompleted && end < now) {
        const internal = isInternalTask(task) ? task : null;
        const hasOperatorSaisie =
          assignment?.lastSaisieAt != null || (internal?.lastSaisieAt ?? null) != null;
        const partialProgress = internal?.recordedProgressPct ?? null;
        if (hasOperatorSaisie && partialProgress != null && partialProgress < 100) {
          isLate = true;
        }
      }
    }

    if (isLate) {
      const referenceDate = latestEnd && latestEnd > today ? latestEnd : today;
      const lateByMinutes = Math.max(
        1,
        Math.ceil((referenceDate.getTime() - deadline.getTime()) / 60000),
      );
      late.push({
        ref: job.reference,
        client: job.client,
        lateByMinutes,
        priority: job.deadlinePriority ?? 2,
      });
    }
  }
  return late.sort((a, b) => a.priority - b.priority || b.lateByMinutes - a.lateByMinutes);
}

export interface ComputeReportStartInput {
  mode: ComputeReportMode;
  jobId?: string;
  snapshot: ScheduleSnapshot;
  /**
   * When true, ask the PHP API to forward `skip_lns=true` to the Rust
   * engine. The caller is responsible for kicking the background LNS
   * pass afterwards (e.g. via autoRecompute's runBackgroundLns).
   */
  skipLns?: boolean;
}

export interface UseComputeReportStreamReturn {
  state: ComputeReportState;
  start: (input: ComputeReportStartInput) => void;
  cancel: () => void;
  clear: () => void;
}

export function useComputeReportStream(
  onDone?: (result: ComputeScheduleResult) => void,
): UseComputeReportStreamReturn {
  const [state, setState] = useState<ComputeReportState>(INITIAL_STATE);
  const abortRef = useRef<{ cancelled: boolean; timer?: ReturnType<typeof setInterval> } | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.cancelled = true;
      if (abortRef.current.timer) clearInterval(abortRef.current.timer);
      abortRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    cancel();
    setState(INITIAL_STATE);
  }, [cancel]);

  const start = useCallback(
    (input: ComputeReportStartInput) => {
      cancel();

      const controller = { cancelled: false as boolean, timer: undefined as undefined | ReturnType<typeof setInterval> };
      abortRef.current = controller;

      const startTime = Date.now();
      const currentSteps: ComputeReportStep[] = [];
      let activeIdx = -1;

      setState({
        phase: 'computing',
        mode: input.mode,
        jobId: input.jobId,
        snapshot: input.snapshot,
        steps: [],
        elapsedMs: 0,
        result: null,
        error: null,
        lateJobs: [],
      });

      // Elapsed tick so the active step shows a live timer.
      controller.timer = setInterval(() => {
        if (controller.cancelled) return;
        setState((prev) => (prev.phase === 'computing'
          ? { ...prev, elapsedMs: Date.now() - startTime }
          : prev));
      }, 150);

      function finishCurrent() {
        if (activeIdx >= 0 && activeIdx < currentSteps.length) {
          currentSteps[activeIdx].state = 'done';
        }
      }

      function addStep(label: string, detail?: string) {
        finishCurrent();
        activeIdx = currentSteps.length;
        currentSteps.push({ label, detail, state: 'active' });
        if (!controller.cancelled) {
          setState((prev) => ({ ...prev, steps: [...currentSteps] }));
        }
      }

      function flushSteps() {
        if (!controller.cancelled) {
          setState((prev) => ({ ...prev, steps: [...currentSteps] }));
        }
      }

      const token = localStorage.getItem('flux_auth_token') ?? '';
      const scenarioHeader = resolveScenarioHeader();
      const body = JSON.stringify({
        mode: input.mode,
        ...(input.jobId ? { jobId: input.jobId } : {}),
        ...(input.skipLns ? { skipLns: true } : {}),
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
            if (!controller.cancelled) {
              setState((prev) => ({ ...prev, phase: 'error', error: `HTTP ${response.status}` }));
            }
            if (controller.timer) clearInterval(controller.timer);
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done || controller.cancelled) break;

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
                if (step === 'payload_start') addStep('Lecture des jobs et machines');
                else if (step === 'payload_done') {
                  finishCurrent();
                  addStep('Données prêtes', `${parsed.jobCount} jobs, ${parsed.taskCount} tâches à placer`);
                  finishCurrent();
                  flushSteps();
                }
                else if (step === 'engine_start') addStep("Lancement de l'optimisation");
                else if (step === 'engine_done') { finishCurrent(); flushSteps(); }
                else if (step === 'persist_start') addStep('Enregistrement du planning');
                else if (step === 'persist_done') { finishCurrent(); flushSteps(); }
                else if (step === 'outsourced_start') addStep('Planification de la sous-traitance');
                else if (step === 'outsourced_done') { finishCurrent(); flushSteps(); }
                else if (step === 'complete') { finishCurrent(); flushSteps(); }
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
                    flushSteps();
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
                  flushSteps();
                } else if (type === 'fbiConverged') {
                  addStep('Planning stabilisé', `Convergence après ${parsed.iteration} passes`);
                  finishCurrent();
                  flushSteps();
                } else if (type === 'lnsIteration') {
                  if (activeIdx >= 0 && currentSteps[activeIdx].label.startsWith('Recherche')) {
                    const best = parsed.bestLateJobCount;
                    const improved = parsed.improved ? ' — amélioration trouvée' : '';
                    currentSteps[activeIdx].detail = `Tentative ${parsed.iteration}, meilleur : ${best} retard${best > 1 ? 's' : ''}${improved}`;
                    flushSteps();
                  } else {
                    addStep("Recherche d'améliorations", `Tentative ${parsed.iteration}`);
                  }
                } else if (type === 'lnsDone') {
                  if (activeIdx >= 0) {
                    currentSteps[activeIdx].detail = parsed.improved
                      ? `${parsed.iterations} tentatives, réduit à ${parsed.bestLateJobCount} retard${parsed.bestLateJobCount > 1 ? 's' : ''}`
                      : `${parsed.iterations} tentatives, pas d'amélioration possible`;
                  }
                  finishCurrent();
                  flushSteps();
                }
              } else if (eventType === 'result') {
                const result = parsed as ComputeScheduleResult;
                if (!controller.cancelled) {
                  const late = findLateJobs(input.snapshot, result);
                  setState((prev) => ({
                    ...prev,
                    phase: 'done',
                    result,
                    lateJobs: late,
                    elapsedMs: Date.now() - startTime,
                  }));
                  onDoneRef.current?.(result);
                }
              } else if (eventType === 'error') {
                if (!controller.cancelled) {
                  setState((prev) => ({ ...prev, phase: 'error', error: parsed.message ?? 'Unknown error' }));
                }
              }
            }
          }
        } catch (e) {
          if (!controller.cancelled) {
            setState((prev) => ({ ...prev, phase: 'error', error: String(e) }));
          }
        } finally {
          if (controller.timer) clearInterval(controller.timer);
        }
      })();
    },
    [cancel],
  );

  // Cleanup on unmount — bail out of any in-flight stream.
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return { state, start, cancel, clear };
}
