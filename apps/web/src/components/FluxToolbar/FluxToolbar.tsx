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
      className="border-b border-flux-border bg-flux-elevated px-4 py-2"
      data-testid="flux-toolbar"
    >
      {/* Title row */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-sm font-semibold text-flux-text-primary tracking-wide">
          Flux de production
        </h1>
        <button
          className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors"
          onClick={onNewJob}
          data-testid="flux-new-job-button"
          title="Nouveau job (Alt+N)"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          Nouveau job
          <kbd
            className="ml-1 px-1 py-0.5 bg-blue-700/60 rounded text-blue-200"
            style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}
          >
            Alt+N
          </kbd>
        </button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-flux-text-muted pointer-events-none"
          strokeWidth={2}
        />
        <input
          ref={ref}
          type="text"
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Rechercher..."
          className="w-full pl-8 pr-3 py-1.5 bg-flux-surface border border-flux-border rounded text-flux-text-secondary placeholder:text-flux-text-muted focus:outline-none focus:ring-1 focus:ring-indigo-500/60 focus:border-indigo-500/60 transition-colors"
          style={{ fontSize: '13px' }}
          data-testid="flux-search"
          aria-label="Rechercher dans le tableau de flux"
        />
      </div>
    </div>
  );
});
