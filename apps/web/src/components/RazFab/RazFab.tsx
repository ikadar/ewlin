/**
 * RAZ FAB — entry point for the mass-unschedule flow.
 *
 * Circular icon-only button stacked vertically above the Command Center
 * FAB (RootLayout.tsx, `fixed bottom-6 right-6 w-14 h-14`). The 40px
 * RAZ button is centered on the same vertical axis as the 56px command
 * FAB: right-8 (32px) puts its center at 52px from the right edge —
 * matching `right-6 + 28px` = 52px.
 *
 * Single click opens the MassUnscheduleDialog. The press-and-hold safety
 * lives there, on the DwellButton inside the modal.
 *
 * Mirrors the surface treatment of the other dock cards (translucent
 * zinc-950/85 + backdrop-blur + border-zinc-800), with the destructive
 * intent signalled only by the red-400 Trash2 icon.
 */
import { Trash2 } from 'lucide-react';

interface RazFabProps {
  onClick: () => void;
  disabled?: boolean;
}

export function RazFab({ onClick, disabled = false }: RazFabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Effacer toutes les tuiles"
      title="Effacer toutes les tuiles (Ctrl+Alt+Z)"
      className="fixed bottom-24 right-8 z-40 w-10 h-10 rounded-full
                 bg-zinc-950/85 border border-zinc-800 backdrop-blur-md
                 shadow-2xl shadow-red-950/30
                 flex items-center justify-center
                 text-red-400 hover:text-red-300 hover:border-red-700
                 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Trash2 size={16} strokeWidth={2} />
    </button>
  );
}
