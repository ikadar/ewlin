/**
 * Sort logic for the Flux Dashboard table (v0.5.21).
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md, section 3.6
 */

import type { FluxJob } from './fluxTypes';
import { PREREQUISITE_STATUS_COLOR } from './fluxTypes';
import { worstPrerequisiteStatus, PREREQUISITE_COLOR_SEVERITY } from './fluxAggregation';

/** Columns that support sorting (spec 3.6). Station columns, Parti, and Actions are not sortable. */
export type SortColumn =
  | 'id'
  | 'client'
  | 'designation'
  | 'sortie'
  | 'bat'
  | 'papier'
  | 'formes'
  | 'plaques'
  | 'transporteur';

export type SortDirection = 'asc' | 'desc';

/**
 * Converts a "DD/MM" sortie date to "MMDD" for lexicographically correct month ordering.
 * Example: "28/02" → "0228", "05/03" → "0305"
 */
function sortieKey(sortie: string): string {
  const [day, month] = sortie.split('/');
  return `${month ?? ''}${day ?? ''}`;
}

/**
 * Returns the severity number (0–3) for a job's worst prerequisite status in one column.
 * For multi-element jobs, uses worstPrerequisiteStatus() to aggregate all elements.
 * red=0, yellow=1, gray=2, green=3 (higher = better)
 */
function prereqSeverity(job: FluxJob, col: 'bat' | 'papier' | 'formes' | 'plaques'): number {
  const statuses = job.elements.map(e => e[col]);
  const worst = worstPrerequisiteStatus(statuses);
  return PREREQUISITE_COLOR_SEVERITY[PREREQUISITE_STATUS_COLOR[worst]];
}

/**
 * Sorts a copy of the jobs array by the given column and direction.
 *
 * Prerequisite columns: ascending = best (green, severity=3) first.
 * Sortie: converts DD/MM → MMDD for correct month-based ordering.
 * Transporteur: null values always sort to the end regardless of direction.
 */
export function sortFluxJobs(
  jobs: FluxJob[],
  column: SortColumn,
  direction: SortDirection,
): FluxJob[] {
  const mul = direction === 'asc' ? 1 : -1;

  return [...jobs].sort((a, b) => {
    // Transporteur: null always last (direction-independent)
    if (column === 'transporteur') {
      const ta = a.transporteur;
      const tb = b.transporteur;
      if (ta === null && tb === null) return 0;
      if (ta === null) return 1;
      if (tb === null) return -1;
      return ta.localeCompare(tb) * mul;
    }

    // Prerequisite columns: ascending = best (green) first → sort by severity DESC
    if (column === 'bat' || column === 'papier' || column === 'formes' || column === 'plaques') {
      const sa = prereqSeverity(a, column);
      const sb = prereqSeverity(b, column);
      return (sb - sa) * mul; // sb-sa: higher severity (green=3) first for asc
    }

    // String / date columns
    let cmp = 0;
    switch (column) {
      case 'id':
        cmp = a.id.localeCompare(b.id);
        break;
      case 'client':
        cmp = a.client.localeCompare(b.client);
        break;
      case 'designation':
        cmp = a.designation.localeCompare(b.designation);
        break;
      case 'sortie':
        cmp = sortieKey(a.sortie).localeCompare(sortieKey(b.sortie));
        break;
    }
    return cmp * mul;
  });
}
