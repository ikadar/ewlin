import { Search } from 'lucide-react';
import { PlanningViewToggle } from './PlanningViewToggle';

export type JobTab = 'planified' | 'unplanified';
export type JobChip = 'all' | 'late' | 'conflict';

export interface JobsListHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeTab: JobTab;
  onTabChange: (tab: JobTab) => void;
  tabCounts: { planified: number; unplanified: number };
  activeChip: JobChip;
  onChipChange: (chip: JobChip) => void;
  chipCounts: { all: number; late: number; conflict: number };
}

export function JobsListHeader({
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  tabCounts,
  activeChip,
  onChipChange,
  chipCounts,
}: JobsListHeaderProps) {
  return (
    <div className="shrink-0 px-3 pt-3 pb-2 flex flex-col gap-2">
      <PlanningViewToggle />
      <div className="relative">
        <Search className="absolute left-[10px] top-1/2 -translate-y-1/2 w-[14px] h-[14px] text-zinc-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher..."
          className="w-full pl-[30px] pr-[10px] py-[6px] text-[12px] bg-white/[0.04] border border-white/[0.08] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/10"
        />
      </div>

      <div
        className="flex bg-white/[0.04] rounded-md overflow-hidden"
        role="tablist"
        aria-label="Filtrer par état de planification"
      >
        <TabButton
          active={activeTab === 'planified'}
          onClick={() => onTabChange('planified')}
          label="Planifiées"
          count={tabCounts.planified}
        />
        <TabButton
          active={activeTab === 'unplanified'}
          onClick={() => onTabChange('unplanified')}
          label="Non planifiées"
          count={tabCounts.unplanified}
        />
      </div>

      <div className="flex flex-wrap gap-1" role="group" aria-label="Filtres secondaires">
        <ChipButton
          active={activeChip === 'all'}
          onClick={() => onChipChange('all')}
          label="Toutes"
          count={chipCounts.all}
          variant="neutral"
        />
        <ChipButton
          active={activeChip === 'late'}
          onClick={() => onChipChange('late')}
          label="En retard"
          count={chipCounts.late}
          variant="late"
        />
        <ChipButton
          active={activeChip === 'conflict'}
          onClick={() => onChipChange('conflict')}
          label="Conflits"
          count={chipCounts.conflict}
          variant="neutral"
        />
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}

function TabButton({ active, onClick, label, count }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 text-[11px] px-2 py-[6px] flex items-center justify-center gap-1.5 font-medium transition-colors ${
        active
          ? 'bg-white/10 text-white'
          : 'text-zinc-400 hover:text-zinc-200'
      }`}
    >
      <span>{label}</span>
      <span className={`font-mono text-[10px] ${active ? 'opacity-100' : 'opacity-70'}`}>
        {count}
      </span>
    </button>
  );
}

interface ChipButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  variant: 'neutral' | 'late';
}

function ChipButton({ active, onClick, label, count, variant }: ChipButtonProps) {
  const zero = count === 0;
  const activeClasses =
    variant === 'late'
      ? 'bg-red-500/[0.18] border-red-500/40 text-red-300'
      : 'bg-blue-500/[0.18] border-blue-500/40 text-blue-300';

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`text-[11px] px-2 py-1 rounded-full border font-medium inline-flex items-center gap-1.5 transition-colors ${
        active
          ? activeClasses
          : 'bg-white/[0.04] border-white/[0.06] text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
      } ${zero && !active ? 'opacity-40' : ''}`}
    >
      <span>{label}</span>
      <span className={`font-mono text-[10px] ${active ? 'opacity-100' : 'opacity-75'}`}>
        {count}
      </span>
    </button>
  );
}
