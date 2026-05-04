/**
 * TaskBadge — small bottom-right indicator showing what percentage of
 * the parent task this tile represents.
 *
 * Static between replans (Q10 of 2026-05-04 mindmap) :
 *   - Unsplit task (one tile per task) : 100%.
 *   - Chunk-split task (N activeWindows) : per-tile share, sums to 100%
 *     across all chunks. The FE derives per-window pct from window
 *     durations vs assignment total ; the engine emits taskSlotVolumePct
 *     at the assignment level (currently a constant 100 — chunk-split
 *     refinement happens here in the FE).
 *
 * Hidden when the value is exactly 100 on tiles that do NOT belong to a
 * chunk-split task (the "100% means the whole task" message is implicit
 * and would just be visual noise on every single tile). Chunk-split
 * tiles always show their value, including the rare case where one
 * chunk equals 100% (would imply degenerate split).
 */
import type { ReactElement } from 'react';

export interface TaskBadgeProps {
  /** 0..100. Display rounds to integer. Values outside the range are clamped. */
  pct: number;
  /** When true, show the badge even at 100% (chunk-split context). */
  forceShow?: boolean;
}

export function TaskBadge({ pct, forceShow = false }: TaskBadgeProps): ReactElement | null {
  const clamped = Math.min(100, Math.max(0, pct));
  const rounded = Math.round(clamped);

  // Hide trivial 100% on unsplit tasks — the absence of a split is the
  // signal, no need to repeat it on every tile.
  if (!forceShow && rounded === 100) return null;

  return (
    <span
      data-testid="task-badge"
      data-pct={rounded}
      className="absolute bottom-0.5 right-1 z-20 pointer-events-none
                 text-[9px] font-mono tabular-nums leading-none
                 px-1 py-0.5 rounded-[2px]
                 bg-zinc-900/55 text-zinc-200/85
                 border border-zinc-700/30"
    >
      {rounded}%
    </span>
  );
}
