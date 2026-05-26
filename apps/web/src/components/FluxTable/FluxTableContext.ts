import { createContext, useContext } from 'react';
import type { PrerequisiteColumn, PrerequisiteStatus, FluxSTStatus } from './fluxTypes';
import type { StationCategoryResponse } from '@/store/api/stationCategoryApi';
import type { ShipperResponse } from '@/store/api/shipperApi';
import type { SortColumn, SortDirection } from './fluxSort';
import type { Task, TaskAssignment } from '@flux/types';

export interface FluxTableContextValue {
  /** Ordered station categories for dynamic column rendering. */
  categories: StationCategoryResponse[];
  /** ID of the currently open listbox, or null. Format: `${jobId}-${elementId}-${column}`. */
  openListboxId: string | null;
  setOpenListboxId: (id: string | null) => void;
  /** Update a job's deadline priority (0=Vital … 4=Flexible). */
  onUpdatePriority: (jobInternalId: string, deadlinePriority: number) => void;
  /** Update a single element's prerequisite status (sub-row re-aggregates parent). */
  onUpdatePrerequisite: (
    jobId: string,
    elementId: string,
    column: PrerequisiteColumn,
    status: PrerequisiteStatus,
  ) => void;
  /** Update an outsourced task's ST status (v0.5.23). */
  onUpdateSTStatus: (taskId: string, status: FluxSTStatus) => void;
  onToggleExpand: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
  onEditJob: (jobId: string) => void;
  /**
   * Hide the row "Modifier" button when false. Préprod → true, Prod →
   * false. The asymmetry mirrors the wall vs. scenario-scoped frontier
   * decided in docs/architecture/preprod-prod-photo-model.md.
   */
  canEditJobShape: boolean;
  /**
   * Disable gate listbox interactions (BAT / Papier / Plaque / Forme)
   * when false. Prod → true (the chef saisies reality events on the
   * wall), Préprod → false (the wall is read-only there). The backend
   * FluxProdOnlyGuardSubscriber already rejects these mutations in
   * Préprod ; this flag is the user-facing mirror that removes the
   * false affordance (cursor, hover, dropdown opening, caret).
   *
   * Other Flux wall affordances (ST cell, Parti, Facturé) are out of
   * V1 scope here — ST is already read-only by prior decision, Parti
   * and Facturé remain Prod-only via their handler-level guards.
   */
  canEditWall: boolean;
  expandedJobIds: Set<string>;
  /** Active sort column (v0.5.21). */
  sortColumn: SortColumn;
  /** Active sort direction (v0.5.21). */
  sortDirection: SortDirection;
  /** Callback to change the sort column (v0.5.21). */
  onSortChange: (column: SortColumn) => void;
  /** Update a job's shipper (transporteur). */
  onUpdateShipper?: (jobInternalId: string, shipperId: string | null) => void;
  /** Available shippers for the inline dropdown. */
  shippers?: ShipperResponse[];
  /** Toggle a job's shipped (Parti) status. */
  onToggleShipped?: (jobInternalId: string, shipped: boolean) => void;
  /** Toggle a job's invoiced (Facturé) status. */
  onToggleInvoiced?: (jobInternalId: string, invoiced: boolean) => void;
  /** Open scheduler in new tab scrolled to the given task (F9). */
  onStationClick?: (taskId: string) => void;
  /** Job IDs (internal UUIDs) that are late (from schedule snapshot). */
  lateJobIds: Set<string>;
  /** Job IDs (internal UUIDs) that have scheduling conflicts (excluding DeadlineConflict). */
  conflictJobIds: Set<string>;
  /**
   * Mode avancement — when true, station cells render bi-state rounds
   * instead of FluxStationIndicator / FluxStackedDots. Computed at the
   * page level (FluxPage), passed through here so every sub-row reads
   * the same flag.
   */
  advancementMode: boolean;
  /** Set or clear the rond "marqué fini" (writes recordedProgressPct = 100/0). */
  onSetTaskCompletion: (taskId: string, completed: boolean) => void;
  /**
   * Per-element / per-category task index, built once per snapshot in
   * FluxTable. Empty map when snapshot is unavailable — caller checks.
   */
  elementCategoryTasks: Map<string, Map<string, Task[]>>;
  /** taskId → assignment lookup for past-tile gate computation. */
  assignmentsByTaskId: Map<string, TaskAssignment>;
  /** Snapshot generation instant — captured once per render for stable cell rendering. */
  now: Date;
}

export const FluxTableContext = createContext<FluxTableContextValue | null>(null);

export function useFluxTableContext(): FluxTableContextValue {
  const ctx = useContext(FluxTableContext);
  if (!ctx) throw new Error('useFluxTableContext must be used within FluxTableContext.Provider');
  return ctx;
}
