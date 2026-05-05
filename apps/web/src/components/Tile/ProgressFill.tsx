/**
 * ProgressFill — fond-vert + helpers for partial-progress tile rendering.
 *
 * The visual strategy is a SINGLE linear-gradient that REPLACES the tile's
 * body bg (and optionally its left border) rather than overlaying a
 * translucent green on top of the existing rgba(blue) bg. Stacking two
 * rgbas would compound their opacity and break visual identity with the
 * fully-completed state. With a gradient-as-replacement, the top portion
 * carries exactly `rgba(34,197,94, 0.09)` (the completed run-bg) on the
 * page bg — pixel-perfect match with a fully-green tile.
 *
 * `isLate` swaps the un-filled complement to red (R1 of 2026-05-04
 * mindmap : "complément du fond vert vire rouge quand la fin théorique
 * est passée et le travail n'est pas terminé").
 *
 * Direction :
 *   - **vertical** (Tile, planning grid) : green eats from the TOP DOWN
 *     (Q6 — direction du temps, le passé en haut, le futur en bas).
 *   - **horizontal** (TaskTile, JDP sub-tile) : green eats from the LEFT
 *     (gauche → droite).
 *
 * Helpers :
 *   - `computeProgressBgGradient(...)` — returns the `background` CSS value
 *     to inline on the body wrapper.
 *   - `computeProgressBorderImage(...)` — returns a `border-image` CSS
 *     value so the left border tracks the gradient.
 *   - `<ProgressFill />` — back-compat thin wrapper that renders a tagged
 *     div ; kept so Playwright tests can detect "progress is rendered"
 *     without rebuilding around the new inline-gradient approach.
 */
import type { ReactElement } from 'react';

export interface ProgressFillProps {
  /** 0..100. Values outside the range are clamped by the renderer. */
  pct: number;
  /** When true the un-filled complement renders in red (R1 layout). */
  isLate: boolean;
  /** Fill axis. Vertical = planning tile, horizontal = JDP sub-tile. */
  direction: 'vertical' | 'horizontal';
  /**
   * Tile state's background rgba — matches `getStateInlineColors(state).bg`.
   * Used for the un-filled complement so the bottom portion of a partially
   * progressed tile is visually indistinguishable from a fully-default tile.
   */
  baseBg: string;
}

/** Completed-state run-bg, mirrors `getStateInlineColors('completed').bg`. */
export const COMPLETED_RUN_BG = 'rgba(34, 197, 94, 0.09)';
/** Completed-state border, mirrors `getStateInlineColors('completed').border`. */
export const COMPLETED_BORDER = '#22c55e';
/** Late-state run-bg, mirrors `getStateInlineColors('late').bg`. */
export const LATE_RUN_BG = 'rgba(239, 68, 68, 0.09)';
/** Late-state border, mirrors `getStateInlineColors('late').border`. */
export const LATE_BORDER = '#ef4444';

/**
 * Build the `background` value for a tile's body wrapper that has
 * partial progress. The result is a single linear-gradient — apply it
 * inline on the body element, leaving the Tailwind runBg class off (or
 * letting inline win over the class).
 */
export function computeProgressBgGradient(
  pct: number,
  isLate: boolean,
  direction: 'vertical' | 'horizontal',
  baseBg: string,
): string {
  const clamped = Math.min(100, Math.max(0, pct));
  const complementBg = isLate ? LATE_RUN_BG : baseBg;
  const axis = direction === 'vertical' ? 'to bottom' : 'to right';
  return `linear-gradient(${axis},
    ${COMPLETED_RUN_BG} 0%,
    ${COMPLETED_RUN_BG} ${clamped}%,
    ${complementBg} ${clamped}%,
    ${complementBg} 100%)`;
}

/**
 * Build the `borderImage` value so the left-border color tracks the
 * gradient. Caller must ensure `borderStyle: solid` is set ; pair with
 * `border-image-slice: 1` (included in the returned string).
 */
export function computeProgressBorderImage(
  pct: number,
  isLate: boolean,
  direction: 'vertical' | 'horizontal',
  baseBorder: string,
): string {
  const clamped = Math.min(100, Math.max(0, pct));
  const complementBorder = isLate ? LATE_BORDER : baseBorder;
  const axis = direction === 'vertical' ? 'to bottom' : 'to right';
  return `linear-gradient(${axis},
    ${COMPLETED_BORDER} 0%,
    ${COMPLETED_BORDER} ${clamped}%,
    ${complementBorder} ${clamped}%,
    ${complementBorder} 100%) 1`;
}

/**
 * Back-compat marker component. Renders a no-pointer-events tagged div
 * that carries `data-progress-pct` and `data-late` so Playwright + dev
 * tools can detect that progress is being rendered on the parent tile.
 * Visually inert : the actual fond-vert is now painted by the parent
 * via inline `background: linear-gradient(...)`.
 *
 * Kept so the existing Playwright `task-badge-rendering` and
 * `fond-vert-rendering` selectors keep working through the visual
 * refactor.
 */
export function ProgressFill({
  pct,
  isLate,
  direction,
}: Omit<ProgressFillProps, 'baseBg'>): ReactElement {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      data-testid="progress-fill"
      data-pct={clamped.toFixed(1)}
      data-late={isLate ? 'true' : 'false'}
      data-direction={direction}
      style={{ display: 'none' }}
    />
  );
}
