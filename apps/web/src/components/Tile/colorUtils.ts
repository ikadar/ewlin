/**
 * State-based color utilities for tile visualization.
 * Color encodes tile state (late, conflict, blocked, completed, default)
 * rather than per-job decorative colors.
 *
 * All state-based colors derive from the single PALETTE + OPACITY source
 * of truth below. Adding a new state only requires updating those two
 * tables.
 */

export type TileState = 'shipped' | 'late' | 'conflict' | 'blocked' | 'completed' | 'default';

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
  allowDerived = true,
): boolean {
  if (isCompleted) return true;
  // Préprod (allowDerived=false) : a tile placed in the past is a
  // hypothesis, not real completion. Only the explicit flag counts.
  if (!allowDerived) return false;
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
// stroke); `textRgb` is the lighter tint used for text.
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

export interface InlineColors {
  bg: string;       // rgba(r,g,b, runOpacity) — main body fill
  setupBg: string;  // rgba(r,g,b, setupOpacity) — setup + re-calage band fill
  border: string;   // hex — left border + SVG sawtooth stroke
  text: string;     // hex — label color
}

/**
 * Get inline-style colors for a tile state. Single rendering path for
 * Tile, TileSegment, DragPreview, and any other tile-derived component.
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
