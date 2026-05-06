import { memo, useRef } from 'react';
import { Search, Plus } from 'lucide-react';
import type { FluxFilters } from '@/components/FluxTable/fluxFilters';
import type { FluxJob } from '@/components/FluxTable/fluxTypes';
import { FluxFilterBar } from './FluxFilterBar';

interface FluxToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onNewJob: () => void;
  /**
   * When false, hide the "Nouveau job" CTA. Préprod → true (the chef
   * drafts a new JCF), Prod → false (jobs always start in Préprod
   * before being published, so a Prod-side "+" would be misleading).
   */
  canCreateJob?: boolean;
  /**
   * Active scenario mode — drives the title-line badge ("Préprod" /
   * "Prod") so the asymmetry of the page (which side writes the wall,
   * which side writes the job shape) is unambiguous at all times.
   * Halo + dock card cover identification too, but the badge sits in
   * the primary scan path (the page H1) and earns its weight by
   * removing any need to look at the corners of the viewport.
   */
  scenarioMode?: 'preprod' | 'prod';
  /** Ref forwarded from parent so Alt+F can focus this input. */
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  /** All jobs from the API — used to derive dynamic filter options. */
  jobs: ReadonlyArray<FluxJob>;
  filters: FluxFilters;
  onFiltersChange: (next: FluxFilters) => void;
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
  canCreateJob = true,
  scenarioMode,
  searchInputRef,
  jobs,
  filters,
  onFiltersChange,
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
        <h1 className="text-xl font-semibold text-flux-text-primary flex items-center">
          Flux de production
          {scenarioMode && <FluxModeBadge mode={scenarioMode} />}
        </h1>
        {canCreateJob && (
          <button
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 border border-blue-600 text-white text-base font-medium rounded-[0.25rem] transition-colors"
            onClick={onNewJob}
            data-testid="flux-new-job-button"
            title="Nouveau job (Alt+N)"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            Nouveau job
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="relative mb-3">
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

      {/* Filter bar */}
      <FluxFilterBar jobs={jobs} filters={filters} onChange={onFiltersChange} />
    </div>
  );
});

/**
 * Title-line scenario badge — sits inline with the page H1.
 *
 * Préprod = emerald (matches `.preprod-shell-glow` halo + the dock
 * card's emerald variant, semantics "ouvert, tu peux tripoter").
 * Prod = amber (matches `.prod-shell-glow` halo + amber dock card,
 * semantics "engagé en atelier").
 *
 * Kept text-only — no icon — so it doesn't drift from the H1's
 * vertical baseline ; the dock card carries the lock/unlock symbol
 * for users who want a non-text cue.
 */
function FluxModeBadge({ mode }: { mode: 'preprod' | 'prod' }) {
  const isProd = mode === 'prod';
  const label = isProd ? 'Prod' : 'Préprod';
  const className = isProd
    ? 'ml-3 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-[0.08em] bg-amber-500/20 text-amber-300'
    : 'ml-3 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-[0.08em] bg-emerald-500/20 text-emerald-300';
  return (
    <span
      className={className}
      data-testid="flux-mode-badge"
      data-mode={mode}
      aria-label={`Mode ${label}`}
    >
      {label}
    </span>
  );
}
