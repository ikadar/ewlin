/**
 * Restore-confirmation dialog.
 *
 * Mirrors PromotionModal's dwell-to-confirm interaction so the chef has a
 * single muscle-memory path for prod-affecting writes (promote / restore /
 * undo). The current prod state is auto-archived inside the same
 * transaction — that's what the "réversible" line communicates so the chef
 * knows nothing is destroyed.
 */
import { useEffect } from 'react';
import { Archive, RotateCcw, X } from 'lucide-react';
import { useRestoreArchiveMutation } from '../../store';
import { PromotionDwellButton } from '../PromotionModal/PromotionDwellButton';

interface RestoreDialogProps {
  open: boolean;
  archiveId: string;
  archiveStamp: string;
  onClose: () => void;
  onRestored: (undoExpiresAt: string | null) => void;
}

export function RestoreDialog({
  open,
  archiveId,
  archiveStamp,
  onClose,
  onRestored,
}: RestoreDialogProps) {
  const [restore, restoreState] = useRestoreArchiveMutation();

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
      const result = await restore(archiveId).unwrap();
      onRestored(result.undoAvailable ? result.undoExpiresAt : null);
    } catch {
      // RTK Query exposes the error in restoreState.error.
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      data-testid="archive-restore-dialog"
    >
      <div
        className="bg-zinc-950 rounded-lg border border-zinc-800 w-full max-w-[560px] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-violet-600/15 border border-violet-600/30 flex items-center justify-center">
              <Archive size={16} className="text-violet-300" />
            </div>
            <div>
              <div className="text-sm font-medium">Restaurer cette archive ?</div>
              <div className="text-[11px] text-zinc-500">{archiveStamp}</div>
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

        <div className="px-5 py-4 text-xs text-zinc-300 space-y-2">
          <p>
            La prod sera remplacée par l'état figé de cette archive. La prod
            actuelle est automatiquement archivée dans la même opération —
            rien n'est perdu.
          </p>
          <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <RotateCcw size={12} />
            Une fenêtre d'annulation de 5 minutes reste disponible après la
            restauration.
          </p>
        </div>

        {restoreState.error && (
          <div className="px-5 py-2 bg-rose-950/40 text-rose-300 text-xs border-t border-rose-900">
            La restauration a échoué. Vérifiez que la prod a bien été initialisée puis réessayez.
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
            disabled={restoreState.isLoading}
            label={restoreState.isLoading ? 'Restauration…' : 'Maintenir pour restaurer'}
          />
        </footer>
      </div>
    </div>
  );
}
