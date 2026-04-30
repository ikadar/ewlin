/**
 * Convert-to-préprod dialog.
 *
 * Replays the queued mutations against live Préprod jobs (cancel /
 * change deadline / change priority) and deletes the simulation. Uses
 * the dwell-to-confirm interaction so the chef has a single muscle-
 * memory pattern across all prod-affecting writes (promote, restore,
 * convert).
 */
import { useEffect } from 'react';
import { ArrowRightCircle, X } from 'lucide-react';
import { useConvertSimulationMutation } from '../../store';
import type { SimulationMutation } from '../../store/api/simulationApi';
import { PromotionDwellButton } from '../PromotionModal/PromotionDwellButton';

interface ConvertSimulationDialogProps {
  open: boolean;
  simulationId: string;
  simulationName: string;
  mutations: SimulationMutation[];
  onClose: () => void;
  onConverted: () => void;
}

export function ConvertSimulationDialog({
  open,
  simulationId,
  simulationName,
  mutations,
  onClose,
  onConverted,
}: ConvertSimulationDialogProps) {
  const [convert, convertState] = useConvertSimulationMutation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleConfirm = async () => {
    try {
      await convert(simulationId).unwrap();
      onConverted();
    } catch {
      // convertState.error displays
    }
  };

  const counts = mutations.reduce<Record<string, number>>((acc, m) => {
    acc[m.type] = (acc[m.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      data-testid="convert-simulation-dialog"
    >
      <div
        className="bg-zinc-950 rounded-lg border border-zinc-800 w-full max-w-[560px] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-violet-600/15 border border-violet-600/30 flex items-center justify-center">
              <ArrowRightCircle size={16} className="text-violet-300" />
            </div>
            <div>
              <div className="text-sm font-medium">Convertir vers la préprod</div>
              <div className="text-[11px] text-zinc-500">{simulationName}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </header>

        <div className="px-5 py-4 text-xs text-zinc-300 space-y-3">
          <p>
            Les <strong>{mutations.length}</strong> mutations en file d'attente
            seront appliquées à la préprod, puis cette simulation sera supprimée.
            La préprod est modifiée immédiatement — il n'y a pas de fenêtre d'undo.
          </p>
          <ul className="text-[11px] text-zinc-400 space-y-0.5">
            {Object.entries(counts).map(([kind, n]) => (
              <li key={kind}>
                · <span className="font-mono text-zinc-300">{n}</span> ×{' '}
                {kind === 'cancel_job' && 'annulation de job'}
                {kind === 'change_workshop_exit_date' && 'changement de deadline'}
                {kind === 'change_deadline_priority' && 'changement de priorité'}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-zinc-500">
            Si une mutation échoue (job introuvable, état terminal incompatible),
            l'ensemble est annulé : la préprod reste intouchée et la simulation
            reste en place pour que tu puisses corriger.
          </p>
        </div>

        {convertState.error && (
          <div className="px-5 py-2 bg-rose-950/40 text-rose-300 text-xs border-t border-rose-900">
            La conversion a échoué. Vérifie les jobs référencés et réessaie.
          </div>
        )}

        <footer className="px-5 py-3.5 border-t border-zinc-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800"
          >
            Annuler
          </button>
          <PromotionDwellButton
            onConfirmed={handleConfirm}
            disabled={mutations.length === 0 || convertState.isLoading}
            label={convertState.isLoading ? 'Conversion…' : 'Maintenir pour convertir'}
          />
        </footer>
      </div>
    </div>
  );
}
