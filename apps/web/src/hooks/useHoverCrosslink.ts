import { useMemo } from 'react';

export interface HoverCrosslinkProps {
  'data-flux-task-id'?: string;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
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
