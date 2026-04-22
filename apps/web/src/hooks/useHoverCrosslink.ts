import { useMemo } from 'react';

export interface HoverCrosslinkProps {
  'data-flux-task-id'?: string;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
}

/** Duration of the heartbeat animation (matches @keyframes flux-hover-heartbeat). */
const PULSE_MS = 1050;

/** Low-level restart: remove the class, force reflow, re-add, auto-clean. */
function playPulse(els: HTMLElement[]): void {
  els.forEach((el) => {
    el.classList.remove('flux-hover-linked');
    // Force reflow so re-adding restarts the animation (same rule = no-op
    // without the sync read).
    void el.offsetWidth;
    el.classList.add('flux-hover-linked');
  });
  window.setTimeout(() => {
    els.forEach((el) => el.classList.remove('flux-hover-linked'));
  }, PULSE_MS + 100);
}

/**
 * Imperative pulse used by click handlers that scroll the grid to a
 * task. JDP rows (source of the click) pulse immediately — click
 * confirmation. Grid tiles (destination) wait until they scroll into
 * view via IntersectionObserver, so the heartbeat greets the user when
 * the tile actually arrives instead of playing off-screen.
 *
 * Fallback: if the destination never becomes visible (e.g. clipped by
 * a lens, scroll cancelled), the observer disconnects after 2s — the
 * pulse quietly drops instead of looping forever.
 */
export function pulseTaskTiles(taskId: string | undefined): void {
  if (!taskId) return;
  const all = document.querySelectorAll<HTMLElement>(
    `[data-flux-task-id="${CSS.escape(taskId)}"]`,
  );
  if (all.length === 0) return;

  const jdpRows: HTMLElement[] = [];
  const gridTiles: HTMLElement[] = [];
  all.forEach((el) => {
    if (el.matches('[data-testid^="task-tile-"]')) jdpRows.push(el);
    else gridTiles.push(el);
  });

  if (jdpRows.length > 0) playPulse(jdpRows);

  if (gridTiles.length > 0) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          playPulse(gridTiles);
        }
      },
      { threshold: 0.3 },
    );
    gridTiles.forEach((el) => observer.observe(el));
    // Long scrolls across multi-day grids can take 3-4s at default browser
    // smooth-scroll speed. Give the observer enough runway before giving up.
    window.setTimeout(() => observer.disconnect(), 6000);
  }
}

/**
 * Crosslink a JDP tile row with its matching grid tile(s): while the mouse
 * hovers either side, every DOM node carrying `data-flux-task-id={taskId}`
 * gets the `flux-hover-linked` class, triggering the one-shot heartbeat
 * animation defined in index.css. Stateless on the React side — we poke
 * the DOM directly so we never cascade re-renders across the whole grid.
 *
 * Usage:
 *   <div {...useHoverCrosslink(task.id)}>…</div>
 */
export function useHoverCrosslink(taskId: string | undefined): HoverCrosslinkProps {
  return useMemo(() => {
    if (!taskId) return {};
    const selector = `[data-flux-task-id="${CSS.escape(taskId)}"]`;
    return {
      'data-flux-task-id': taskId,
      onMouseEnter: () => {
        document.querySelectorAll(selector).forEach((el) => el.classList.add('flux-hover-linked'));
      },
      onMouseLeave: () => {
        document.querySelectorAll(selector).forEach((el) => el.classList.remove('flux-hover-linked'));
      },
    };
  }, [taskId]);
}
