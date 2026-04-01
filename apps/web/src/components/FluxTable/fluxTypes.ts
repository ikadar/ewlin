/**
 * Type definitions for the Production Flow Dashboard (Tableau de Flux).
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md
 */

// ── Prerequisite columns ───────────────────────────────────────────────────

/** The four editable prerequisite columns. */
export type PrerequisiteColumn = 'bat' | 'papier' | 'formes' | 'plaques';

// ── Prerequisite statuses ──────────────────────────────────────────────────

/**
 * Prerequisite status values — API enum strings matching @flux/types and the PHP backend.
 * These are the canonical values stored/transmitted; badge labels are derived via
 * PREREQUISITE_BADGE_LABEL for compact table display.
 */
export type PrerequisiteStatus =
  | 'none'
  | 'waiting_files'
  | 'files_received'
  | 'bat_sent'
  | 'bat_approved'
  | 'in_stock'
  | 'to_order'
  | 'ordered'
  | 'delivered'
  | 'to_make'
  | 'ready';

/** Semantic color for a prerequisite status (spec 3.8). */
export type PrerequisiteColor = 'green' | 'yellow' | 'red' | 'gray';

/** Abbreviated badge label shown in the compact table cell (spec 3.8). */
export const PREREQUISITE_BADGE_LABEL: Record<PrerequisiteStatus, string> = {
  none:           'n.a.',
  waiting_files:  'Att.fich',
  files_received: 'Reçus',
  bat_sent:       'Envoyé',
  bat_approved:   'BAT OK',
  in_stock:       'Stock',
  to_order:       'A cder',
  ordered:        'Cdé',
  delivered:      'Livré',
  to_make:        'A faire',
  ready:          'Prêt',
};

/** Maps each status to its display color. Severity: red=0 > yellow=1 > gray=2 > green=3 */
export const PREREQUISITE_STATUS_COLOR: Record<PrerequisiteStatus, PrerequisiteColor> = {
  none:           'gray',
  waiting_files:  'red',
  files_received: 'yellow',
  bat_sent:       'yellow',
  bat_approved:   'green',
  in_stock:       'green',
  to_order:       'red',
  ordered:        'yellow',
  delivered:      'green',
  to_make:        'red',
  ready:          'green',
};

/** Option shape for the prerequisite listbox dropdown (value + full French label). */
export interface PrerequisiteOption {
  value: PrerequisiteStatus;
  label: string;
}

/**
 * Available options per column for the listbox UI (spec 3.8).
 * Labels match the scheduling view (JobDetailsPanel/prerequisiteOptions.ts).
 */
export const COLUMN_OPTIONS: Record<PrerequisiteColumn, PrerequisiteOption[]> = {
  bat: [
    { value: 'none',           label: 'Pas de BAT' },
    { value: 'waiting_files',  label: 'Attente fichiers' },
    { value: 'files_received', label: 'Fichiers reçus' },
    { value: 'bat_sent',       label: 'BAT envoyé' },
    { value: 'bat_approved',   label: 'BAT OK' },
  ],
  papier: [
    { value: 'none',      label: 'Pas de papier' },
    { value: 'in_stock',  label: 'En stock' },
    { value: 'to_order',  label: 'À commander' },
    { value: 'ordered',   label: 'Commandé' },
    { value: 'delivered', label: 'Livré' },
  ],
  formes: [
    { value: 'none',      label: 'Pas de forme' },
    { value: 'in_stock',  label: 'Sur stock' },
    { value: 'to_order',  label: 'À commander' },
    { value: 'ordered',   label: 'Commandée' },
    { value: 'delivered', label: 'Livrée' },
  ],
  plaques: [
    { value: 'none',    label: 'Pas de plaques' },
    { value: 'to_make', label: 'À faire' },
    { value: 'ready',   label: 'Prêtes' },
  ],
};

// ── Station types ──────────────────────────────────────────────────────────

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
  /** Task ID for deep-linking to the scheduler (F9). */
  taskId?: string;
  /** Whether the task at this station is pinned. */
  isPinned?: boolean;
}

// ── ST (Sous-traitance) types ──────────────────────────────────────────────

/**
 * 3-state dashboard status for outsourced tasks (spec §5, API contract §2).
 * Maps to TaskStatus enum: pending=defined/ready, progress=assigned, done=completed.
 */
export type FluxSTStatus = 'pending' | 'progress' | 'done';

/** An outsourced (sous-traitance) task on an element. */
export interface FluxOutsourcingTask {
  taskId: string;
  actionType: string;
  providerName: string;
  status: FluxSTStatus;
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
  stations: Partial<Record<string, FluxStationData>>;
  /** Outsourced tasks for this element. Empty array if none (v0.5.23). */
  outsourcing: FluxOutsourcingTask[];
  /** Prerequisite date fields (JJ/MM format, null if not set) */
  filesReceivedAt?: string | null;
  batSentAt?: string | null;
  batApprovedAt?: string | null;
  paperOrderedAt?: string | null;
  paperDeliveredAt?: string | null;
  formeOrderedAt?: string | null;
  formeDeliveredAt?: string | null;
}

/** A print job row in the Flux dashboard (spec 5.1). */
export interface FluxJob {
  /** 5-digit zero-padded job number, e.g. "00042". */
  id: string;
  /** Internal GUID from the PHP API. Used for backend mutations (update, delete). */
  internalId?: string;
  client: string;
  referent: string | null;
  designation: string;
  /** Workshop exit date in JJ/MM format, e.g. "28/02". */
  sortie: string;
  /** BAT deadline in JJ/MM format, e.g. "15/04". null if not set. */
  batDeadline: string | null;
  /** One element for single-element jobs; two or more for multi-element. */
  elements: FluxElement[];
  transporteur: string | null;
  parti: {
    shipped: boolean;
    /** Shipment date in JJ/MM format, e.g. "25/02". null if not shipped. */
    date: string | null;
  };
  facture: {
    invoiced: boolean;
    /** Invoice date in JJ/MM format, e.g. "25/02". null if not invoiced. */
    date: string | null;
  };
}
