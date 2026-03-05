import type {
  ScheduleSnapshot,
  Station,
  StationCategory,
  StationGroup,
  DaySchedule,
} from '@flux/types';

// ============================================================================
// Louis Phase 1 — Isolated machine park (14 stations, 9 groups, 9 categories)
// ============================================================================

const closedDay: DaySchedule = { isOperating: false, slots: [] };

function day(start: string, end: string): DaySchedule {
  return { isOperating: true, slots: [{ start, end }] };
}

// --- Categories (9) ---------------------------------------------------------

const OFFSET_CRITERIA = [
  { name: 'Même type de papier', fieldPath: 'papier' },
  { name: 'Même format',         fieldPath: 'format' },
  { name: 'Même encrage',        fieldPath: 'impression' },
];

const CUTTING_CRITERIA = [
  { name: 'Même format', fieldPath: 'format' },
];

const FINISHING_CRITERIA = [
  { name: 'Même grammage', fieldPath: 'papier' },
  { name: 'Même format',   fieldPath: 'format' },
];

const PELLICULEUSE_CRITERIA = [
  { name: 'Même type de papier', fieldPath: 'papier' },
  { name: 'Même format',         fieldPath: 'format' },
];

export const louisCategories: StationCategory[] = [
  { id: 'cat-offset',        name: 'Presses Offset',          similarityCriteria: OFFSET_CRITERIA },
  { id: 'cat-cutting',       name: 'Massicots',               similarityCriteria: CUTTING_CRITERIA },
  { id: 'cat-pelliculeuse',  name: 'Pelliculeuses',           similarityCriteria: PELLICULEUSE_CRITERIA },
  { id: 'cat-typo',          name: 'Typographie',             similarityCriteria: [] },
  { id: 'cat-folding',       name: 'Plieuses',                similarityCriteria: FINISHING_CRITERIA },
  { id: 'cat-booklet',       name: 'Encarteuses-Piqueuses',   similarityCriteria: FINISHING_CRITERIA },
  { id: 'cat-assembly',      name: 'Assembleuses',            similarityCriteria: FINISHING_CRITERIA },
  { id: 'cat-saddle-stitch', name: 'Assembleuses-Piqueuses',  similarityCriteria: FINISHING_CRITERIA },
  { id: 'cat-packaging',     name: 'Conditionnement',         similarityCriteria: FINISHING_CRITERIA },
];

// --- Groups (9) -------------------------------------------------------------

export const louisGroups: StationGroup[] = [
  { id: 'grp-offset',        name: 'Presses Offset',          maxConcurrent: 10, isOutsourcedProviderGroup: false },
  { id: 'grp-cutting',       name: 'Massicots',               maxConcurrent: 10, isOutsourcedProviderGroup: false },
  { id: 'grp-pelliculeuse',  name: 'Pelliculeuses',           maxConcurrent: 10, isOutsourcedProviderGroup: false },
  { id: 'grp-typo',          name: 'Typographie',             maxConcurrent: 10, isOutsourcedProviderGroup: false },
  { id: 'grp-folding',       name: 'Plieuses',                maxConcurrent: 10, isOutsourcedProviderGroup: false },
  { id: 'grp-booklet',       name: 'Encarteuses-Piqueuses',   maxConcurrent: 10, isOutsourcedProviderGroup: false },
  { id: 'grp-assembly',      name: 'Assembleuses',            maxConcurrent: 10, isOutsourcedProviderGroup: false },
  { id: 'grp-saddle-stitch', name: 'Assembleuses-Piqueuses',  maxConcurrent: 10, isOutsourcedProviderGroup: false },
  { id: 'grp-packaging',     name: 'Conditionnement',         maxConcurrent: 10, isOutsourcedProviderGroup: false },
];

// --- Station helper ---------------------------------------------------------

function makeStation(
  id: string,
  name: string,
  categoryId: string,
  groupId: string,
  schedule: Station['operatingSchedule'],
): Station {
  return {
    id,
    name,
    status: 'Available',
    categoryId,
    groupId,
    capacity: 1,
    operatingSchedule: schedule,
    exceptions: [],
  };
}

// --- Schedules ---------------------------------------------------------------

