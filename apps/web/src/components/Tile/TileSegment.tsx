/**
 * TileSegment — A tile fragment with sawtooth edges for operator Gantt.
 *
 * When a task spans an operator's unavailability gap (lunch, shift end),
 * it's split into segments. Each segment has optional zigzag top/bottom edges
 * and a relay label ("→ pause" / "reprise →").
 */

import { Circle, CircleCheck, Pin } from 'lucide-react';
import type { TileState } from './colorUtils';
import { getStateRgb } from './colorUtils';
import type { PhaseSegment } from '@flux/types';
import { SAW_AMPLITUDE, buildSawtoothSvgPath, buildCssClipPath, computeTeethCount } from './sawtooth';

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
  /** Whether this segment is masked time */
  isMaskedTime?: boolean;
  /** Override left position for side-by-side layout */
  overrideLeft?: string;
  /** Override width for side-by-side layout */
  overrideWidth?: string;
  /** Click handler */
  onClick?: () => void;
  /** Parent assignment id (needed to wire pin/complete actions). */
  assignmentId?: string;
  /** Whether the parent assignment is pinned (for tab icon state). */
  isPinned?: boolean;
  /** Whether the parent assignment is completed (for tab icon state). */
  isCompleted?: boolean;
  /** Callback when completion icon is clicked in the folder tab. */
  onToggleComplete?: (assignmentId: string) => void;
  /** Callback when pin icon is clicked in the folder tab. */
  onTogglePin?: (assignmentId: string) => void;
  /** Segment start wall-clock time (needed to project calage windows). */
  segFrom?: Date;
  /** Segment end wall-clock time. */
  segTo?: Date;
  /** Initial setup window of the parent task (wall-clock start + end). */
  setupWindow?: { start: Date; end: Date };
  /** Re-calage windows reported by the engine for the parent task. */
  recalages?: PhaseSegment[];
}

/**
 * Intersect [aStart, aEnd] with [bStart, bEnd]. Returns the overlap or null.
 */
function intersect(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): { start: Date; end: Date } | null {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  return end > start ? { start, end } : null;
}

/**
 * Project a wall-clock window onto segment pixel coordinates.
 * Returns {top, height} within the segment body (above the eventual
 * sawtooth extension, caller adds extTop).
 */
