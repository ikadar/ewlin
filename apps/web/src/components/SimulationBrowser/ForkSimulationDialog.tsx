/**
 * Fork-confirmation dialog. Captures the simulation's name and
 * confirms with a single button (no dwell — forks are non-destructive).
 *
 * No TTL prompt: the backend defaults forks to 48 h auto-deletion,
 * which covers an ADV intra-day scenario plus an overnight pause
 * without bleeding into the next week's planning. The chef can
 * always extend the life by re-touching the scenario (reaper grace
 * window) or simply create a fresh fork.
 *
 * The name input pre-fills with a fun random name ("petite girafe
 * bleue", "grand dauphin mignon"…) so the chef doesn't have to invent
 * a label for every quick fork. A small dice button next to the
 * input re-rolls; typing replaces it with whatever the chef wants.
 */
import { useEffect, useState } from 'react';
import { FlaskConical, X, Dices } from 'lucide-react';
import { generateScenarioName } from '../../utils/scenarioNameGenerator';

interface ForkSimulationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
}

export function ForkSimulationDialog({ open, onClose, onConfirm }: ForkSimulationDialogProps) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(generateScenarioName());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const trimmed = name.trim();
  const canConfirm = trimmed.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      data-testid="fork-simulation-dialog"
    >
      <div
        className="bg-zinc-950 rounded-lg border border-zinc-800 w-full max-w-[480px] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-violet-600/15 border border-violet-600/30 flex items-center justify-center">
              <FlaskConical size={16} className="text-violet-300" />
            </div>
            <div>
              <div className="text-sm font-medium">Forker la préprod</div>
              <div className="text-[11px] text-zinc-500">
                Crée une branche éditable de la préprod
              </div>
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

        <div className="px-5 py-4 space-y-3">
          <label className="block">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Nom</span>
            <div className="mt-1 flex gap-1.5">
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. ADV — pic septembre +20%"
                className="flex-1 px-3 py-2 rounded-md text-xs bg-zinc-900 border border-zinc-800 focus:border-violet-500 focus:outline-none"
                maxLength={120}
                data-testid="fork-name-input"
              />
              <button
                type="button"
                onClick={() => setName(generateScenarioName())}
                className="px-2 rounded-md text-zinc-400 bg-zinc-900 border border-zinc-800 hover:text-violet-300 hover:border-violet-600/40 transition-colors"
                title="Tirer un autre nom au sort"
                aria-label="Tirer un nouveau nom au hasard"
                data-testid="fork-name-reroll"
              >
                <Dices size={14} />
              </button>
            </div>
          </label>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Le scénario est auto-supprimé après <strong className="text-zinc-300">48 h</strong> sans
            modification. Ouvre-le ou édite-le pour repousser ce délai automatiquement.
          </p>
        </div>

        <footer className="px-5 py-3.5 border-t border-zinc-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(trimmed)}
            className={`px-3 py-1.5 rounded-md text-xs text-white ${
              canConfirm ? 'bg-violet-600 hover:bg-violet-500' : 'bg-zinc-700 cursor-not-allowed'
            }`}
            data-testid="fork-confirm-button"
          >
            Forker
          </button>
        </footer>
      </div>
    </div>
  );
}
