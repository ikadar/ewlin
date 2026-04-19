/**
 * TileSegment — A tile fragment with sawtooth edges for operator Gantt.
 *
 * When a task spans an operator's unavailability gap (lunch, shift end),
 * it's split into segments. Each segment has optional zigzag top/bottom edges
 * and a relay label ("→ pause" / "reprise →").
 */

import { getStateInlineColors, type TileState } from './colorUtils';
import type { PhaseSegment } from '@flux/types';
import { SAW_AMPLITUDE, TILE_BORDER_WIDTH_PX, buildSawtoothSvgPath, buildCssClipPath, computeTeethCount } from './sawtooth';

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
  /** Segment start wall-clock time (needed to project calage windows). */
  segFrom?: Date;
  /** Segment end wall-clock time. */
  segTo?: Date;
  /** Initial setup window of the parent task (wall-clock start + end). */
  setupWindow?: { start: Date; end: Date };
  /** Re-calage windows reported by the engine for the parent task. */
  recalages?: PhaseSegment[];
  /** Job id — drives the CSS selection ring via [data-job-id] selector (matches station view). */
  jobId?: string;
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
  segFrom,
  segTo,
  setupWindow,
  recalages,
  jobId,
}: TileSegmentProps) {
  const colors = getStateInlineColors(tileState);
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
      }}
      onClick={onClick}
      data-testid={`tile-segment-${segmentKey}`}
      data-job-id={jobId}
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
        className="absolute left-0 top-0 bottom-0"
        style={{
          width: `${TILE_BORDER_WIDTH_PX}px`,
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
            // Recalage bands must be at least 4 px tall so they're visible
            // even for a 1-tick (15 min at 64 px/h ≈ 16 px) re-setup zone.
            height: `${Math.max(ov.height, ov.kind === 'recalage' ? 4 : 2)}px`,
            // Only setup overlays get the tile's own bg color; recalage
            // overlays are left transparent so the CSS rule can paint them
            // fully red without competing with an inline background.
            ...(ov.kind === 'setup' ? { background: colors.bg } : {}),
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
