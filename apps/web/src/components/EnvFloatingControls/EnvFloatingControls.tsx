/**
 * Préprod / Prod dock card — bottom-right floating control.
 *
 * Variant B (toggle = header) of the unified FAB language: the two
 * environment buttons span the full width of the card header, with
 * the active side visually weighted (background + brighter text).
 * The body row holds the contextual action — Promote in préprod,
 * a "switch env to edit" hint in prod.
 *
 * Same shape (rounded-2xl, backdrop-blur, shadow) as the scenario
 * dock card so the FAB grammar stays consistent across environments.
 *
 * Width fixed at 280 px to match the scenario shell card.
 */
import { useState } from 'react';
import { Layers, Lock, Rocket } from 'lucide-react';
import { useScenarioMode } from '../../contexts/ScenarioContext';
import { PromotionModal } from '../PromotionModal/PromotionModal';
import { PromotionUndoToast } from '../PromotionUndoToast/PromotionUndoToast';

export function EnvFloatingControls() {
  const { mode, setMode } = useScenarioMode();
  const [isModalOpen, setModalOpen] = useState(false);
  const [undoExpiresAt, setUndoExpiresAt] = useState<string | null>(null);

  const isPreprod = mode === 'preprod';
  const isProd = mode === 'prod';

  const cardBorder = isProd ? 'border-emerald-800/40' : 'border-zinc-800';
  const cardShadow = isProd ? 'shadow-emerald-950/30' : 'shadow-zinc-950/60';

  return (
    <>
      <div
        className={`fixed bottom-6 right-[88px] z-40 w-[280px] rounded-2xl bg-zinc-950/85 border ${cardBorder} backdrop-blur-md shadow-2xl ${cardShadow} overflow-hidden`}
        data-testid="env-floating-controls"
      >
        {/* Toggle = header — both env buttons share the row. */}
        <div className="flex border-b border-zinc-800" role="tablist" aria-label="Environnement de planification">
          <button
            type="button"
            role="tab"
            aria-selected={isPreprod}
            onClick={() => setMode('preprod')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] transition ${
              isPreprod
                ? 'bg-zinc-900/70 text-zinc-100 font-medium'
                : 'text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-300'
            }`}
          >
            <Layers size={12} className={isPreprod ? 'text-zinc-300' : ''} strokeWidth={isPreprod ? 2.5 : 2} />
            Préprod
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isProd}
            onClick={() => setMode('prod')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] transition ${
              isProd
                ? 'bg-emerald-950/40 text-emerald-100 font-medium'
                : 'text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-300'
            }`}
          >
            <Lock size={12} className={isProd ? 'text-emerald-300' : ''} strokeWidth={isProd ? 2.5 : 2} />
            Prod
          </button>
        </div>

        {/* Action row */}
        <div className="p-2">
          {isPreprod ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              title="Promouvoir préprod → prod (Alt+Shift+P)"
              className="env-promote-pulse w-full flex items-center justify-center gap-1.5 h-9 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium"
              data-testid="promote-cta"
            >
              <Rocket size={12} />
              Promouvoir préprod → prod
            </button>
          ) : (
            <div className="w-full flex items-center justify-center gap-1.5 h-9 rounded-md text-[10px] text-zinc-500 italic">
              Pour éditer, bascule en préprod
            </div>
          )}
        </div>
      </div>

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
