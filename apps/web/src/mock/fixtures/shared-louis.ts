import type {
  ScheduleSnapshot,
  Station,
  StationCategory,
  DaySchedule,
  SimilarityCriterion,
} from '@flux/types';

// ============================================================================
// Louis Phase 1 — Isolated machine park (14 stations, 9 groups, 9 categories)
// ============================================================================

const closedDay: DaySchedule = { isOperating: false, slots: [] };

function day(start: string, end: string): DaySchedule {
  return { isOperating: true, slots: [{ start, end }] };
}

// --- Categories (9) ---------------------------------------------------------

const OFFSET_CRITERIA: SimilarityCriterion[] = [
  { code: 'paper_type',   name: 'Même type de papier', fieldPath: 'papier' },
  { code: 'paper_format', name: 'Même format',         fieldPath: 'format' },
  { code: 'inking',       name: 'Même encrage',        fieldPath: 'impression' },
];

const CUTTING_CRITERIA: SimilarityCriterion[] = [
  { code: 'paper_format', name: 'Même format', fieldPath: 'format' },
];

const FINISHING_CRITERIA: SimilarityCriterion[] = [
  { code: 'paper_weight', name: 'Même grammage', fieldPath: 'papier' },
  { code: 'paper_format', name: 'Même format',   fieldPath: 'format' },
];

const PELLICULEUSE_CRITERIA: SimilarityCriterion[] = [
  { code: 'paper_type',   name: 'Même type de papier', fieldPath: 'papier' },
  { code: 'paper_format', name: 'Même format',         fieldPath: 'format' },
];

export const louisCategories: StationCategory[] = [
  { id: 'cat-offset',        name: 'Presses Offset',          similarityCriteria: OFFSET_CRITERIA,        similarityScoreRules: [] },
  { id: 'cat-cutting',       name: 'Massicots',               similarityCriteria: CUTTING_CRITERIA,       similarityScoreRules: [] },
  { id: 'cat-pelliculeuse',  name: 'Pelliculeuses',           similarityCriteria: PELLICULEUSE_CRITERIA,  similarityScoreRules: [] },
  { id: 'cat-typo',          name: 'Typographie',             similarityCriteria: [],                     similarityScoreRules: [] },
  { id: 'cat-folding',       name: 'Plieuses',                similarityCriteria: FINISHING_CRITERIA,     similarityScoreRules: [] },
  { id: 'cat-booklet',       name: 'Encarteuses-Piqueuses',   similarityCriteria: FINISHING_CRITERIA,     similarityScoreRules: [] },
  { id: 'cat-assembly',      name: 'Assembleuses',            similarityCriteria: FINISHING_CRITERIA,     similarityScoreRules: [] },
  { id: 'cat-saddle-stitch', name: 'Assembleuses-Piqueuses',  similarityCriteria: FINISHING_CRITERIA,     similarityScoreRules: [] },
  { id: 'cat-packaging',     name: 'Conditionnement',         similarityCriteria: FINISHING_CRITERIA,     similarityScoreRules: [] },
];

// --- Station helper ---------------------------------------------------------

function makeStation(
  id: string,
  name: string,
  categoryId: string,
  schedule: Station['operatingSchedule'],
): Station {
  return {
    id,
    name,
    status: 'Available',
    categoryId,
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
  makeStation('station-komori-g40',    'Komori G40',       'cat-offset',        komoriG40Schedule),
  makeStation('station-ryobi-524',     'Ryobi 524',        'cat-offset',        ryobi524Schedule),
  makeStation('station-sm52',          'Heidelberg SM52',  'cat-offset',        sm52Schedule),

  // Massicot (1)
  makeStation('station-polar-137',     'Polar 137',        'cat-cutting',       polar137Schedule),

  // Pelliculeuse (1)
  makeStation('station-semipack',      'Semipack',         'cat-pelliculeuse',  semipackSchedule),

  // Typo (1)
  makeStation('station-sbg',           'SBG',              'cat-typo',          sbgSchedule),

  // Plieuses (3)
  makeStation('station-b26',           'B26',              'cat-folding',       plieuseSchedule),
  makeStation('station-mbo-s',         'MBO S',            'cat-folding',       plieuseSchedule),
  makeStation('station-mbo-m80',       'MBO M80',          'cat-folding',       plieuseSchedule),

  // Encarteuse-piqueuse (1)
  makeStation('station-hohner',        'Hohner',           'cat-booklet',       hohnerSchedule),

  // Assembleuse (1)
  makeStation('station-horizon-60h',   'Horizon 60H',      'cat-assembly',      horizonSchedule),

  // Assembleuse-piqueuse (1)
  makeStation('station-horizon-ass',   'Horizon ASS',      'cat-saddle-stitch', horizonSchedule),

  // Conditionnement (2)
  makeStation('station-filmeuse',      'Filmeuse',         'cat-packaging',     condSchedule),
  makeStation('station-carton',        'Carton',           'cat-packaging',     condSchedule),
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
    providers: [],
  };
}
