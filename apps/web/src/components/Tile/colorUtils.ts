/**
 * State-based color utilities for tile visualization.
 * Color encodes tile state (late, conflict, blocked, completed, default)
 * rather than per-job decorative colors.
 */

export type TileState = 'shipped' | 'late' | 'conflict' | 'blocked' | 'completed' | 'default';

export interface ColorClasses {
  border: string;
  setupBg: string;
  setupBorder: string;
  runBg: string;
  text: string;
}

/**
 * Compute tile state from boolean flags.
 * Priority (highest wins): shipped > late > conflict > blocked > completed > default.
 */
export function computeTileState(
  isShipped: boolean,
  isLate: boolean,
  hasConflict: boolean,
  isBlocked: boolean,
  isCompleted: boolean,
): TileState {
  if (isShipped) return 'shipped';
  if (isLate) return 'late';
  if (hasConflict) return 'conflict';
  if (isBlocked) return 'blocked';
  if (isCompleted) return 'completed';
  return 'default';
}

const stateColorMap: Record<TileState, ColorClasses> = {
  shipped: {
    border: 'border-l-emerald-500',
    setupBg: 'bg-emerald-500/[0.14]',
    setupBorder: 'border-emerald-400/20',
    runBg: 'bg-emerald-500/[0.09]',
    text: 'text-emerald-300',
  },
  default: {
    border: 'border-l-blue-500',
    setupBg: 'bg-blue-500/[0.12]',
    setupBorder: 'border-blue-400/20',
    runBg: 'bg-blue-500/[0.12]',
    text: 'text-blue-300',
  },
  completed: {
    border: 'border-l-green-500',
    setupBg: 'bg-green-500/[0.14]',
    setupBorder: 'border-green-400/20',
    runBg: 'bg-green-500/[0.09]',
    text: 'text-green-300',
  },
  conflict: {
    border: 'border-l-amber-500',
    setupBg: 'bg-amber-500/[0.14]',
    setupBorder: 'border-amber-400/20',
    runBg: 'bg-amber-500/[0.09]',
    text: 'text-amber-300',
  },
  late: {
    border: 'border-l-red-500',
    setupBg: 'bg-red-500/[0.14]',
    setupBorder: 'border-red-400/20',
    runBg: 'bg-red-500/[0.09]',
    text: 'text-red-300',
  },
  blocked: {
    border: 'border-l-zinc-500',
    setupBg: 'bg-zinc-500/[0.10]',
    setupBorder: 'border-zinc-400/15',
    runBg: 'bg-zinc-500/[0.06]',
    text: 'text-zinc-400',
  },
};

/**
 * Get Tailwind classes for a tile state.
 */
export function getStateColorClasses(state: TileState): ColorClasses {
  return stateColorMap[state];
}

/**
 * Get the glow color (rgba) for selection effect, derived from state border color.
 */
const stateGlowColorMap: Record<TileState, string> = {
  shipped: 'rgba(16,185,129,0.4)',
  default: 'rgba(59,130,246,0.4)',
  completed: 'rgba(34,197,94,0.4)',
  conflict: 'rgba(245,158,11,0.4)',
  late: 'rgba(239,68,68,0.4)',
  blocked: 'rgba(113,113,122,0.4)',
};

export function getStateGlowColor(state: TileState): string {
  return stateGlowColorMap[state];
}
