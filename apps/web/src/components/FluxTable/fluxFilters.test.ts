import { describe, it, expect } from 'vitest';
import {
  filterByTab,
  filterBySearch,
  computeTabCounts,
  pathnameToTab,
  tabToPathname,
  type TabId,
} from './fluxFilters';
import { FLUX_STATIC_JOBS } from '../../mock/fluxStaticData';

// ── pathnameToTab ───────────────────────────────────────────────────────────

describe('pathnameToTab', () => {
  it('maps /flux to all', () => {
    expect(pathnameToTab('/flux')).toBe('all');
  });
  it('maps /flux/prepresse to prepresse', () => {
    expect(pathnameToTab('/flux/prepresse')).toBe('prepresse');
  });
  it('maps /flux/papier to papier', () => {
    expect(pathnameToTab('/flux/papier')).toBe('papier');
  });
  it('maps /flux/formes to formes', () => {
    expect(pathnameToTab('/flux/formes')).toBe('formes');
  });
  it('maps /flux/plaques to plaques', () => {
    expect(pathnameToTab('/flux/plaques')).toBe('plaques');
  });
  it('maps unknown paths to all', () => {
    expect(pathnameToTab('/flux/unknown')).toBe('all');
    expect(pathnameToTab('/')).toBe('all');
    expect(pathnameToTab('')).toBe('all');
  });
});

// ── tabToPathname ───────────────────────────────────────────────────────────

describe('tabToPathname', () => {
  it('maps all to /flux', () => {
    expect(tabToPathname('all')).toBe('/flux');
  });
  it('maps other tabs to /flux/{tab}', () => {
    expect(tabToPathname('prepresse')).toBe('/flux/prepresse');
    expect(tabToPathname('papier')).toBe('/flux/papier');
    expect(tabToPathname('formes')).toBe('/flux/formes');
    expect(tabToPathname('plaques')).toBe('/flux/plaques');
  });
});

// ── filterByTab — spec 6.5 verification matrix ─────────────────────────────

describe('filterByTab — spec 6.5 verification matrix', () => {
  const jobs = FLUX_STATIC_JOBS;
  const ids = (tab: TabId) =>
    jobs.filter(j => filterByTab(j, tab)).map(j => j.id);

  it('Tous: all 5 jobs visible', () => {
    expect(ids('all')).toEqual(['00042', '00078', '00091', '00103', '00117']);
  });

  it('A faire prepresse: 3 jobs (00078, 00091, 00103)', () => {
    const result = ids('prepresse');
    expect(result).toContain('00078');
    expect(result).toContain('00091');
    expect(result).toContain('00103');
    expect(result).not.toContain('00042'); // BAT = bat_approved → excluded
    expect(result).not.toContain('00117'); // BAT = none → excluded
    expect(result).toHaveLength(3);
  });

  it('Cdes papier: 2 jobs (00078, 00091)', () => {
    const result = ids('papier');
    expect(result).toContain('00078');
    expect(result).toContain('00091');
    expect(result).toHaveLength(2);
  });

  it('Cdes formes: 1 job (00078)', () => {
    const result = ids('formes');
    expect(result).toContain('00078');
    expect(result).toHaveLength(1);
  });

  it('Plaques a produire: 2 jobs (00078, 00091)', () => {
    const result = ids('plaques');
    expect(result).toContain('00078');
    expect(result).toContain('00091');
    expect(result).toHaveLength(2);
  });
});

// ── filterByTab — specific exclusion rules ──────────────────────────────────

describe('filterByTab — prepresse exclusion rules', () => {
  const okJob = FLUX_STATIC_JOBS.find(j => j.id === '00042')!; // BAT = bat_approved
  const naJob = FLUX_STATIC_JOBS.find(j => j.id === '00117')!; // BAT = none
  const redJob = FLUX_STATIC_JOBS.find(j => j.id === '00078')!; // BAT = waiting_files (red)

  it('excludes BAT=bat_approved from prepresse tab', () => {
    expect(filterByTab(okJob, 'prepresse')).toBe(false);
  });
  it('excludes BAT=none from prepresse tab', () => {
    expect(filterByTab(naJob, 'prepresse')).toBe(false);
  });
  it('includes BAT=waiting_files (red) in prepresse tab', () => {
    expect(filterByTab(redJob, 'prepresse')).toBe(true);
  });
  it('includes BAT=bat_sent (yellow) in prepresse tab', () => {
    const batSentJob = FLUX_STATIC_JOBS.find(j => j.id === '00103')!; // BAT = bat_sent
    expect(filterByTab(batSentJob, 'prepresse')).toBe(true);
  });
});

