/**
 * TileSegment — A tile fragment with sawtooth edges for operator Gantt.
 *
 * When a task spans an operator's unavailability gap (lunch, shift end),
 * it's split into segments. Each segment has optional zigzag top/bottom edges
 * and a relay label ("→ pause" / "reprise →").
 */

import type { TileState } from './colorUtils';

const SAW_AMPLITUDE = 10;
const SAW_TEETH = 13;

// State → colors for SVG.
const STATE_COLORS: Record<TileState, { bg: string; border: string; text: string }> = {
  default:   { bg: 'rgba(59,130,246,0.22)', border: '#3b82f6', text: '#93c5fd' },
  completed: { bg: 'rgba(34,197,94,0.22)',  border: '#22c55e', text: '#86efac' },
  late:      { bg: 'rgba(239,68,68,0.22)',  border: '#ef4444', text: '#fca5a5' },
  conflict:  { bg: 'rgba(245,158,11,0.22)', border: '#f59e0b', text: '#fcd34d' },
  blocked:   { bg: 'rgba(113,113,122,0.15)', border: '#71717a', text: '#a1a1aa' },
  shipped:   { bg: 'rgba(16,185,129,0.22)', border: '#10b981', text: '#6ee7b7' },
};

interface TileSegmentProps {
  /** Unique key for this segment */
  segmentKey: string;
  /** Job reference + client label */
  label: string;
  /** Station name shown below label */
  stationName?: string;
  /** Y position in pixels */
  top: number;
  /** Segment height in pixels */
  height: number;
  /** Width of the column (for SVG clip path) */
  width: number;
  /** Zigzag on top edge */
  sawtoothTop: boolean;
  /** Zigzag on bottom edge */
  sawtoothBottom: boolean;
  /** Relay label at bottom (e.g., "→ pause") */
  relayLabelBottom?: string;
  /** Relay label at top (e.g., "reprise →") */
  relayLabelTop?: string;
  /** Tile color state */
  tileState: TileState;
  /** Operator attention value for badge */
  operatorAttention?: number;
  /** Whether this segment is masked time */
  isMaskedTime?: boolean;
  /** Override left position for side-by-side layout */
  overrideLeft?: string;
  /** Override width for side-by-side layout */
  overrideWidth?: string;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Build a CSS clip-path polygon() string.
 * X coordinates use percentages (responsive to container width).
 * Y coordinates use pixels (fixed tooth height).
 */
function buildCssClipPath(h: number, sawTop: boolean, sawBottom: boolean): string | undefined {
  if (!sawTop && !sawBottom) return undefined;

  const amp = SAW_AMPLITUDE;
  const teeth = SAW_TEETH;
  const stepPct = 100 / teeth;
  const points: string[] = [];

  // Top edge (left to right)
  if (sawTop) {
    for (let i = 0; i < teeth; i++) {
      points.push(`${(i * stepPct).toFixed(2)}% ${amp}px`);
      points.push(`${(i * stepPct + stepPct / 2).toFixed(2)}% 0px`);
      points.push(`${((i + 1) * stepPct).toFixed(2)}% ${amp}px`);
    }
  } else {
    points.push('0% 0px', '100% 0px');
  }

  // Bottom edge (right to left)
  if (sawBottom) {
    points.push(`100% ${h - amp}px`);
    for (let i = teeth - 1; i >= 0; i--) {
      points.push(`${(i * stepPct + stepPct / 2).toFixed(2)}% ${h}px`);
      points.push(`${(i * stepPct).toFixed(2)}% ${h - amp}px`);
    }
  } else {
    points.push(`100% ${h}px`, `0% ${h}px`);
  }

  return `polygon(${points.join(', ')})`;
}

export function TileSegment({
  segmentKey,
  label,
  stationName,
  top,
  height,
  width,
  sawtoothTop,
  sawtoothBottom,
  relayLabelBottom,
  relayLabelTop,
  tileState = 'default',
  operatorAttention,
  isMaskedTime,
  overrideLeft,
  overrideWidth,
  onClick,
}: TileSegmentProps) {
  const colors = STATE_COLORS[tileState] || STATE_COLORS.default;
  const extTop = sawtoothTop ? SAW_AMPLITUDE : 0;
  const extBottom = sawtoothBottom ? SAW_AMPLITUDE : 0;
  const totalHeight = height + extTop + extBottom;
  const contentTop = extTop + 2;
  const contentBottom = extBottom + 2;

  return (
    <div
      className="absolute cursor-pointer"
      style={{
        top: `${top - extTop + (sawtoothTop ? 0 : 1)}px`,
        height: `${totalHeight - (sawtoothTop ? 0 : 1) - (sawtoothBottom ? 0 : 1)}px`,
        left: overrideLeft ?? 0,
        width: overrideWidth ?? undefined,
        right: overrideWidth ? undefined : 0,
      }}
      onClick={onClick}
      data-testid={`tile-segment-${segmentKey}`}
    >
      {/* Background + left border, clipped by CSS polygon */}
      <div
        className="absolute inset-0"
        style={{
          background: colors.bg,
          clipPath: buildCssClipPath(totalHeight, sawtoothTop, sawtoothBottom),
          borderRadius: (!sawtoothTop && !sawtoothBottom) ? '2px' : undefined,
        }}
      />
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{
          background: colors.border,
          clipPath: buildCssClipPath(totalHeight, sawtoothTop, sawtoothBottom),
        }}
      />

      {/* Content overlay */}
      <div
        className="absolute left-0 right-0 px-2 overflow-hidden pointer-events-none"
        style={{ top: `${contentTop}px`, bottom: `${contentBottom}px` }}
      >
        <div className="text-[11px] font-medium leading-tight truncate" style={{ color: colors.text }}>
          {label}
        </div>
        {stationName && (
          <div className="text-[9px] text-zinc-400 truncate leading-tight mt-0.5">
            {stationName}
          </div>
        )}
      </div>

      {/* Attention badge — only on segments without sawtooth bottom (last segment) */}
      {operatorAttention !== undefined && !sawtoothBottom && (
        <div
          className="absolute right-1 z-10 text-[8px] font-semibold text-zinc-200 bg-zinc-800 border border-zinc-600 rounded-sm px-1.5 py-px leading-tight pointer-events-none"
          style={{ bottom: `${contentBottom + 1}px` }}
        >
          {operatorAttention}
        </div>
      )}

      {/* Relay labels */}
      {relayLabelBottom && (
        <div
          className="absolute right-1.5 text-[10px] font-semibold text-zinc-400 pointer-events-none"
          style={{ bottom: `${(sawtoothBottom ? SAW_AMPLITUDE : 0) + 1}px` }}
        >
          {relayLabelBottom}
        </div>
      )}
      {relayLabelTop && (
        <div
          className="absolute right-1.5 text-[10px] font-semibold text-zinc-400 pointer-events-none"
          style={{ top: `${(sawtoothTop ? SAW_AMPLITUDE : 0) + 1}px` }}
        >
          {relayLabelTop}
        </div>
      )}
    </div>
  );
}
