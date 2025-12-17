import { Plus, Search } from 'lucide-react';

export interface JobsListHeaderProps {
  /** Search query */
  searchQuery: string;
  /** Search change handler */
  onSearchChange: (query: string) => void;
  /** Add job click handler */
  onAddJob?: () => void;
}

/**
 * Header with Add Job button and search field.
 */
export function JobsListHeader({
  searchQuery,
  onSearchChange,
  onAddJob,
}: JobsListHeaderProps) {
  return (
    <div className="shrink-0 p-3 flex gap-2">
      {/* Add Job button */}
      <button
        type="button"
        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onAddJob}
        disabled={!onAddJob}
        aria-label="Ajouter un travail"
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* Search field */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher..."
          className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/10"
        />
      </div>
    </div>
  );
}
