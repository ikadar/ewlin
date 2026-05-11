/**
 * Filtering logic for the Production Flow Dashboard.
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md, sections 3.3, 6.4, 6.5
 * Q&A: docs/production-flow-dashboard-spec/qa.md, K4.1 (search filters counts too)
 *
 * v0.5.23: Added 'soustraitance' tab (ST column spec §7).
 */

import type { FluxJob } from './fluxTypes';
import { PREREQUISITE_BADGE_LABEL } from './fluxTypes';
import { worstPrerequisiteStatus } from './fluxAggregation';

// ── Operational job status (filter bar) ──────────────────────────────────────

/**
 * Filterable health status for a job, derived from the schedule snapshot.
 *
 *   late      — listed in `lateJobIds` (deadline missed). Most severe.
 *   conflict  — in `conflictJobIds` without being late.
 *   planned   — has assignments and no conflict / no lateness.
 *   unplanned — no station has been assigned yet.
 *
 * Archived jobs (shipped or invoiced) match no status filter — the
 * "À facturer" tab is the dedicated entry point for end-of-flow follow-up.
 */
export type FluxJobStatusFilter = 'late' | 'conflict' | 'planned' | 'unplanned';

export const FLUX_JOB_STATUS_FILTER_LABEL: Record<FluxJobStatusFilter, string> = {
  late:      'En retard',
  conflict:  'En conflit',
  planned:   'Planifié',
  unplanned: 'Non planifié',
};

export interface JobStatusContext {
  /** Job UUIDs (or references) currently flagged late by the snapshot. */
  lateJobIds: ReadonlySet<string>;
  /** Job UUIDs (or references) currently flagged in conflict by the snapshot. */
  conflictJobIds: ReadonlySet<string>;
}

const EMPTY_STATUS_CONTEXT: JobStatusContext = {
  lateJobIds: new Set(),
  conflictJobIds: new Set(),
};

function jobIsArchived(job: FluxJob): boolean {
  return job.parti.shipped || job.facture.invoiced;
}

function jobIsLate(job: FluxJob, ctx: JobStatusContext): boolean {
  const key = job.internalId ?? job.id;
  if (ctx.lateJobIds.has(key)) return true;
  // Mirror getFluxJobStatus semantics: any station in 'late' marks the job late.
  return job.elements.some(el =>
    Object.values(el.stations).some(s => s?.state === 'late'),
  );
}

function jobHasConflict(job: FluxJob, ctx: JobStatusContext): boolean {
  const key = job.internalId ?? job.id;
  return ctx.conflictJobIds.has(key);
}

/**
 * A job is planned as soon as one station has progressed past 'empty'.
 * Sibling helper to "non planifié" = every station is still empty.
 */
export function jobIsPlanned(job: FluxJob): boolean {
  return job.elements.some(el =>
    Object.values(el.stations).some(s => s != null && s.state !== 'empty'),
  );
}

/** Compact predicate used by both the filter and the recap line. */
export function jobMatchesStatus(
  job: FluxJob,
  status: FluxJobStatusFilter,
  ctx: JobStatusContext,
): boolean {
  // Archived jobs are out of scope — they belong to "À facturer" / closed work.
  if (jobIsArchived(job)) return false;

  const hasConflict = jobHasConflict(job, ctx);
  const isLate      = jobIsLate(job, ctx);
  const planned     = jobIsPlanned(job);

  switch (status) {
    case 'late':      return isLate;
    case 'conflict':  return hasConflict && !isLate;
    case 'planned':   return planned && !isLate && !hasConflict;
    case 'unplanned': return !planned;
  }
}

// ── Filter criteria ──────────────────────────────────────────────────────────

/** Sentinel value used to filter jobs without a transporter. */
export const CARRIER_NONE = '__none__';

/** Boolean filter cell value — used for Parti / Facturé. */
export type YesNoFilter = 'yes' | 'no';

export interface FluxFilters {
  statuses: ReadonlySet<FluxJobStatusFilter>;
  clients: ReadonlySet<string>;
  /** Carrier name, or `CARRIER_NONE` for jobs without a transporter. */
  carriers: ReadonlySet<string>;
  /** Priority levels 0–3. */
  priorities: ReadonlySet<number>;
  /** Job reference IDs (e.g. "00042"). */
  jobIds: ReadonlySet<string>;
  /** ISO YYYY-MM-DD bounds (inclusive) on `sortieIso`. */
  sortieFrom: string | null;
  sortieTo: string | null;
  /** ISO YYYY-MM-DD bounds (inclusive) on the date portion of `batDeadline`. */
  batFrom: string | null;
  batTo: string | null;
  /** Shipped/parti — empty = no filter, both = pass-through. */
  shipped: ReadonlySet<YesNoFilter>;
  /** Invoiced/facturé. */
  invoiced: ReadonlySet<YesNoFilter>;
}

