/**
 * getNow() — returns the current time, or a simulated time if `?now=` is set in the URL.
 *
 * Usage:  `getNow()`  instead of  `new Date()`  everywhere scheduling logic needs "current time".
 *
 * Override via URL:  ?now=2026-03-10T14:00
 *
 * The parsed value is cached so repeated calls don't re-parse the URL.
 */

let cachedOverride: Date | null | undefined; // undefined = not yet checked

function parseOverride(): Date | null {
  if (typeof window === 'undefined') return null;
  const param = new URLSearchParams(window.location.search).get('now');
  if (!param) return null;
  const d = new Date(param);
  return isNaN(d.getTime()) ? null : d;
}

export function getNow(): Date {
  if (cachedOverride === undefined) {
    cachedOverride = parseOverride();
  }
  if (cachedOverride) {
    // Advance by the elapsed real-time since the page loaded so the clock still ticks
    return new Date(cachedOverride.getTime() + (Date.now() - pageLoadTime));
  }
  return new Date();
}

/** Returns true when a time override is active. */
export function isTimeOverridden(): boolean {
  if (cachedOverride === undefined) {
    cachedOverride = parseOverride();
  }
  return cachedOverride !== null;
}

/** Reset cache (useful if URL changes via pushState). */
export function resetNowCache(): void {
  cachedOverride = undefined;
}

const pageLoadTime = Date.now();
