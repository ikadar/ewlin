/**
 * Type definitions for the Production Flow Dashboard (Tableau de Flux).
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md
 */

// ── Prerequisite statuses ──────────────────────────────────────────────────

/** All prerequisite status values used across BAT, Papier, Formes, Plaques columns. */
export type PrerequisiteStatus =
  | 'n.a.'
  | 'Att.fich'
  | 'Recus'
  | 'Envoye'
  | 'OK'
  | 'Stock'
  | 'A cder'
  | 'Cde'
  | 'Cdee'
  | 'Livre'
  | 'Livree'
  | 'A faire'
  | 'Pretes';

/** Semantic color for a prerequisite status (spec 3.8). */
export type PrerequisiteColor = 'green' | 'yellow' | 'red' | 'gray';

/** Maps each status to its display color. Severity: red=0 > yellow=1 > gray=2 > green=3 */
export const PREREQUISITE_STATUS_COLOR: Record<PrerequisiteStatus, PrerequisiteColor> = {
  'n.a.':    'gray',
  'Att.fich':'red',
  'Recus':   'yellow',
  'Envoye':  'yellow',
  'OK':      'green',
  'Stock':   'green',
  'A cder':  'red',
  'Cde':     'yellow',
  'Cdee':    'yellow',
  'Livre':   'green',
  'Livree':  'green',
  'A faire': 'red',
  'Pretes':  'green',
};

// ── Station types ──────────────────────────────────────────────────────────

/** Station category IDs matching the 9 production stations (spec 3.10). */
export type StationCategoryId =
  | 'cat-offset'
  | 'cat-cutting'
  | 'cat-pelliculeuse'
  | 'cat-typo'
  | 'cat-folding'
  | 'cat-booklet'
  | 'cat-saddle-stitch'
  | 'cat-assembly'
  | 'cat-packaging';

/** Ordered list of all station categories with display labels (spec 3.10). */
export const STATION_CATEGORIES: Array<{
  id: StationCategoryId;
  abbr: string;
  full: string;
}> = [
  { id: 'cat-offset',       abbr: 'Off.',   full: 'Offset' },
  { id: 'cat-cutting',      abbr: 'Mass.',  full: 'Massicot' },
  { id: 'cat-pelliculeuse', abbr: 'Pell.',  full: 'Pelliculeuse' },
  { id: 'cat-typo',         abbr: 'Typo',   full: 'Typo' },
  { id: 'cat-folding',      abbr: 'Pli.',   full: 'Plieuse' },
  { id: 'cat-booklet',      abbr: 'Enc.',   full: 'Enc.-Piqueuse' },
  { id: 'cat-saddle-stitch',abbr: 'Ass.',   full: 'Ass.-Piqueuse' },
  { id: 'cat-assembly',     abbr: 'Assem.', full: 'Assembleuse' },
  { id: 'cat-packaging',    abbr: 'Cond.',  full: 'Conditionnement' },
];

/** Visual state of a station for a given job/element (spec 3.10). */
export type StationState = 'empty' | 'planned' | 'in-progress' | 'late' | 'done';

/** French display label for each station state (tooltip text). */
export const STATION_STATE_LABEL: Record<StationState, string> = {
  empty:        '',
  planned:      'Planifié',
  'in-progress':'En cours',
  late:         'En retard',
  done:         'Terminé',
};

/** Station progress data for one element at one station. */
export interface FluxStationData {
  state: StationState;
  /** Progress percentage 0–100. Used for in-progress and late states. */
  progress?: number;
}

// ── Job / Element data ─────────────────────────────────────────────────────

/** A single print element within a multi-element job (spec 3.11, 5.3). */
export interface FluxElement {
  id: string;
  label: string;
  bat: PrerequisiteStatus;
  papier: PrerequisiteStatus;
  formes: PrerequisiteStatus;
  plaques: PrerequisiteStatus;
  stations: Partial<Record<StationCategoryId, FluxStationData>>;
}

/** A print job row in the Flux dashboard (spec 5.1). */
export interface FluxJob {
  /** 5-digit zero-padded job number, e.g. "00042". */
  id: string;
  client: string;
  designation: string;
  /** Workshop exit date in JJ/MM format, e.g. "28/02". */
  sortie: string;
  /** One element for single-element jobs; two or more for multi-element. */
  elements: FluxElement[];
  transporteur: string | null;
  parti: {
    shipped: boolean;
    /** Shipment date in JJ/MM format, e.g. "25/02". null if not shipped. */
    date: string | null;
  };
}