export const EMPTY_FLUX_FILTERS: FluxFilters = {
  statuses: new Set(),
  clients: new Set(),
  carriers: new Set(),
  priorities: new Set(),
  jobIds: new Set(),
  sortieFrom: null,
  sortieTo: null,
  batFrom: null,
  batTo: null,
  shipped: new Set(),
  invoiced: new Set(),
};

export function hasActiveFilters(f: FluxFilters): boolean {
  return f.statuses.size > 0 || f.clients.size > 0 || f.carriers.size > 0 ||
    f.priorities.size > 0 || f.jobIds.size > 0 ||
    !!f.sortieFrom || !!f.sortieTo || !!f.batFrom || !!f.batTo ||
    f.shipped.size > 0 || f.invoiced.size > 0;
}

function isoDatePart(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null;
}

/** AND across distinct filters; OR within each multi-value filter. */
export function filterByCriteria(
  job: FluxJob,
  f: FluxFilters,
  ctx: JobStatusContext = EMPTY_STATUS_CONTEXT,
): boolean {
  if (f.statuses.size > 0) {
    let matchesAny = false;
    for (const s of f.statuses) {
      if (jobMatchesStatus(job, s, ctx)) { matchesAny = true; break; }
    }
    if (!matchesAny) return false;
  }
  if (f.clients.size > 0 && !f.clients.has(job.client)) return false;
  if (f.carriers.size > 0) {
    const v = job.transporteur ?? CARRIER_NONE;
    if (!f.carriers.has(v)) return false;
  }
  if (f.priorities.size > 0 && !f.priorities.has(job.deadlinePriority)) return false;
  if (f.jobIds.size > 0 && !f.jobIds.has(job.id)) return false;

  const sortie = job.sortieIso;
  if (f.sortieFrom && (!sortie || sortie < f.sortieFrom)) return false;
  if (f.sortieTo && (!sortie || sortie > f.sortieTo)) return false;

  const bat = isoDatePart(job.batDeadline);
  if (f.batFrom && (!bat || bat < f.batFrom)) return false;
  if (f.batTo && (!bat || bat > f.batTo)) return false;

  if (f.shipped.size > 0) {
    const v: YesNoFilter = job.parti.shipped ? 'yes' : 'no';
    if (!f.shipped.has(v)) return false;
  }
  if (f.invoiced.size > 0) {
    const v: YesNoFilter = job.facture.invoiced ? 'yes' : 'no';
    if (!f.invoiced.has(v)) return false;
  }

  return true;
}

/** Route segment → tab identifier mapping (qa.md K11.1). */
export type TabId = 'all' | 'bat' | 'papier' | 'formes' | 'plaques' | 'soustraitance' | 'a-facturer';

/** The ordered list of tabs (left to right). Used for keyboard cycling. */
export const TAB_IDS: TabId[] = ['all', 'bat', 'papier', 'formes', 'plaques', 'soustraitance', 'a-facturer'];

/** Maps tab ID to its display label. */
export const TAB_LABELS: Record<TabId, string> = {
  all:            'Tous',
  bat:            'BAT à traiter',
  papier:         'Cdes papier',
  formes:         'Cdes formes',
  plaques:        'Plaques à produire',
  soustraitance:  'S-T à faire',
  'a-facturer':   'À facturer',
};

/** Maps URL pathname to tab ID. Unknown paths default to 'all'. */
export function pathnameToTab(pathname: string): TabId {
  if (pathname === '/flux/bat')            return 'bat';
  if (pathname === '/flux/papier')         return 'papier';
  if (pathname === '/flux/formes')         return 'formes';
  if (pathname === '/flux/plaques')        return 'plaques';
  if (pathname === '/flux/soustraitance')  return 'soustraitance';
  if (pathname === '/flux/a-facturer')    return 'a-facturer';
  return 'all';
}

/** Maps tab ID to its route pathname. */
export function tabToPathname(tab: TabId): string {
  if (tab === 'all') return '/flux';
  return `/flux/${tab}`;
}

