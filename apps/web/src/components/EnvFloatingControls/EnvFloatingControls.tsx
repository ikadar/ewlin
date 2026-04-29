/**
 * Global floating cluster for the Préprod | Prod env switcher and the
 * promotion CTA. Sits to the left of the Command Center FAB (bottom-right
 * of the viewport), visible on every page so the chef can switch env or
 * promote without scrolling to a header.
 *
 * Components hosted:
 *   - Préprod | Prod segmented toggle
 *   - "Promouvoir" pill (visible only in préprod)
 *   - PromotionModal (rendered when CTA clicked)
 *   - PromotionUndoToast (rendered after a successful promotion)
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

  const tabBase = 'px-2.5 py-1 rounded-full flex items-center gap-1.5 transition text-[11px]';
  const tabActive = 'bg-zinc-100 text-zinc-900 shadow-sm';
  const tabInactive = 'text-zinc-400 hover:text-zinc-100';

  return (
    <>
      <div
        className="fixed bottom-6 right-[88px] z-40 flex items-center gap-2"
        data-testid="env-floating-controls"
      >
        {mode === 'preprod' && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="px-3 py-1.5 rounded-full text-[11px] bg-emerald-600 text-white border border-emerald-500 hover:bg-emerald-500 shadow-lg flex items-center gap-1.5 transition"
            title="Promouvoir préprod → prod (Alt+Shift+P)"
            data-testid="promote-cta"
          >
            <Rocket size={12} /> Promouvoir
          </button>
        )}
        <div
          className="flex items-center bg-zinc-900/90 backdrop-blur-sm rounded-full p-0.5 gap-0.5 border border-zinc-800 shadow-lg"
          role="tablist"
          aria-label="Environnement de planification"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'preprod'}
            onClick={() => setMode('preprod')}
            className={`${tabBase} ${mode === 'preprod' ? tabActive : tabInactive}`}
          >
            <Layers size={12} /> Préprod
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'prod'}
            onClick={() => setMode('prod')}
            className={`${tabBase} ${mode === 'prod' ? tabActive : tabInactive}`}
          >
            <Lock size={12} /> Prod
          </button>
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
