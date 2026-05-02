/**
 * State-based color utilities for tile visualization.
 * Color encodes tile state (late, conflict, blocked, completed, default)
 * rather than per-job decorative colors.
 *
 * All state-based colors (Tailwind classes, rgb triplets, rgba inline
 * styles, hex) derive from the single PALETTE + OPACITY source of truth
 * below. Adding a new state only requires updating those two tables and
 * the Tailwind `stateColorMap` (the latter can't be derived because
 * Tailwind demands literal class names at author time).
 */

export type TileState = 'shipped' | 'late' | 'conflict' | 'blocked' | 'completed' | 'default';

export interface ColorClasses {
  border: string;
  runBg: string;
  text: string;
}

/**
 * Derived completion. A tile whose `scheduledEnd` is past `now` is considered
 * completed even without the explicit `isCompleted` flag, per the
 * "no-news = good-news" rule (cf. progress-capture-design.md § 6).
 * Callsite-agnostic so it can be used from Tile, JDP, etc.
 */
export function isCompletedEffective(
  isCompleted: boolean,
  scheduledEndIso: string,
  nowMs: number,
): boolean {
  if (isCompleted) return true;
  return new Date(scheduledEndIso).getTime() < nowMs;
}

/**
 * Compute tile state from boolean flags.
 *
 * Priority (highest wins): shipped > completed > late > conflict > blocked > default.
 *
 * Why `completed` outranks `late`/`conflict`/`blocked`: those three are
 * warnings about work that still needs to happen — they're moot once the
 * tile is reported done. A done tile must read as green so operators
 * see "this one is fine, move on" instead of a stale red flag.
 * `shipped` still wins because physical shipment is a stronger terminal
 * state than completion.
 */
export function computeTileState(
  isShipped: boolean,
  isLate: boolean,
  hasConflict: boolean,
  isBlocked: boolean,
  isCompleted: boolean,
): TileState {
  if (isShipped) return 'shipped';
  if (isCompleted) return 'completed';
  if (isLate) return 'late';
  if (hasConflict) return 'conflict';
  if (isBlocked) return 'blocked';
  return 'default';
}

// Canonical palette per state. `rgb` is the main triplet (tile fill + border
// stroke); `textRgb` is the lighter tint used for text. Hex values match the
// Tailwind palette so `stateColorMap` classes below stay visually consistent.
const PALETTE: Record<TileState, {
  rgb: string;
  textRgb: string;
  borderHex: string;
  textHex: string;
}> = {
  shipped:   { rgb: '16,185,129',  textRgb: '110,231,183', borderHex: '#10b981', textHex: '#6ee7b7' },
  default:   { rgb: '59,130,246',  textRgb: '147,197,253', borderHex: '#3b82f6', textHex: '#93c5fd' },
  completed: { rgb: '34,197,94',   textRgb: '134,239,172', borderHex: '#22c55e', textHex: '#86efac' },
  conflict:  { rgb: '245,158,11',  textRgb: '252,211,77',  borderHex: '#f59e0b', textHex: '#fcd34d' },
  late:      { rgb: '239,68,68',   textRgb: '252,165,165', borderHex: '#ef4444', textHex: '#fca5a5' },
  blocked:   { rgb: '113,113,122', textRgb: '161,161,170', borderHex: '#71717a', textHex: '#a1a1aa' },
};

// Per-state opacities for tile body backgrounds. `run` fills the main tile;
// `setup` fills the initial-setup + re-calage bands (slightly more opaque so
// those zones stand out without needing a separate color).
const OPACITY: Record<TileState, { run: number; setup: number }> = {
  shipped:   { run: 0.09, setup: 0.14 },
  default:   { run: 0.12, setup: 0.12 },
  completed: { run: 0.09, setup: 0.14 },
  conflict:  { run: 0.09, setup: 0.14 },
  late:      { run: 0.09, setup: 0.14 },
  blocked:   { run: 0.06, setup: 0.10 },
};

/** All valid tile states, derived from PALETTE so it stays in sync. */
export const ALL_TILE_STATES = Object.keys(PALETTE) as TileState[];

const stateColorMap: Record<TileState, ColorClasses> = {
  shipped: {
    border: 'border-l-emerald-500',
    runBg: 'bg-emerald-500/[0.09]',
    text: 'text-emerald-300',
  },
  default: {
    border: 'border-l-blue-500',
    runBg: 'bg-blue-500/[0.12]',
    text: 'text-blue-300',
  },
  completed: {
    border: 'border-l-green-500',
    runBg: 'bg-green-500/[0.09]',
    text: 'text-green-300',
  },
  conflict: {
    border: 'border-l-amber-500',
    runBg: 'bg-amber-500/[0.09]',
    text: 'text-amber-300',
  },
  late: {
    border: 'border-l-red-500',
    runBg: 'bg-red-500/[0.09]',
    text: 'text-red-300',
  },
  blocked: {
    border: 'border-l-zinc-500',
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

export interface InlineColors {
  bg: string;       // rgba(r,g,b, runOpacity) — main body fill
  setupBg: string;  // rgba(r,g,b, setupOpacity) — setup + re-calage band fill
  border: string;   // hex — left border + SVG sawtooth stroke
  text: string;     // hex — label color
}

/**
 * Get inline-style colors for tile fragments that can't use Tailwind classes
 * (e.g. TileSegment, whose clip-path demands explicit rgba backgrounds).
 */
export function getStateInlineColors(state: TileState): InlineColors {
  const p = PALETTE[state];
  const o = OPACITY[state];
  return {
    bg:      `rgba(${p.rgb},${o.run})`,
    setupBg: `rgba(${p.rgb},${o.setup})`,
    border:  p.borderHex,
    text:    p.textHex,
  };
}

/**
 * Raw RGB triplets per state. Used as "r,g,b" strings to plug into
 * `rgb(...)` / `rgba(...)` — consumed by Tile/TileSegment SVG sawtooth
 * strokes and by the minimap palette.
 */
const stateRgbMap: Record<TileState, { tile: string; border: string; text: string }> = Object.fromEntries(
  ALL_TILE_STATES.map((s) => [
    s,
    { tile: PALETTE[s].rgb, border: PALETTE[s].rgb, text: PALETTE[s].textRgb },
  ]),
) as Record<TileState, { tile: string; border: string; text: string }>;

export function getStateRgb(state: TileState): { tile: string; border: string; text: string } {
  return stateRgbMap[state];
}
