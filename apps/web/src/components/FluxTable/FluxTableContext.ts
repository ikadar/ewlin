import { createContext, useContext } from 'react';
import type { PrerequisiteColumn, PrerequisiteStatus, FluxSTStatus } from './fluxTypes';
import type { StationCategoryResponse } from '@/store/api/stationCategoryApi';
import type { ShipperResponse } from '@/store/api/shipperApi';
import type { SortColumn, SortDirection } from './fluxSort';

export interface FluxTableContextValue {
  /** Ordered station categories for dynamic column rendering. */
  categories: StationCategoryResponse[];
  /** ID of the currently open listbox, or null. Format: `${jobId}-${elementId}-${column}`. */
  openListboxId: string | null;
  setOpenListboxId: (id: string | null) => void;
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
  /** Open scheduler in new tab scrolled to the given task (F9). */
  onStationClick?: (taskId: string) => void;
}

export const FluxTableContext = createContext<FluxTableContextValue | null>(null);

export function useFluxTableContext(): FluxTableContextValue {
  const ctx = useContext(FluxTableContext);
  if (!ctx) throw new Error('useFluxTableContext must be used within FluxTableContext.Provider');
  return ctx;
}
