import { memo } from 'react';
import { getStateInlineColors, getStateRgb, type TileState } from '../Tile/colorUtils';
import {
  SAW_AMPLITUDE, TILE_BORDER_WIDTH_PX,
  buildCssClipPath, buildSawtoothSvgPath, computeTeethCount,
} from '../Tile/sawtooth';
import { LENS_LEFT_GUTTER, LENS_WIDTH } from './lensConfig';

const LENS_TILE_RIGHT_PADDING = 4;
// Effective inner width of a lens tile. Stable across renders (lens width
// and gutter are constants), so we can feed it to computeTeethCount without
// measuring the DOM.
const LENS_TILE_INNER_WIDTH = LENS_WIDTH - LENS_LEFT_GUTTER - LENS_TILE_RIGHT_PADDING;

export interface LensTileProps {
  startMs: number;
  endMs: number;
  setupMinutes?: number;
  gridStartMs: number;
  pixelsPerHour: number;
  state: TileState;
  title: string;
  subtitle?: string;
  /** Tile continues earlier in time → render top sawtooth teeth. */
  sawtoothTop?: boolean;
  /** Tile continues later in time → render bottom sawtooth teeth. */
  sawtoothBottom?: boolean;
  /** Small label at the top-right (operator view) — e.g. "← 12 min". */
  relayLabelTop?: string;
  /** Small label at the bottom-right — e.g. "→ 8 min". */
  relayLabelBottom?: string;
}

/**
 * Minimal, read-only tile visual used INSIDE the lens. Mirrors Tile.tsx's
 * two-layer structure: a clipped body (background + left border + setup
 * divider, clip-path'd for sawtooth teeth) and a label overlay OUTSIDE the
 * clip (pushed inward by extTop/extBottom so text never sits under the
 * teeth zone). Relay labels are siblings of both, positioned against the
 * tile's outer edges.
 */
export const LensTile = memo(function LensTile({
  startMs, endMs, setupMinutes = 0, gridStartMs, pixelsPerHour,
  state, title, subtitle,
  sawtoothTop = false, sawtoothBottom = false,
  relayLabelTop, relayLabelBottom,
}: LensTileProps) {
  const topPx = ((startMs - gridStartMs) / 3_600_000) * pixelsPerHour;
  const rawHeight = Math.max(1, ((endMs - startMs) / 3_600_000) * pixelsPerHour);

  // 1 px gap between consecutive tiles only when the edge is a clean cut.
  // Sawtooth edges have teeth that should touch the neighbor, so no inset
  // on that side.
  const topInset = sawtoothTop ? 0 : 1;
  const bottomInset = sawtoothBottom ? 0 : 1;
  const heightPx = Math.max(1, rawHeight - topInset - bottomInset);

  const setupPx = setupMinutes > 0 ? (setupMinutes / 60) * pixelsPerHour : 0;
  const colors = getStateInlineColors(state);

  const teethCount = computeTeethCount(LENS_TILE_INNER_WIDTH);
  // Match Tile.tsx exactly: clip-path + SVG both keyed on the raw (un-insetted)
  // height. The outer box is slightly smaller (`heightPx`) thanks to the 1 px
  // inset on non-sawtooth edges, but the teeth geometry must extend to the
  // full span so the SVG stroke aligns with the clip-path boundary.
  const clipPath = buildCssClipPath(rawHeight, sawtoothTop, sawtoothBottom, teethCount);
  const stateRgb = getStateRgb(state);
  const hasSaw = sawtoothTop || sawtoothBottom;

  // Label/content offsets so the label never sits inside the teeth zone.
  const extTop = sawtoothTop ? SAW_AMPLITUDE : 0;
  const extBottom = sawtoothBottom ? SAW_AMPLITUDE : 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: `${topPx + topInset}px`,
        left: `${LENS_LEFT_GUTTER}px`,
        right: `${LENS_TILE_RIGHT_PADDING}px`,
        height: `${heightPx}px`,
      }}
    >
      {/* Clipped body — background + left border + setup divider. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: colors.bg,
          borderLeft: `${TILE_BORDER_WIDTH_PX}px solid ${colors.border}`,
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08), inset 0 -1px 2px rgba(0,0,0,0.04)',
          borderRadius: '2px',
          clipPath,
          overflow: 'hidden',
        }}
      >
        {setupPx > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 0, right: 0,
              top: 0,
              height: `${setupPx}px`,
              borderBottom: '1px dotted black',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Zigzag stroke outlining the teeth — identical to Tile.tsx:
            SVG height + viewBox use the raw (un-insetted) height so the
            stroke aligns with the clip-path. */}
        {hasSaw && (
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
            }}
            width="100%"
            height={rawHeight}
            viewBox={`0 0 100 ${rawHeight}`}
            preserveAspectRatio="none"
          >
            {sawtoothTop && (
              <path
                d={buildSawtoothSvgPath(100, 0, 'top', teethCount)}
                fill="none"
                stroke={`rgb(${stateRgb.border})`}
                strokeWidth={1.5}
                strokeOpacity={0.7}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {sawtoothBottom && (
              <path
                d={buildSawtoothSvgPath(100, rawHeight, 'bottom', teethCount)}
                fill="none"
                stroke={`rgb(${stateRgb.border})`}
                strokeWidth={1.5}
                strokeOpacity={0.7}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        )}
      </div>

      {/* Label overlay — outside the clip, pushed in by teeth amplitude. */}
      <div
        style={{
          position: 'absolute',
          left: 0, right: 0,
          top: `${extTop}px`,
          bottom: `${extBottom}px`,
          padding: '2px 8px 0 8px',
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: 2,
        }}
      >
        <div
          style={{
            color: colors.text,
            fontSize: '11px',
            fontWeight: 500,
            lineHeight: 1.2,
            wordBreak: 'break-word',
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: '9px',
              color: '#a1a1aa',
              marginTop: '1px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.2,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {relayLabelTop && (
        <div
          style={{
            position: 'absolute',
            right: '6px',
            top: `${extTop + 1}px`,
            fontSize: '10px',
            fontWeight: 600,
            color: '#a1a1aa',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        >
          {relayLabelTop}
        </div>
      )}
      {relayLabelBottom && (
        <div
          style={{
            position: 'absolute',
            right: '6px',
            bottom: `${extBottom + 1}px`,
            fontSize: '10px',
            fontWeight: 600,
            color: '#a1a1aa',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        >
          {relayLabelBottom}
        </div>
      )}
    </div>
  );
});
