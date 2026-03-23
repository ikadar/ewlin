/**
 * Business logic for the Flux Dashboard data aggregation.
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md, sections 6.1–6.3
 */

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
 *
 * Example: ['Stock', 'Cde', 'A cder'] → 'A cder' (red wins)
 */
export function worstPrerequisiteStatus(statuses: PrerequisiteStatus[]): PrerequisiteStatus {
  if (statuses.length === 0) return 'none';

  return statuses.reduce((worst, current) => {
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

/** Job-level problem indicator for the Flux table row. */
export type FluxJobStatus = 'late' | 'conflict' | null;

/**
 * Derives the job-level problem status from station data and schedule snapshot.
 * A job is "late" if ANY station has state === 'late' OR it appears in lateJobIds.
 * Conflict detection uses conflictJobIds (excluding DeadlineConflict).
 */
export function getFluxJobStatus(
  job: FluxJob,
  lateJobIds?: Set<string>,
  conflictJobIds?: Set<string>,
): FluxJobStatus {
  const jobKey = job.internalId ?? job.id;
  const isLate = job.elements.some(el =>
    Object.values(el.stations).some(s => s?.state === 'late'),
  ) || lateJobIds?.has(jobKey);
  if (isLate) return 'late';
  if (conflictJobIds?.has(jobKey)) return 'conflict';
  return null;
}