function projectWindow(
  win: { start: Date; end: Date },
  segFrom: Date,
  segHeight: number,
  segMs: number,
): { top: number; height: number } {
  const offsetMs = win.start.getTime() - segFrom.getTime();
  const durMs = win.end.getTime() - win.start.getTime();
  const top = (offsetMs / segMs) * segHeight;
  const height = (durMs / segMs) * segHeight;
  return { top, height };
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
  isMaskedTime,
  overrideLeft,
  overrideWidth,
  onClick,
  assignmentId,
  isPinned = false,
  isCompleted = false,
  onToggleComplete,
  onTogglePin,
  segFrom,
  segTo,
  setupWindow,
  recalages,
}: TileSegmentProps) {
  const colors = STATE_COLORS[tileState] || STATE_COLORS.default;
  const stateRgb = getStateRgb(tileState);
  // Folder-tab is shown on every segment that has an assignment id, including
  // relay/reprise segments (sawtoothTop = true). With inward teeth the tab no
  // longer protrudes past the segment's body top (original rationale for
  // gating on !sawtoothTop), and hiding it would otherwise make completion/pin
  // actions unreachable on any segment that isn't the first one of a split.
  const showFolderTab =
    !!assignmentId && (onTogglePin !== undefined || onToggleComplete !== undefined);

  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (assignmentId) onToggleComplete?.(assignmentId);
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (assignmentId) onTogglePin?.(assignmentId);
  };
  const extTop = sawtoothTop ? SAW_AMPLITUDE : 0;
  const extBottom = sawtoothBottom ? SAW_AMPLITUDE : 0;
  // Teeth are rendered INWARD: the rendered box matches the segment's time
  // span exactly so adjacent tiles never overlap, and the clip-path eats the
  // tooth zone out of the body. Content/overlays get offset by extTop/extBottom
  // to stay clear of the tooth area.
  const totalHeight = height;
  const contentTop = extTop + 2;
  const contentBottom = extBottom + 2;
  const teethCount = computeTeethCount(width);

  // Compute calage-phase overlays: setup section + any re-calage sections
  // that intersect this segment. Each gets its pixel footprint within the
  // segment body (above the sawtooth extension).
  const calageOverlays: Array<{ key: string; kind: 'setup' | 'recalage'; top: number; height: number }> = [];
  if (segFrom && segTo && height > 0) {
    const segMs = segTo.getTime() - segFrom.getTime();
    if (segMs > 0) {
      if (setupWindow) {
        const inter = intersect(segFrom, segTo, setupWindow.start, setupWindow.end);
        if (inter) {
          const p = projectWindow(inter, segFrom, height, segMs);
          calageOverlays.push({ key: 'setup', kind: 'setup', top: p.top, height: p.height });
        }
      }
      (recalages ?? []).forEach((rc, idx) => {
        const rcStart = new Date(rc.start);
        const rcEnd = new Date(rc.end);
        const inter = intersect(segFrom, segTo, rcStart, rcEnd);
        if (inter) {
          const p = projectWindow(inter, segFrom, height, segMs);
          calageOverlays.push({ key: `recalage-${idx}`, kind: 'recalage', top: p.top, height: p.height });
        }
      });
    }
  }

  return (
    <div
      className="absolute cursor-pointer"
      style={{
        top: `${top + (sawtoothTop ? 0 : 1)}px`,
        height: `${totalHeight - (sawtoothTop ? 0 : 1) - (sawtoothBottom ? 0 : 1)}px`,
        left: overrideLeft ?? 0,
        width: overrideWidth ?? undefined,
        right: overrideWidth ? undefined : 0,
        // Publish state color tokens so the folder tab CSS can render
        // matching background/border/text without re-declaring the palette.
        ['--tile-rgb' as string]: stateRgb.tile,
        ['--tile-border-rgb' as string]: stateRgb.border,
        ['--tile-text-rgb' as string]: stateRgb.text,
      }}
      onClick={onClick}
      data-testid={`tile-segment-${segmentKey}`}
      data-pinned={isPinned ? 'true' : 'false'}
    >
      {/* Background + left border, clipped by CSS polygon */}
      <div
        className="absolute inset-0"
        style={{
          background: colors.bg,
          clipPath: buildCssClipPath(totalHeight, sawtoothTop, sawtoothBottom, teethCount),
          borderRadius: (!sawtoothTop && !sawtoothBottom) ? '2px' : undefined,
        }}
      />
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{
          background: colors.border,
          clipPath: buildCssClipPath(totalHeight, sawtoothTop, sawtoothBottom, teethCount),
        }}
      />

      {/* Calage phase overlays (initial setup + post-peremption re-calages).
          Same CSS rule applies to both via data-testid in index.css:
          1px dashed red border-bottom. */}
      {calageOverlays.map((ov) => (
        <div
          key={ov.key}
          className="absolute left-0 right-0"
          style={{
            top: `${ov.top}px`,
            height: `${Math.max(ov.height, 2)}px`,
            background: colors.bg,
          }}
          data-testid={ov.kind === 'setup' ? 'tile-setup-section' : 'tile-recalage-section'}
        />
      ))}

      {/* SVG zigzag stroke lines — visible teeth at sawtooth edges */}
      {(sawtoothTop || sawtoothBottom) && (
        <svg
          className="absolute inset-0 pointer-events-none"
          width={width}
          height={totalHeight}
          viewBox={`0 0 ${width} ${totalHeight}`}
          preserveAspectRatio="none"
        >
          {sawtoothTop && (
            <path
              d={buildSawtoothSvgPath(width, 0, 'top', teethCount)}
              fill="none"
              stroke={colors.border}
              strokeWidth={1.5}
              strokeOpacity={0.7}
            />
          )}
          {sawtoothBottom && (
            <path
              d={buildSawtoothSvgPath(width, totalHeight, 'bottom', teethCount)}
              fill="none"
              stroke={colors.border}
              strokeWidth={1.5}
              strokeOpacity={0.7}
            />
          )}
        </svg>
      )}

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

      {/* Folder tab (hover-only): completion + pin actions. Only rendered
          on the top segment of an assignment (no sawtoothTop) so the tab
          doesn't stick up into the segment above. */}
      {showFolderTab && (
        <div className="folder-tab">
          <button
            onClick={handleToggleComplete}
            title={isCompleted ? 'Marquer non complété' : 'Marquer complété'}
            data-testid="tile-tab-complete"
          >
            {isCompleted ? (
              <CircleCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <Circle className="w-4 h-4" style={{ color: `rgb(${stateRgb.text})` }} />
            )}
          </button>
          <button
            onClick={handleTogglePin}
            title={isPinned ? 'Désépingler' : 'Épingler'}
            data-testid="tile-tab-pin"
          >
            <Pin
              className="w-3 h-3"
              style={{ color: isPinned ? '#f59e0b' : `rgb(${stateRgb.text})` }}
            />
          </button>
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
