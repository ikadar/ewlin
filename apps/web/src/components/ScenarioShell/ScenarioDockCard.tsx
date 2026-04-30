/**
 * Scenario dock card — variant D of the unified FAB language.
 *
 *   ┌───────────────────────────────┐
 *   │ ⌹  ADV — pic septembre +20%  │   ← header (violet)
 *   │    Branche éditable          │
 *   ├───────────────────────────────┤
 *   │  Supprimer    Promouvoir →   │   ← actions
 *   └───────────────────────────────┘
 *
 * The "back to list" gesture lives in the scenario sidebar, not
 * here — actions on the right, navigation on the left, per the
 * project-wide UX rule.
 */
import { GitBranch, Trash2, GitMerge, Check } from 'lucide-react';
import type { SimulationSummary } from '../../store/api/simulationApi';

interface ScenarioDockCardProps {
  scenario: SimulationSummary;
  onDelete: () => void;
  onPromote: () => void;
}

export function ScenarioDockCard({ scenario, onDelete, onPromote }: ScenarioDockCardProps) {
  const isMerged = scenario.mergedAt !== null;

  return (
    <div
      className="fixed bottom-5 right-5 w-[280px] z-40 rounded-2xl bg-zinc-950/85 border border-violet-800/50 backdrop-blur-md shadow-2xl shadow-violet-950/40 overflow-hidden"
      data-testid="scenario-dock-card"
    >
      <div className="px-4 py-2.5 bg-violet-950/40 border-b border-violet-800/40 flex items-center gap-2">
        <GitBranch size={13} className="text-violet-300 shrink-0" strokeWidth={2.5} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium text-violet-100 truncate flex items-center gap-1.5">
            <span className="truncate">{scenario.name ?? '(sans nom)'}</span>
            {isMerged && (
              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-emerald-600/20 border border-emerald-600/40 text-emerald-300 shrink-0">
                <Check size={9} />
                Mergé
              </span>
            )}
          </div>
          <div className="text-[9px] text-violet-400 uppercase tracking-wider">
            {isMerged ? 'Mergé · lecture seule' : 'Branche éditable'}
          </div>
        </div>
      </div>

      <div className="p-2 flex gap-2">
        <button
          type="button"
          onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-md text-[11px] text-zinc-400 hover:bg-rose-950/40 hover:text-rose-300 transition"
          title="Supprimer ce scénario"
        >
          <Trash2 size={12} />
          Supprimer
        </button>
        <button
          type="button"
          onClick={onPromote}
          disabled={isMerged}
          className={`flex-[2] flex items-center justify-center gap-1.5 h-9 rounded-md text-[11px] font-medium transition ${
            isMerged
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              : 'scenario-promote-pulse bg-violet-600 hover:bg-violet-500 text-white'
          }`}
          title={isMerged ? 'Déjà mergé' : 'Replayer les modifications dans la préprod'}
          data-testid="scenario-merge-trigger"
        >
          <GitMerge size={12} />
          Promouvoir vers préprod
        </button>
      </div>
    </div>
  );
}