/**
 * Returns true if the job matches the given tab filter (spec 6.4).
 * For multi-element jobs, evaluates the aggregated worst status of the parent row.
 * The FluxJob already stores the worst-aggregated values in its elements[0] for
 * single-element jobs; for multi-element, we compute worst across all elements.
 */
export function filterByTab(job: FluxJob, tab: TabId): boolean {
  if (tab === 'all') return true;

  if (tab === 'a-facturer') {
    return job.parti.shipped === true && job.facture.invoiced === false;
  }

  if (tab === 'soustraitance') {
    // Job visible if at least one element has at least one non-done outsourced task.
    return job.elements.some(el =>
      el.outsourcing.some(t => t.status !== 'done'),
    );
  }

  const bat    = job.elements.length > 1
    ? worstPrerequisiteStatus(job.elements.map(e => e.bat))
    : job.elements[0]?.bat ?? 'none';
  const papier = job.elements.length > 1
    ? worstPrerequisiteStatus(job.elements.map(e => e.papier))
    : job.elements[0]?.papier ?? 'none';
  const formes = job.elements.length > 1
    ? worstPrerequisiteStatus(job.elements.map(e => e.formes))
    : job.elements[0]?.formes ?? 'none';
  const plaques = job.elements.length > 1
    ? worstPrerequisiteStatus(job.elements.map(e => e.plaques))
    : job.elements[0]?.plaques ?? 'none';

  switch (tab) {
    case 'bat':       return bat !== 'bat_approved' && bat !== 'none';
    case 'papier':    return papier === 'to_order';
    case 'formes':    return formes === 'to_order';
    case 'plaques':
      return job.elements.some(el => el.plaques === 'to_make' && el.bat === 'bat_approved');
    default:          return true;
  }
}

/**
 * Returns true if the job matches the search query.
 * Case-insensitive substring search across: id, client, designation,
 * transporteur, and prerequisite badge labels (spec 3.2).
 * Sub-row labels are NOT searched — visibility follows parent (spec 6.6).
 */
export function filterBySearch(job: FluxJob, search: string): boolean {
  if (!search.trim()) return true;

  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);

  // Text columns
  const textFields = [
    job.id,
    job.client,
    job.designation,
    job.transporteur ?? '',
  ];

  // Prerequisite badge labels (displayed values on parent row — worst for multi-element)
  const bat    = job.elements.length > 1
    ? worstPrerequisiteStatus(job.elements.map(e => e.bat))
    : job.elements[0]?.bat ?? 'none';
  const papier = job.elements.length > 1
    ? worstPrerequisiteStatus(job.elements.map(e => e.papier))
    : job.elements[0]?.papier ?? 'none';
  const formes = job.elements.length > 1
    ? worstPrerequisiteStatus(job.elements.map(e => e.formes))
    : job.elements[0]?.formes ?? 'none';
  const plaques = job.elements.length > 1
    ? worstPrerequisiteStatus(job.elements.map(e => e.plaques))
    : job.elements[0]?.plaques ?? 'none';

  const badgeLabels = [bat, papier, formes, plaques].map(s => PREREQUISITE_BADGE_LABEL[s] ?? s);
  const allFields = [...textFields, ...badgeLabels].map(f => f.toLowerCase());

  // Every search term must match at least one field (AND logic)
  return terms.every(term => allFields.some(field => field.includes(term)));
}

/**
 * Computes count badges for all tabs simultaneously.
 * Count = number of parent rows matching BOTH that tab's filter AND the search
 * AND any active criteria filters (qa.md K4.1: search also filters counts).
 */
export function computeTabCounts(
  jobs: FluxJob[],
  search: string,
  filters: FluxFilters = EMPTY_FLUX_FILTERS,
  ctx: JobStatusContext = EMPTY_STATUS_CONTEXT,
): Record<TabId, number> {
  const counts: Record<TabId, number> = {
    all: 0, bat: 0, papier: 0, formes: 0, plaques: 0, soustraitance: 0, 'a-facturer': 0,
  };
  for (const job of jobs) {
    if (!filterBySearch(job, search)) continue;
    if (!filterByCriteria(job, filters, ctx)) continue;
    for (const tab of TAB_IDS) {
      if (filterByTab(job, tab)) {
        counts[tab]++;
      }
    }
  }
  return counts;
}
