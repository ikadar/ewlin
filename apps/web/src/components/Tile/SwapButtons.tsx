import { ChevronUp, ChevronDown } from 'lucide-react';

export interface SwapButtonsProps {
  /** Callback when swap up is clicked */
  onSwapUp?: () => void;
  /** Callback when swap down is clicked */
  onSwapDown?: () => void;
  /** Whether to show the up button */
  showUp?: boolean;
  /** Whether to show the down button */
  showDown?: boolean;
}

/**
 * SwapButtons - Chevron up/down buttons for swapping tile position.
 * Visible on hover only (controlled by parent's group class).
 */
export function SwapButtons({
  onSwapUp,
  onSwapDown,
  showUp = true,
  showDown = true,
}: SwapButtonsProps) {
  if (!showUp && !showDown) return null;

  const handleSwapUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSwapUp?.();
  };

  const handleSwapDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSwapDown?.();
  };

  return (
    <div
      className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
      data-testid="swap-buttons"
    >
      {showUp && (
        <button
          type="button"
          onClick={handleSwapUp}
          className="w-6 h-6 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-zinc-400 hover:text-white transition-colors"
          title="Swap up"
          data-testid="swap-up-button"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      )}
      {showDown && (
        <button
          type="button"
          onClick={handleSwapDown}
          className="w-6 h-6 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-zinc-400 hover:text-white transition-colors"
          title="Swap down"
          data-testid="swap-down-button"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
