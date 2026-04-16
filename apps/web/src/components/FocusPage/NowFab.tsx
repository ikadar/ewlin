import { LocateFixed } from 'lucide-react';

export interface NowFabProps {
  onClick: () => void;
}

/**
 * Floating "recenter on NOW" button — bottom-right on all viewports.
 * Icon: LocateFixed (crosshair-like target).
 */
export function NowFab({ onClick }: NowFabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Recentrer sur maintenant"
      title="Recentrer sur maintenant"
      className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center"
      data-testid="focus-now-fab"
    >
      <LocateFixed size={22} />
    </button>
  );
}
