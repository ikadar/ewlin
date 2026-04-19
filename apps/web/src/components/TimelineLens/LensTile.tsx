import { memo } from 'react';
import { getStateInlineColors, type TileState } from '../Tile/colorUtils';
import { LENS_LEFT_GUTTER } from './lensConfig';

export interface LensTileProps {
  startMs: number;
  endMs: number;
  setupMinutes?: number;
  gridStartMs: number;
  pixelsPerHour: number;
  state: TileState;
  title: string;
  subtitle?: string;
}

/**
 * Minimal, read-only tile visual used INSIDE the lens. Matches Tile.tsx colors
 * (shared PALETTE via getStateInlineColors) but skips all interactivity —
 * drag, selection, context menu, tooltip — since the lens is a scan surface.
 */
export const LensTile = memo(function LensTile({
  startMs, endMs, setupMinutes = 0, gridStartMs, pixelsPerHour,
  state, title, subtitle,
}: LensTileProps) {
  const topPx = ((startMs - gridStartMs) / 3_600_000) * pixelsPerHour;
  const heightPx = Math.max(1, ((endMs - startMs) / 3_600_000) * pixelsPerHour);
  const setupPx = setupMinutes > 0 ? (setupMinutes / 60) * pixelsPerHour : 0;
  const colors = getStateInlineColors(state);

  return (
    // +1 / -2 matches the inset Tile.tsx applies so consecutive tiles show a
    // 1 px hairline gap in the lens too, instead of merging into one block.
    <div
      style={{
        position: 'absolute',
        top: `${topPx + 1}px`,
        left: `${LENS_LEFT_GUTTER}px`,
        right: '4px',
        height: `${Math.max(1, heightPx - 2)}px`,
        background: colors.bg,
        borderLeft: `4px solid ${colors.border}`,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08), inset 0 -1px 2px rgba(0,0,0,0.04)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}
    >
      {setupPx > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 0, right: 0, top: 0,
            height: `${setupPx}px`,
            borderBottom: '1px dotted black',
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
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
    </div>
  );
});
