/**
 * useComputeToaster — unified compute-feedback channel.
 *
 * Centralises all compute-related user feedback (auto-recompute post-edit,
 * manual compute, auto-place, background LNS optimizer) through one API.
 * Validated visually in playground-compute-toaster.html:
 *   - Position: Top-Right
 *   - Size: Compact
 *   - Auto-hide: 4000 ms
 *   - Types: info / success / error / progress / waze
 *   - Stack cap: 3 visible, oldest evicted
 *   - In-place update when `id` collides (progress → success/error)
 *
 * Callers are expected to pick stable ids per compute operation so
 * "Recalcul en cours…" becomes "Planning à jour" without spawning a
 * second toast. Pinned toasts (progress, waze) don't auto-hide.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type ComputeToastType = 'info' | 'success' | 'error' | 'progress' | 'waze';

export interface ComputeToastAction {
  id: string;
  label: string;
  variant?: 'primary' | 'ghost';
  onClick: () => void;
}

export interface ComputeToastMetric {
  label: string;
  value: string;
  bad?: boolean;
}

export interface ComputeToast {
  id: string;
  type: ComputeToastType;
  title: string;
  detail?: string;
  metrics?: ComputeToastMetric[];
  actions?: ComputeToastAction[];
  /** true = won't auto-hide; caller must dismiss explicitly. */
  pinned?: boolean;
  /** Forces no auto-hide even when not pinned (transient progress). */
  noAutoHide?: boolean;
  /** Determinate progress 0..100, -1 = indeterminate bar. Omit for none. */
  progress?: number;
}

const MAX_VISIBLE = 3;
const AUTO_HIDE_MS = 4000;

interface State {
  toasts: ComputeToast[];
}

interface UseComputeToasterReturn {
  toasts: ComputeToast[];
  /** Show or in-place update a toast. Returns the id (generated if absent). */
  show: (toast: Omit<ComputeToast, 'id'> & { id?: string }) => string;
  /** Dismiss a specific toast by id. */
  dismiss: (id: string) => void;
  /** Clear all visible toasts. */
  clearAll: () => void;
}

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `tst-${Date.now()}-${idCounter}`;
}

export function useComputeToaster(): UseComputeToasterReturn {
  const [state, setState] = useState<State>({ toasts: [] });
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(id);
    }
    setState((prev) => ({ toasts: prev.toasts.filter((x) => x.id !== id) }));
  }, []);

  const show = useCallback(
    (toast: Omit<ComputeToast, 'id'> & { id?: string }): string => {
      const id = toast.id ?? generateId();
      const full: ComputeToast = { ...toast, id };

      setState((prev) => {
        const existingIdx = prev.toasts.findIndex((t) => t.id === id);
        let next: ComputeToast[];
        if (existingIdx >= 0) {
          next = prev.toasts.slice();
          next[existingIdx] = full;
        } else {
          next = prev.toasts.slice();
          if (next.length >= MAX_VISIBLE) next.shift();
          next.push(full);
        }
        return { toasts: next };
      });

      // Reset any existing timer for this id
      const prevTimer = timersRef.current.get(id);
      if (prevTimer) clearTimeout(prevTimer);

      const isPinned = full.pinned === true || full.noAutoHide === true;
      if (!isPinned) {
        const timer = setTimeout(() => dismiss(id), AUTO_HIDE_MS);
        timersRef.current.set(id, timer);
      } else {
        timersRef.current.delete(id);
      }

      return id;
    },
    [dismiss],
  );

  const clearAll = useCallback(() => {
    for (const [, t] of timersRef.current) clearTimeout(t);
    timersRef.current.clear();
    setState({ toasts: [] });
  }, []);

  useEffect(() => {
    return () => {
      for (const [, t] of timersRef.current) clearTimeout(t);
      timersRef.current.clear();
    };
  }, []);

  return {
    toasts: state.toasts,
    show,
    dismiss,
    clearAll,
  };
}
