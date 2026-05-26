/**
 * Business logic for the Flux Dashboard data aggregation.
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md, sections 6.1–6.3
 */

import type { Task } from '@flux/types';
import {
  PREREQUISITE_STATUS_COLOR,
  type FluxElement,
  type FluxJob,
  type FluxStationData,
  type PrerequisiteColor,
  type PrerequisiteStatus,
  type StationState,
} from './fluxTypes';

// ── Severity ranking ───────────────────────────────────────────────────────

/**
 * Severity rank for prerequisite colors (spec 6.1).
 * Lower = worse: red=0 > yellow=1 > gray=2 > green=3
 */
export const PREREQUISITE_COLOR_SEVERITY: Record<PrerequisiteColor, number> = {
  red:    0,
  yellow: 1,
  gray:   2,
  green:  3,
};

/**
 * Severity rank for station states (spec 6.3).
 * Lower = worse: late=0 > in-progress=1 > planned=2 > done=3 > empty=4
 */
export const STATION_STATE_SEVERITY: Record<StationState, number> = {
  late:          0,
  'in-progress': 1,
  planned:       2,
  done:          3,
  empty:         4,
};

// ── Prerequisite aggregation ───────────────────────────────────────────────

/**
 * Returns the worst (most severe) prerequisite status from a list of statuses.
 * Used for the parent row badge in collapsed multi-element jobs (spec 6.2).
 * 'none' (n.a.) is transparent: filtered out before aggregation so it
 * never masks a real status. Returns 'none' only when every element is n.a.
 *
 * Example: ['Stock', 'Cde', 'A cder'] → 'A cder' (red wins)
 */
export function worstPrerequisiteStatus(statuses: PrerequisiteStatus[]): PrerequisiteStatus {
  const meaningful = statuses.filter(s => s !== 'none');
  if (meaningful.length === 0) return 'none';

  return meaningful.reduce((worst, current) => {
    const worstColor = PREREQUISITE_STATUS_COLOR[worst];
    const currentColor = PREREQUISITE_STATUS_COLOR[current];
    const worstSeverity = PREREQUISITE_COLOR_SEVERITY[worstColor];
    const currentSeverity = PREREQUISITE_COLOR_SEVERITY[currentColor];
    return currentSeverity < worstSeverity ? current : worst;
  });
}

// ── Station aggregation ────────────────────────────────────────────────────

/**
 * Collects station data for all elements at a given station category.
 * Filters out undefined (empty) stations.
 */
export function getMultiElementStationData(
  elements: FluxElement[],
  categoryId: string,
): FluxStationData[] {
  return elements
    .map(el => el.stations[categoryId])
    .filter((s): s is FluxStationData => s !== undefined);
}

/**
 * Sorts station states by severity for stacked dot display (spec 6.3).
 * Worst (most critical) first: late > in-progress > planned > done
 *
 * Example: [planned, late, in-progress] → [late, in-progress, planned]
 */
export function sortStationDataBySeverity(data: FluxStationData[]): FluxStationData[] {
  return [...data].sort(
    (a, b) => STATION_STATE_SEVERITY[a.state] - STATION_STATE_SEVERITY[b.state],
  );
}

// ── Job-level status ─────────────────────────────────────────────────────

/**
 * Operational job status surfaced as a dot in the table and as a filter value.
 *
 *   late      — listed in lateJobIds (deadline missed). Most severe.
 *   conflict  — in conflictJobIds without being late.
 *   planned   — has at least one station with non-empty state, no issue.
 *   unplanned — every station is still empty.
 */
export type FluxJobStatus = 'late' | 'conflict' | 'planned' | 'unplanned';

/**
 * Derives the job-level operational status from station data and schedule snapshot.
 *
 * Precedence: late > conflict > planned > unplanned. The `late` station-state
 * fallback keeps the row tinted even before the snapshot's lateJobIds is up to date.
 */
export function getFluxJobStatus(
  job: FluxJob,
  lateJobIds?: Set<string>,
  conflictJobIds?: Set<string>,
): FluxJobStatus {
  const jobKey = job.internalId ?? job.id;
  const isLate = job.elements.some(el =>
    Object.values(el.stations).some(s => s?.state === 'late'),
  ) || (lateJobIds?.has(jobKey) ?? false);
  if (isLate) return 'late';
  if (conflictJobIds?.has(jobKey)) return 'conflict';
  const planned = job.elements.some(el =>
    Object.values(el.stations).some(s => s != null && s.state !== 'empty'),
  );
  return planned ? 'planned' : 'unplanned';
}

/**
 * Whether a job is "prêt à partir" — production complete but not yet shipped.
 *
 * True iff: not already shipped, AND every non-empty station + every outsourcing
 * task across all elements is in 'done' state, AND at least one signal of completion
 * exists (so a fully-empty job doesn't qualify).
 */
export function isReadyToShip(job: FluxJob): boolean {
  if (job.parti.shipped) return false;
  let hasAnyDoneSignal = false;
  for (const el of job.elements) {
    for (const station of Object.values(el.stations)) {
      if (!station) continue;
      if (station.state === 'done') { hasAnyDoneSignal = true; continue; }
      // 'empty' = unscheduled task that still needs work — blocks readiness.
      return false;
    }
    for (const ot of el.outsourcing) {
      if (ot.status === 'done') { hasAnyDoneSignal = true; continue; }
      return false;
    }
  }
  return hasAnyDoneSignal;
}

/**
 * Optimistic variant of isReadyToShip that uses the snapshot's live
 * recordedProgressPct (patched immediately by the RTK optimistic update).
 * Falls back to the Flux API station states for tasks without snapshot data.
 */
export function isOptimisticallyReady(
  job: FluxJob,
  elementCategoryTasks: Map<string, Map<string, Task[]>>,
): boolean {
  if (job.parti.shipped) return false;
  let hasAnyDoneSignal = false;
  for (const el of job.elements) {
    const catMap = elementCategoryTasks.get(el.id);
    for (const [catId, station] of Object.entries(el.stations)) {
      if (!station) continue;
      const tasks = catMap?.get(catId);
      if (tasks && tasks.length > 0) {
        const allDone = tasks.every((t) =>
          t.type === 'Internal'
            && ((t.recordedProgressPct ?? 0) >= 100 || t.duration.runMinutes <= 0),
        );
        if (allDone) { hasAnyDoneSignal = true; continue; }
        return false;
      }
      // No snapshot tasks for this category — fall back to Flux API state
      if (station.state === 'done') { hasAnyDoneSignal = true; continue; }
      return false;
    }
    for (const ot of el.outsourcing) {
      if (ot.status === 'done') { hasAnyDoneSignal = true; continue; }
      return false;
    }
  }
  return hasAnyDoneSignal;
}
