import { memo, useRef } from 'react';
import { Search, Plus } from 'lucide-react';

interface FluxToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onNewJob: () => void;
  /** Ref forwarded from parent so Alt+F can focus this input. */
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

/**
 * Toolbar for the Production Flow Dashboard.
 * Contains the page title, "Nouveau job" button, and search bar.
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md, section 3.2
 */
export const FluxToolbar = memo(function FluxToolbar({
  searchValue,
  onSearchChange,
  onNewJob,
  searchInputRef,
}: FluxToolbarProps) {
  const internalRef = useRef<HTMLInputElement>(null);
  const ref = searchInputRef ?? internalRef;

  return (
    <div
      className="border-b border-flux-border bg-flux-elevated px-6 py-4"
      data-testid="flux-toolbar"
    >
      {/* Title row */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-flux-text-primary">
          Flux de production
        </h1>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 border border-blue-600 text-white text-base font-medium rounded-[0.25rem] transition-colors"
          onClick={onNewJob}
          data-testid="flux-new-job-button"
          title="Nouveau job (Alt+N)"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          Nouveau job
        </button>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-flux-text-tertiary pointer-events-none"
            strokeWidth={2}
          />
          <input
            ref={ref}
            type="text"
            value={searchValue}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-10 pr-4 py-2 text-base bg-flux-hover border border-flux-border rounded-lg text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            data-testid="flux-search"
            aria-label="Rechercher dans le tableau de flux"
          />
        </div>
      </div>
    </div>
  );
});
