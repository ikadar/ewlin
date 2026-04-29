/**
 * Mini-header local to the planning views (OperatorSchedulePage + station view).
 *
 * Layout (h-9, 36 px):
 *   [Préprod | Prod toggle] · [pending hint / readonly label] · ……… · [Promouvoir]
 *
 * The toggle drives the URL (`?env=prod`), so refreshing or sharing the
 * link preserves the env. The Promouvoir button is visible only in
 * preprod and disabled when `disablePromote` is true (e.g., no pending
 * changes — currently always enabled in v1, refined later).
 */
import { useState } from 'react';
import { Layers, Lock, Rocket, CircleDot } from 'lucide-react';
import { useScenarioMode } from '../../contexts/ScenarioContext';
import { PromotionModal } from '../PromotionModal/PromotionModal';
import { PromotionUndoToast } from '../PromotionUndoToast/PromotionUndoToast';

export function PlanningEnvHeader() {
  const { mode, setMode } = useScenarioMode();
  const [isModalOpen, setModalOpen] = useState(false);
  const [undoExpiresAt, setUndoExpiresAt] = useState<string | null>(null);

  return (
    <>
      <header
        className="h-9 border-b border-zinc-800 flex items-center px-3 gap-2 shrink-0 bg-zinc-950"
        data-testid="planning-env-header"
      >
        <div
          className="flex bg-zinc-900 rounded-md p-0.5 gap-0.5 text-[11px] border border-zinc-800"
          role="tablist"
          aria-label="Environnement de planification"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'preprod'}
            onClick={() => setMode('preprod')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition ${
              mode === 'preprod' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Layers size={12} /> Préprod
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'prod'}
            onClick={() => setMode('prod')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition ${
              mode === 'prod' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Lock size={12} /> Prod
          </button>
        </div>

        {mode === 'preprod' && (
          <span
            className="flex items-center gap-1 text-[10px] text-amber-400 ml-1"
            data-testid="pending-hint"
          >
            <CircleDot size={10} />
            <span>changements à promouvoir</span>
          </span>
        )}
        {mode === 'prod' && (
          <span className="flex items-center gap-1 text-[10px] text-zinc-500 ml-1">
            <Lock size={12} />
            <span>plan engagé · seul l'avancement est éditable</span>
          </span>
        )}

        <div className="flex-1" />

        {mode === 'preprod' && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="px-2.5 py-1 rounded-md text-[11px] bg-emerald-600/15 text-emerald-300 border border-emerald-600/30 hover:bg-emerald-600/25 flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Promouvoir préprod → prod (Alt+Shift+P)"
            data-testid="promote-cta"
          >
            <Rocket size={12} /> Promouvoir
          </button>
        )}
      </header>

      <PromotionModal
        open={isModalOpen}
        onClose={() => setModalOpen(false)}
        onPromoted={(expiresAt) => setUndoExpiresAt(expiresAt)}
      />

      <PromotionUndoToast
        expiresAt={undoExpiresAt}
        onUndone={() => setUndoExpiresAt(null)}
        onDismiss={() => setUndoExpiresAt(null)}
      />
    </>
  );
}
