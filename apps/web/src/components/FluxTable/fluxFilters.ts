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

/** Route segment → tab identifier mapping (qa.md K11.1). */
export type TabId = 'all' | 'bat' | 'papier' | 'formes' | 'plaques' | 'soustraitance';

/** The ordered list of tabs (left to right). Used for keyboard cycling. */
export const TAB_IDS: TabId[] = ['all', 'bat', 'papier', 'formes', 'plaques', 'soustraitance'];

/** Maps tab ID to its display label. */
export const TAB_LABELS: Record<TabId, string> = {
  all:            'Tous',
  bat:            'BAT à traiter',
  papier:         'Cdes papier',
  formes:         'Cdes formes',
  plaques:        'Plaques à produire',
  soustraitance:  'S-T à faire',
};

/** Maps URL pathname to tab ID. Unknown paths default to 'all'. */
export function pathnameToTab(pathname: string): TabId {
  if (pathname === '/flux/bat')            return 'bat';
  if (pathname === '/flux/papier')         return 'papier';
  if (pathname === '/flux/formes')         return 'formes';
  if (pathname === '/flux/plaques')        return 'plaques';
  if (pathname === '/flux/soustraitance')  return 'soustraitance';
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

  if (tab === 'soustraitance') {
    // Job visible if at least one element has at least one non-done outsourced task.
    return job.elements.some(el =>
      el.outsourcing.some(t => t.status !== 'done'),
    );
  }

  const bat    = job.elements.length > 1
    ? worstPrerequisiteStatus(job.elements.map(e => e.bat))
    : job.elements[0]!.bat;
  const papier = job.elements.length > 1
    ? worstPrerequisiteStatus(job.elements.map(e => e.papier))
    : job.elements[0]!.papier;
  const formes = job.elements.length > 1
    ? worstPrerequisiteStatus(job.elements.map(e => e.formes))
    : job.elements[0]!.formes;
  const plaques = job.elements.length > 1
    ? worstPrerequisiteStatus(job.elements.map(e => e.plaques))
    : job.elements[0]!.plaques;

  switch (tab) {
    case 'bat':       return bat !== 'bat_approved' && bat !== 'none';
    case 'papier':    return papier === 'to_order';
    case 'formes':    return formes === 'to_order';
    case 'plaques':   return plaques === 'to_make';
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
    : job.elements[0]!.bat;
  const papier = job.elements.length > 1
    ? worstPrerequisiteStatus(job.elements.map(e => e.papier))
    : job.elements[0]!.papier;
  const formes = job.elements.length > 1
    ? worstPrerequisiteStatus(job.elements.map(e => e.formes))
    : job.elements[0]!.formes;
  const plaques = job.elements.length > 1
    ? worstPrerequisiteStatus(job.elements.map(e => e.plaques))
    : job.elements[0]!.plaques;

  const badgeLabels = [bat, papier, formes, plaques].map(s => PREREQUISITE_BADGE_LABEL[s] ?? s);
  const allFields = [...textFields, ...badgeLabels].map(f => f.toLowerCase());

  // Every search term must match at least one field (AND logic)
  return terms.every(term => allFields.some(field => field.includes(term)));
}

/**
 * Computes count badges for all tabs simultaneously.
 * Count = number of parent rows matching BOTH that tab's filter AND the search
 * (qa.md K4.1: search also filters counts).
 */
export function computeTabCounts(
  jobs: FluxJob[],
  search: string,
): Record<TabId, number> {
  const counts: Record<TabId, number> = {
    all: 0, bat: 0, papier: 0, formes: 0, plaques: 0, soustraitance: 0,
  };
  for (const job of jobs) {
    if (!filterBySearch(job, search)) continue;
    for (const tab of TAB_IDS) {
      if (filterByTab(job, tab)) {
        counts[tab]++;
      }
    }
  }
  return counts;
}
