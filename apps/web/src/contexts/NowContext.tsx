/**
 * NowContext — single source of truth for "current time" across the app.
 *
 * Wraps {@link getNow}: components that need to react to the passing of
 * time call `useNow()` and re-render once a minute (the granularity at
 * which `late job` highlights, "en cours" badges, and the now-line on
 * the grid need to update).
 *
 * The provider also feeds the API-side override into the {@link getNow}
 * helper via `setApiOverride`. That way pure code (utils, selectors)
 * that calls `getNow()` directly observes the same virtual clock as
 * components that go through the hook.
 *
 * The 60 s interval is reset whenever the API override changes — the
 * first tick after a toggle should be immediate so the UI reflects the
 * new offset without waiting up to a minute.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getNow, setApiOverride } from '../utils/getNow';
import { useGetNowOverrideQuery } from '../store';

interface NowContextValue {
  now: Date;
  isOverridden: boolean;
  offsetSeconds: number;
}

const NowContext = createContext<NowContextValue>({
  now: new Date(),
  isOverridden: false,
  offsetSeconds: 0,
});

interface NowProviderProps {
  children: ReactNode;
  /**
   * Tick interval in ms. Defaults to 60 s — enough granularity for late
   * highlight + "en cours" toggling without forcing the whole app to
   * re-render every second.
   */
  intervalMs?: number;
}

export function NowProvider({ children, intervalMs = 60_000 }: NowProviderProps) {
  const { data: override } = useGetNowOverrideQuery();
  const [now, setNow] = useState(() => getNow());

  // Last seen override identity. We re-init the tick when this changes
  // so the override toggle is visible immediately (without waiting up
  // to a minute for the next interval beat).
  const lastSig = useRef<string>('');

  useEffect(() => {
    if (override) {
      setApiOverride(override.enabled ? new Date(override.effectiveNow) : null);
    } else {
      setApiOverride(null);
    }
    const sig = override
      ? `${override.enabled ? 1 : 0}:${override.offsetSeconds}:${override.setVirtualNow}`
      : 'wall';
    if (sig !== lastSig.current) {
      lastSig.current = sig;
      setNow(getNow());
    }
  }, [override]);

  useEffect(() => {
    const id = setInterval(() => setNow(getNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  const value = useMemo<NowContextValue>(
    () => ({
      now,
      isOverridden: !!override?.enabled,
      offsetSeconds: override?.enabled ? override.offsetSeconds : 0,
    }),
    [now, override?.enabled, override?.offsetSeconds],
  );

  return <NowContext.Provider value={value}>{children}</NowContext.Provider>;
}

/**
 * Returns the current "virtual" time, re-rendering the caller every
 * `intervalMs` (default 60 s) and immediately whenever the override
 * toggles. Use this in any component whose render depends on
 * "current time".
 */
export function useNow(): Date {
  return useContext(NowContext).now;
}

/**
 * Returns the override flag — useful for the global banner that warns
 * the user the system is in time-warp mode.
 */
export function useNowOverride(): { isOverridden: boolean; offsetSeconds: number } {
  const { isOverridden, offsetSeconds } = useContext(NowContext);
  return { isOverridden, offsetSeconds };
}
