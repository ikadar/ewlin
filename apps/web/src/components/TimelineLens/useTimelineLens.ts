import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LENS_HOVER_DELAY_MS, LENS_HIDE_GRACE_MS, LENS_AUTO_CLOSE_MS,
  LENS_SMALL_TILE_THRESHOLD_PX, LENS_ONLY_TINY,
} from './lensConfig';
import type { LensAnchor } from './TimelineLens';

export interface LensState {
  visible: boolean;
  activeColumnId: string | null;
  centerTimeMs: number;
  anchor: LensAnchor | null;
}

export interface TileEnterInput {
  columnId: string;
  /** Mid-time of the hovered tile (ms). The lens centers on this value. */
  tileMidTimeMs: number;
  /** Rendered height (px) of the tile in the source grid. Used to classify small vs tall. */
  tileHeightPx: number;
  /** Source column's current bounding rect — used to position the lens. */
  anchor: LensAnchor;
}

const INITIAL_STATE: LensState = {
  visible: false,
  activeColumnId: null,
  centerTimeMs: 0,
  anchor: null,
};

/**
 * Hook that drives a TimelineLens. View-agnostic: the caller decides how to
 * derive `tileMidTimeMs`, `tileHeightPx`, and the anchor rect from its own
 * data + DOM.
 *
 * Responsibilities:
 *   - Debounced open (LENS_HOVER_DELAY_MS)
 *   - Re-centering on subsequent small-tile hovers within the same session
 *   - Auto-close timer armed by tall-tile hover (non-resetting)
 *   - Graceful hide on column-leave (LENS_HIDE_GRACE_MS) with bridge via lens-enter
 *   - Esc-to-close
 */
export function useTimelineLens() {
  const [state, setState] = useState<LensState>(INITIAL_STATE);

  // Refs mirror state so async callbacks see the freshest values without
  // needing to list state in their dependency arrays.
  const stateRef = useRef<LensState>(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);
  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);
  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearShowTimer();
    clearHideTimer();
    clearCloseTimer();
    setState(INITIAL_STATE);
  }, [clearShowTimer, clearHideTimer, clearCloseTimer]);

  const armCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) return; // keep the existing countdown
    if (LENS_AUTO_CLOSE_MS <= 0) return;
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      hide();
    }, LENS_AUTO_CLOSE_MS);
  }, [hide]);

  const handleTileEnter = useCallback((input: TileEnterInput) => {
    const small = input.tileHeightPx <= LENS_SMALL_TILE_THRESHOLD_PX;
    const current = stateRef.current;

    if (small) {
      clearCloseTimer();
      clearHideTimer();

      if (current.visible) {
        // Same session — update the target instantly; the lens component
        // will transition translateY to the new center.
        setState({
          visible: true,
          activeColumnId: input.columnId,
          centerTimeMs: input.tileMidTimeMs,
          anchor: input.anchor,
        });
        return;
      }

      // Not yet visible — schedule the first open
      if (showTimerRef.current === null) {
        showTimerRef.current = window.setTimeout(() => {
          showTimerRef.current = null;
          setState({
            visible: true,
            activeColumnId: input.columnId,
            centerTimeMs: input.tileMidTimeMs,
            anchor: input.anchor,
          });
        }, LENS_HOVER_DELAY_MS);
      }
      return;
    }

    // Tall tile
    if (!current.visible) return;
    if (!LENS_ONLY_TINY) {
      // If we ever turn off the onlyTiny gate, tall-tile hovers would re-center
      // the lens on the tall tile here. Kept as a hook for future flexibility.
      setState({
        visible: true,
        activeColumnId: input.columnId,
        centerTimeMs: input.tileMidTimeMs,
        anchor: input.anchor,
      });
    }
    armCloseTimer();
  }, [clearCloseTimer, clearHideTimer, armCloseTimer]);

  const handleStationLeave = useCallback(() => {
    clearShowTimer();
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      hide();
    }, LENS_HIDE_GRACE_MS);
  }, [clearShowTimer, clearHideTimer, hide]);

  const handleLensEnter = useCallback(() => {
    clearHideTimer();
    clearCloseTimer();
  }, [clearHideTimer, clearCloseTimer]);

  const handleLensLeave = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      hide();
    }, LENS_HIDE_GRACE_MS);
  }, [clearHideTimer, hide]);

  // Esc closes immediately
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hide]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (showTimerRef.current !== null) window.clearTimeout(showTimerRef.current);
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  return {
    state,
    handlers: {
      handleTileEnter,
      handleStationLeave,
      handleLensEnter,
      handleLensLeave,
    },
    hide,
  };
}