function weekdays(start: string, end: string): Station['operatingSchedule'] {
  const d = day(start, end);
  return { monday: d, tuesday: d, wednesday: d, thursday: d, friday: d, saturday: closedDay, sunday: closedDay };
}

// Komori G40: 00h-24h Mon-Fri
const komoriG40Schedule = weekdays('00:00', '23:59');

// Ryobi 524: 7h-14h Mon-Fri
const ryobi524Schedule = weekdays('07:00', '14:00');

// Heidelberg SM52: 7h-14h30 Mon-Fri
const sm52Schedule = weekdays('07:00', '14:30');

// Polar 137: 7h-14h Mon-Fri
const polar137Schedule = weekdays('07:00', '14:00');

// Semipack: 7h-15h Mon-Fri
const semipackSchedule = weekdays('07:00', '15:00');

// SBG: 7h30-14h30 Mon-Fri
const sbgSchedule = weekdays('07:30', '14:30');

// Plieuses (B26, MBO S, MBO M80): 6h-19h Mon-Fri
const plieuseSchedule = weekdays('06:00', '19:00');

// Horizon ASS / Horizon 60H: 6h-13h Mon-Fri
const horizonSchedule = weekdays('06:00', '13:00');

// Hohner: 6h-19h Mon-Fri
const hohnerSchedule = weekdays('06:00', '19:00');

// Conditionnement (Filmeuse, Carton): 7h-14h Mon-Fri
const condSchedule = weekdays('07:00', '14:00');

// --- Stations (14) ----------------------------------------------------------

export const louisStations: Station[] = [
  // Presses Offset (3)
  makeStation('station-komori-g40',    'Komori G40',       'cat-offset',        'grp-offset',        komoriG40Schedule),
  makeStation('station-ryobi-524',     'Ryobi 524',        'cat-offset',        'grp-offset',        ryobi524Schedule),
  makeStation('station-sm52',          'Heidelberg SM52',  'cat-offset',        'grp-offset',        sm52Schedule),

  // Massicot (1)
  makeStation('station-polar-137',     'Polar 137',        'cat-cutting',       'grp-cutting',       polar137Schedule),

  // Pelliculeuse (1)
  makeStation('station-semipack',      'Semipack',         'cat-pelliculeuse',  'grp-pelliculeuse',  semipackSchedule),

  // Typo (1)
  makeStation('station-sbg',           'SBG',              'cat-typo',          'grp-typo',          sbgSchedule),

  // Plieuses (3)
  makeStation('station-b26',           'B26',              'cat-folding',       'grp-folding',       plieuseSchedule),
  makeStation('station-mbo-s',         'MBO S',            'cat-folding',       'grp-folding',       plieuseSchedule),
  makeStation('station-mbo-m80',       'MBO M80',          'cat-folding',       'grp-folding',       plieuseSchedule),

  // Encarteuse-piqueuse (1)
  makeStation('station-hohner',        'Hohner',           'cat-booklet',       'grp-booklet',       hohnerSchedule),

  // Assembleuse (1)
  makeStation('station-horizon-60h',   'Horizon 60H',      'cat-assembly',      'grp-assembly',      horizonSchedule),

  // Assembleuse-piqueuse (1)
  makeStation('station-horizon-ass',   'Horizon ASS',      'cat-saddle-stitch', 'grp-saddle-stitch', horizonSchedule),

  // Conditionnement (2)
  makeStation('station-filmeuse',      'Filmeuse',         'cat-packaging',     'grp-packaging',     condSchedule),
  makeStation('station-carton',        'Carton',           'cat-packaging',     'grp-packaging',     condSchedule),
];

// --- Helpers ----------------------------------------------------------------

export const today = new Date();
today.setHours(0, 0, 0, 0);

export function isoDate(hours: number = 0, minutes: number = 0, daysOffset: number = 0): string {
  const d = new Date(today);
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

export function louisBaseSnapshot(): Omit<ScheduleSnapshot, 'jobs' | 'elements' | 'tasks' | 'assignments' | 'conflicts' | 'lateJobs'> {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    stations: louisStations,
    categories: louisCategories,
    groups: louisGroups,
    providers: [],
  };
}
