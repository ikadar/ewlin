/**
 * State-based color utilities for tile visualization.
 * Color encodes tile state (late, conflict, blocked, completed, default)
 * rather than per-job decorative colors.
 */

export type TileState = 'late' | 'conflict' | 'blocked' | 'completed' | 'default';

export interface ColorClasses {
  border: string;
  setupBg: string;
  setupBorder: string;
  runBg: string;
  text: string;
}

/**
 * Compute tile state from boolean flags.
 * Priority (highest wins): late > conflict > blocked > completed > default.
 */
export function computeTileState(
  isLate: boolean,
  hasConflict: boolean,
  isBlocked: boolean,
  isCompleted: boolean,
): TileState {
  if (isLate) return 'late';
  if (hasConflict) return 'conflict';
  if (isBlocked) return 'blocked';
  if (isCompleted) return 'completed';
  return 'default';
}

const stateColorMap: Record<TileState, ColorClasses> = {
  default: {
    border: 'border-l-blue-500',
    setupBg: 'bg-blue-500/[0.14]',
    setupBorder: 'border-blue-400/20',
    runBg: 'bg-blue-500/[0.09]',
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
