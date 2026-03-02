import { createContext, useContext } from 'react';
import type { PrerequisiteColumn, PrerequisiteStatus } from './fluxTypes';
import type { StationCategoryResponse } from '@/store/api/stationCategoryApi';

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
  onToggleExpand: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
  onEditJob: (jobId: string) => void;
  expandedJobIds: Set<string>;
}

export const FluxTableContext = createContext<FluxTableContextValue | null>(null);

export function useFluxTableContext(): FluxTableContextValue {
  const ctx = useContext(FluxTableContext);
  if (!ctx) throw new Error('useFluxTableContext must be used within FluxTableContext.Provider');
  return ctx;
}
