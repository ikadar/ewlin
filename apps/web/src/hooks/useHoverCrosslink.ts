import { useMemo } from 'react';

export interface HoverCrosslinkProps {
  'data-flux-task-id'?: string;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
}

/** Duration of the heartbeat animation (matches @keyframes flux-hover-heartbeat). */
const PULSE_MS = 1050;

/**
 * Imperatively fire the hover pulse on every DOM node carrying
 * `data-flux-task-id={taskId}`. Used by click handlers that scroll the
 * grid to a tile — the one-shot heartbeat becomes a visual confirmation
 * that "this is where we just navigated to", without requiring the user
 * to hover the destination manually.
 *
 * Restarts the CSS animation cleanly by removing the class, forcing a
 * reflow, and re-adding it. Removes the class after the full duration
 * so the tile returns to its quiet state.
 */
export function pulseTaskTiles(taskId: string | undefined): void {
  if (!taskId) return;
  const els = document.querySelectorAll<HTMLElement>(
    `[data-flux-task-id="${CSS.escape(taskId)}"]`,
  );
  if (els.length === 0) return;

  els.forEach((el) => {
    el.classList.remove('flux-hover-linked');
    // Force reflow so re-adding the class restarts the animation instead
    // of being no-op'd by the browser (same rule = no transition kick).
    void el.offsetWidth;
    el.classList.add('flux-hover-linked');
  });

  window.setTimeout(() => {
    els.forEach((el) => el.classList.remove('flux-hover-linked'));
  }, PULSE_MS + 100); // small buffer past the last keyframe
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
