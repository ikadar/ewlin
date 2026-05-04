/**
 * TileSegment — A tile fragment with sawtooth edges for operator Gantt.
 *
 * When a task spans an operator's unavailability gap (lunch, shift end),
 * it's split into segments. Each segment has optional zigzag top/bottom edges
 * and a relay label ("→ pause" / "reprise →").
 */

import { Pin } from 'lucide-react';
import { ProgressFill } from './ProgressFill';
import { getStateInlineColors, type TileState } from './colorUtils';
import type { PhaseSegment } from '@flux/types';
import { SAW_AMPLITUDE, TILE_BORDER_WIDTH_PX, buildSawtoothSvgPath, buildCssClipPath, computeTeethCount } from './sawtooth';
import { useHoverCrosslink } from '../../hooks';

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
  /** Assignment id — needed to forward pin toggles through the parent handler. */
  assignmentId?: string;
  /** Current pinned state for this assignment (drives icon color + data attr). */
  isPinned?: boolean;
  /** Callback when the inline pin icon is clicked. Omit to render the segment read-only. */
  onTogglePin?: (assignmentId: string) => void;
  /** Task id — needed to key the safety override lookup + cascade FK on Rust payload. */
  taskId?: string;
  /** Whether this segment belongs to the currently selected job.
   *  Gates the JDP ↔ grid hover crosslink so only selected-job tiles pulse. */
  isSelected?: boolean;
  /** Station id on which this task is placed — part of the override tuple key. */
  stationId?: string;
  /** Flat sequence index inside the job (0-based) — part of the override tuple key. */
  sequenceIndex?: number;
  /** Whether this tile falls inside the current safety zone boundary. */
  inSafetyZone?: boolean;
  /** Whether the user has explicitly released this tile from the freeze. */
  isFrozenOverridden?: boolean;
  /** Callback when the Sky snowflake is clicked. Receives (jobId, sequenceIndex, stationId). */
  onToggleFrozenOverride?: (jobId: string, sequenceIndex: number, stationId: string) => void;
  /**
   * Right-click handler — fires with the mouse event so the parent can
   * read clientX/clientY for popover positioning. The parent typically
   * opens a TileContextMenu with the V2 affordances.
   */
  onContextMenu?: (e: React.MouseEvent) => void;
  /**
   * Optimistic fond-vert data (Q4-Q7 of 2026-05-04 mindmap). When
   * supplied, the segment renders a vertical top-down green fill driven
   * by `pct` ; the un-filled complement turns red when `isLate`. Parent
   * (FocusOperatorColumn / OperatorSchedulePage) computes the values via
   * `computeOptimisticProgress(...)` from saisieMath. Absent on tests
   * and on read-only callsites that don't surface progress.
   */
  progressFill?: { pct: number; isLate: boolean };
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
  assignmentId,
  isPinned,
  onTogglePin,
  taskId,
  stationId,
  sequenceIndex,
  inSafetyZone = false,
  isFrozenOverridden = false,
  isSelected = false,
  onToggleFrozenOverride,
  onContextMenu,
  progressFill,
}: TileSegmentProps) {
  // JDP ↔ operator grid crosslink — pulse fires on dblclick for the
  // selected-job segments only. Was a hover trigger; switched to dblclick
  // (explicit user intent, no accidental pulses while scanning).
  const crosslink = useHoverCrosslink(taskId);
  const handleDoubleClick = isSelected ? crosslink.onDoubleClick : undefined;
  // Safety zone visual integration mirrors Tile.tsx so both planning
  // surfaces (machine grid + operator grid) stay visually consistent.
  const isSafetyFrozen = inSafetyZone && !isFrozenOverridden;
  const safetyZoneClass = isSafetyFrozen
    ? 'safety-zone-frozen'
    : inSafetyZone && isFrozenOverridden
      ? 'safety-zone-overridden'
      : '';
  const canToggleFrozen =
    onToggleFrozenOverride !== undefined &&
    jobId !== undefined &&
    stationId !== undefined &&
    sequenceIndex !== undefined;
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
      className={`absolute cursor-pointer ${safetyZoneClass}`}
      style={{
        top: `${top + (sawtoothTop ? 0 : 1)}px`,
        height: `${totalHeight - (sawtoothTop ? 0 : 1) - (sawtoothBottom ? 0 : 1)}px`,
        left: overrideLeft ?? 0,
        width: overrideWidth ?? undefined,
        right: overrideWidth ? undefined : 0,
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      data-testid={`tile-segment-${segmentKey}`}
      data-job-id={jobId}
      data-pinned={isPinned ? 'true' : 'false'}
      data-safety-frozen={isSafetyFrozen ? 'true' : undefined}
      data-safety-overridden={inSafetyZone && isFrozenOverridden ? 'true' : undefined}
      data-flux-task-id={crosslink['data-flux-task-id']}
      onDoubleClick={handleDoubleClick}
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

      {/* Optimistic fond-vert overlay. Sits between the body bg and the
          calage overlays so progress shows under the calage band, but
          above the run base color. Hidden when the task is completed
          (state color carries the meaning) or no progress signal. */}
      {progressFill && (progressFill.pct > 0 || progressFill.isLate) && tileState !== 'completed' && tileState !== 'shipped' && (
        <ProgressFill
          pct={progressFill.pct}
          isLate={progressFill.isLate}
          direction="vertical"
        />
      )}

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
        <div className="flex items-baseline gap-1.5">
        <div className="text-[11px] font-medium leading-tight truncate flex-1 min-w-0" style={{ color: colors.text }}>
          {onTogglePin && assignmentId && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(assignmentId);
              }}
              className={`pin-toggle p-1 -m-1 rounded shrink-0 cursor-pointer inline-flex items-center align-middle mr-1 pointer-events-auto transition-colors hover:bg-white/5 ${
                isPinned
                  ? 'text-amber-500 hover:text-amber-400'
                  : 'text-zinc-700 hover:text-zinc-400'
              }`}
              title={isPinned ? 'Désépingler' : 'Épingler'}
            >
              <Pin className="w-3 h-3 shrink-0" />
            </span>
          )}
          {inSafetyZone && (
            <span
              onClick={canToggleFrozen ? (e) => {
                e.stopPropagation();
                onToggleFrozenOverride!(jobId!, sequenceIndex!, stationId!);
              } : undefined}
              className={`snowflake-icon p-1 -m-1 rounded shrink-0 inline-flex items-center align-middle mr-1 transition-colors ${
                canToggleFrozen ? 'pointer-events-auto cursor-pointer hover:bg-white/5' : 'pointer-events-none'
              } ${
                isFrozenOverridden
                  ? 'text-zinc-700 hover:text-zinc-400 opacity-60'
                  : 'text-sky-400 hover:text-sky-300'
              }`}
              aria-label={
                isFrozenOverridden
                  ? 'Override actif — clic pour restaurer le freeze auto'
                  : 'Frozen par safety zone' + (canToggleFrozen ? ' — clic pour libérer' : '')
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                data-testid="tile-segment-safety-flocon"
                className="w-3 h-3 shrink-0"
              >
                <path d="M12 2c.5 0 .9.4.9.9v3.3l2.3-2.3c.4-.4 1-.4 1.3 0 .4.4.4 1 0 1.3L12.9 8.9V11h2.2l3.6-3.6c.4-.4 1-.4 1.3 0 .4.4.4 1 0 1.3L17.7 11H21c.5 0 .9.4.9.9s-.4.9-.9.9h-3.3l2.3 2.3c.4.4.4 1 0 1.3-.4.4-1 .4-1.3 0L15.1 13h-2.2v2.2l3.6 3.6c.4.4.4 1 0 1.3-.4.4-1 .4-1.3 0l-2.3-2.3V21c0 .5-.4.9-.9.9s-.9-.4-.9-.9v-3.2l-2.3 2.3c-.4.4-1 .4-1.3 0-.4-.4-.4-1 0-1.3l3.6-3.6V13H9l-3.6 3.6c-.4.4-1 .4-1.3 0-.4-.4-.4-1 0-1.3L6.3 13H3c-.5 0-.9-.4-.9-.9s.4-.9.9-.9h3.3L4 8.9c-.4-.4-.4-1 0-1.3.4-.4 1-.4 1.3 0L9 11h2.1V8.8L7.4 5.2c-.4-.4-.4-1 0-1.3.4-.4 1-.4 1.3 0l2.3 2.3V2.9c0-.5.4-.9.9-.9z" />
              </svg>
            </span>
          )}
          {label}
        </div>
        {/* Relay-before label sits inline with the title in a flex row so
            narrow tiles truncate the title rather than letting the absolute
            label overlap the header text. The bottom relay label has no
            equivalent collision risk and stays absolutely positioned. */}
        {relayLabelTop && (
          <span className="text-[10px] font-semibold text-zinc-400 shrink-0">
            {relayLabelTop}
          </span>
        )}
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

    </div>
  );
}
