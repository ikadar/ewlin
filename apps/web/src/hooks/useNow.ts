/**
 * useNow — emits a Date that updates at a configurable interval.
 *
 * Default interval: 60 s — adequate for the saisie triggers (hourly + tile-end)
 * which only need minute-level resolution. For higher-frequency UIs (e.g. a
 * live timer), pass a smaller interval.
 *
 * Note: the timer is paused/resumed by the browser when the tab is hidden,
 * so this isn't a guarantee of millisecond accuracy — but it's fine for
 * planning UIs where state checks are inherently coarse.
 */
import { useEffect, useState } from 'react';

export function useNow(intervalMs: number = 60_000): Date {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