// ── filterByTab — multi-element aggregation ─────────────────────────────────

describe('filterByTab — multi-element worst-value aggregation', () => {
  // Job 00078: 3 elements. Worst BAT = waiting_files (red), Worst Papier = to_order (red)
  // Job 00091: 2 elements. Worst BAT = waiting_files (red), Worst Formes = ordered (yellow — NOT to_order)
  const job78 = FLUX_STATIC_JOBS.find(j => j.id === '00078')!;
  const job91 = FLUX_STATIC_JOBS.find(j => j.id === '00091')!;

  it('00078: matches formes filter (Formes worst = to_order)', () => {
    expect(filterByTab(job78, 'formes')).toBe(true);
  });
  it('00091: does not match formes filter (Formes worst = ordered, not to_order)', () => {
    expect(filterByTab(job91, 'formes')).toBe(false);
  });
  it('00078: matches plaques filter (Plaques worst = to_make)', () => {
    expect(filterByTab(job78, 'plaques')).toBe(true);
  });
  it('00091: matches plaques filter (Plaques worst = to_make)', () => {
    expect(filterByTab(job91, 'plaques')).toBe(true);
  });
});

// ── filterBySearch ──────────────────────────────────────────────────────────

describe('filterBySearch', () => {
  const jobs = FLUX_STATIC_JOBS;

  it('empty search matches all', () => {
    jobs.forEach(j => expect(filterBySearch(j, '')).toBe(true));
  });
  it('whitespace-only search matches all', () => {
    jobs.forEach(j => expect(filterBySearch(j, '   ')).toBe(true));
  });
  it('matches by ID (partial)', () => {
    expect(filterBySearch(jobs[0]!, '00042')).toBe(true);
    expect(filterBySearch(jobs[0]!, '0004')).toBe(true);
  });
  it('matches by client (case-insensitive)', () => {
    expect(filterBySearch(jobs[0]!, 'ducros')).toBe(true);
    expect(filterBySearch(jobs[0]!, 'DUCROS')).toBe(true);
    expect(filterBySearch(jobs[0]!, 'Duc')).toBe(true);
  });
  it('matches by designation (partial, case-insensitive)', () => {
    expect(filterBySearch(jobs[0]!, 'Brochure')).toBe(true);
    expect(filterBySearch(jobs[0]!, 'brochure')).toBe(true);
  });
  it('matches by transporteur', () => {
    // 00042 has Chronopost
    expect(filterBySearch(jobs[0]!, 'Chrono')).toBe(true);
    expect(filterBySearch(jobs[0]!, 'chrono')).toBe(true);
  });
  it('returns false for non-matching search', () => {
    expect(filterBySearch(jobs[0]!, 'XXXNONEXISTENT')).toBe(false);
  });
  it('matches by prerequisite badge label (case-insensitive)', () => {
    // 00078 parent has BAT=waiting_files → badge label "Att.fich"
    const job78 = jobs.find(j => j.id === '00078')!;
    expect(filterBySearch(job78, 'att.fich')).toBe(true);
    expect(filterBySearch(job78, 'ATT.FICH')).toBe(true);
    expect(filterBySearch(job78, 'att')).toBe(true);
  });
  it('matches by papier badge label', () => {
    // 00078 has Papier=to_order → badge label "A cder"
    const job78 = jobs.find(j => j.id === '00078')!;
    expect(filterBySearch(job78, 'a cder')).toBe(true);
    expect(filterBySearch(job78, 'A CDER')).toBe(true);
  });
  it('matches job with null transporteur', () => {
    // 00078 has null transporteur — should not throw
    const job78 = jobs.find(j => j.id === '00078')!;
    expect(filterBySearch(job78, 'Müller')).toBe(true);
    expect(filterBySearch(job78, 'nullvalue')).toBe(false);
  });
});

// ── computeTabCounts ────────────────────────────────────────────────────────

