/**
 * ProgressFill — optimistic fond-vert overlay for tiles.
 *
 * Renders one absolutely-positioned div that fills the tile by `pct` percent
 * along the chosen axis. `isLate` flips the un-filled complement to red
 * (R1 of 2026-05-04 mindmap : "complément du fond vert vire rouge quand
 * la fin théorique est passée et le travail n'est pas terminé").
 *
 * Two layouts share the same component to keep the visual language uniform :
 *   - **vertical** (Tile, planning grid) : green eats from the TOP DOWN
 *     (Q6 — direction du temps, le passé en haut, le futur en bas).
 *   - **horizontal** (TaskTile, JDP sub-tile) : green eats from the LEFT
 *     (gauche → droite), aligned with the JDP's reading direction.
 *
 * The component is *purely* visual — it does no time math. The caller passes
 * `(pct, isLate)` derived from `computeOptimisticProgress(...)` (saisieMath.ts).
 *
 * Pointer-events are disabled so the fill never intercepts clicks meant
 * for the tile body (pin toggle, context menu, double-click pulse). The
 * fill sits behind the content overlay via z-index.
 */
import type { ReactElement } from 'react';

export interface ProgressFillProps {
  /** 0..100. Values outside the range are clamped by the renderer. */
  pct: number;
  /** When true the un-filled complement renders in red (R1 layout). */
  isLate: boolean;
  /** Fill axis. Vertical = planning tile, horizontal = JDP sub-tile. */
  direction: 'vertical' | 'horizontal';
}

const FILL_GREEN = 'rgba(34, 197, 94, 0.18)';     // tailwind green-500 @18%
const COMPLEMENT_RED = 'rgba(239, 68, 68, 0.16)'; // tailwind red-500 @16%

export function ProgressFill({ pct, isLate, direction }: ProgressFillProps): ReactElement {
  const clamped = Math.min(100, Math.max(0, pct));
  const fillSize = `${clamped}%`;
  const complementSize = `${100 - clamped}%`;

  const fillStyle: React.CSSProperties = direction === 'vertical'
    ? { top: 0, left: 0, right: 0, height: fillSize, backgroundColor: FILL_GREEN }
    : { top: 0, bottom: 0, left: 0, width: fillSize, backgroundColor: FILL_GREEN };

  const complementStyle: React.CSSProperties = direction === 'vertical'
    ? { bottom: 0, left: 0, right: 0, height: complementSize, backgroundColor: COMPLEMENT_RED }
    : { top: 0, bottom: 0, right: 0, width: complementSize, backgroundColor: COMPLEMENT_RED };

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      data-testid="progress-fill"
      data-pct={clamped.toFixed(1)}
      data-late={isLate ? 'true' : 'false'}
      data-direction={direction}
    >
      {clamped > 0 && (
        <div
          className="absolute"
          style={fillStyle}
          data-testid="progress-fill-green"
        />
      )}
      {isLate && clamped < 100 && (
        <div
          className="absolute"
          style={complementStyle}
          data-testid="progress-fill-red"
        />
      )}
    </div>
  );
}