describe('computeTabCounts', () => {
  const jobs = FLUX_STATIC_JOBS;

  it('no search: matches spec 6.5 verification matrix', () => {
    const counts = computeTabCounts(jobs, '');
    expect(counts.all).toBe(5);
    expect(counts.prepresse).toBe(3);
    expect(counts.papier).toBe(2);
    expect(counts.formes).toBe(1);
    expect(counts.plaques).toBe(2);
  });

  it('search "Ducros": counts reflect only matching jobs', () => {
    const counts = computeTabCounts(jobs, 'Ducros');
    expect(counts.all).toBe(1);       // only 00042
    expect(counts.prepresse).toBe(0); // 00042 has BAT=bat_approved → excluded from prepresse
    expect(counts.papier).toBe(0);
    expect(counts.formes).toBe(0);
    expect(counts.plaques).toBe(0);
  });

  it('search "Müller": counts reflect 00078 only', () => {
    const counts = computeTabCounts(jobs, 'Müller');
    expect(counts.all).toBe(1);
    expect(counts.prepresse).toBe(1);
    expect(counts.papier).toBe(1);
    expect(counts.formes).toBe(1);
    expect(counts.plaques).toBe(1);
  });

  it('search that matches nothing: all counts are 0', () => {
    const counts = computeTabCounts(jobs, 'zzz_no_match');
    expect(counts.all).toBe(0);
    expect(counts.prepresse).toBe(0);
    expect(counts.papier).toBe(0);
    expect(counts.formes).toBe(0);
    expect(counts.plaques).toBe(0);
  });

  it('search "att.fich" matches 00078 and 00091 (worst BAT badge = Att.fich)', () => {
    const counts = computeTabCounts(jobs, 'att.fich');
    expect(counts.all).toBe(2);
    expect(counts.prepresse).toBe(2);
  });
});

// ── soustraitance tab (v0.5.23) ──────────────────────────────────────────────

describe('filterByTab — soustraitance (ST column spec §7)', () => {
  const jobs = FLUX_STATIC_JOBS;
  const ids = (tab: TabId) =>
    jobs.filter(j => filterByTab(j, tab)).map(j => j.id);

  it('shows 3 jobs with non-done ST tasks (spec §7.5 verification matrix)', () => {
    const result = ids('soustraitance');
    expect(result).toContain('00078'); // pending + progress tasks
    expect(result).toContain('00091'); // progress task
    expect(result).toContain('00103'); // pending task
    expect(result).not.toContain('00042'); // all tasks done
    expect(result).not.toContain('00117'); // no tasks
    expect(result).toHaveLength(3);
  });

  it('excludes 00042: all outsourced tasks are done', () => {
    const job = jobs.find(j => j.id === '00042')!;
    expect(filterByTab(job, 'soustraitance')).toBe(false);
  });

  it('excludes 00117: no outsourced tasks at all', () => {
    const job = jobs.find(j => j.id === '00117')!;
    expect(filterByTab(job, 'soustraitance')).toBe(false);
  });

  it('includes 00078: has pending and progress tasks across elements', () => {
    const job = jobs.find(j => j.id === '00078')!;
    expect(filterByTab(job, 'soustraitance')).toBe(true);
  });

  it('includes 00091: has progress task (done + progress mix)', () => {
    const job = jobs.find(j => j.id === '00091')!;
    expect(filterByTab(job, 'soustraitance')).toBe(true);
  });

  it('includes 00103: has pending task (done + pending mix)', () => {
    const job = jobs.find(j => j.id === '00103')!;
    expect(filterByTab(job, 'soustraitance')).toBe(true);
  });
});

describe('pathnameToTab — soustraitance URL', () => {
  it('maps /flux/soustraitance to soustraitance', () => {
    expect(pathnameToTab('/flux/soustraitance')).toBe('soustraitance');
  });
});

describe('tabToPathname — soustraitance URL', () => {
  it('maps soustraitance to /flux/soustraitance', () => {
    expect(tabToPathname('soustraitance')).toBe('/flux/soustraitance');
  });
});

describe('computeTabCounts — soustraitance', () => {
  const jobs = FLUX_STATIC_JOBS;

  it('no search: soustraitance count = 3', () => {
    const counts = computeTabCounts(jobs, '');
    expect(counts.soustraitance).toBe(3);
  });

  it('search "Ducros": soustraitance = 0 (00042 all done)', () => {
    const counts = computeTabCounts(jobs, 'Ducros');
    expect(counts.soustraitance).toBe(0);
  });

  it('search "Müller": soustraitance = 1 (00078 matches search and has non-done tasks)', () => {
    const counts = computeTabCounts(jobs, 'Müller');
    expect(counts.soustraitance).toBe(1);
  });
});
