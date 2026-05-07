/**
 * getNow() — single source of truth for "current time" on the FE.
 *
 * Resolution priority:
 *   1. URL `?now=<iso>` — useful for shareable reproducible links
 *   2. API override (set via `setApiOverride`) populated by NowProvider
 *      from /api/v1/now-override
 *   3. Wall clock
 *
 * Both override sources behave the same way: the offset is captured once
 * and the clock continues to tick at wall speed (we add the elapsed
 * real-time since capture). This is a *time-warp*, not a *freeze*.
 *
 * Components must consume `useNow()` from NowContext rather than calling
 * getNow() directly: the hook ties re-renders to the 60 s ticker and the
 * RTK-driven API override updates. getNow() is the underlying pure
 * function used by the hook and by non-component code paths.
 */

interface OverrideState {
  /** The captured "virtual now" reference. */
  reference: Date;
  /** Wall-clock time when the reference was captured. */
  capturedAt: number;
}

let urlOverride: OverrideState | null | undefined; // undefined = not yet checked
let apiOverride: OverrideState | null = null;

function parseUrlOverride(): OverrideState | null {
  if (typeof window === 'undefined') return null;
  const param = new URLSearchParams(window.location.search).get('now');
  if (!param) return null;
  const d = new Date(param);
  if (isNaN(d.getTime())) return null;
  return { reference: d, capturedAt: Date.now() };
}

function ensureUrlOverride(): OverrideState | null {
  if (urlOverride === undefined) {
    urlOverride = parseUrlOverride();
  }
  return urlOverride;
}

/**
 * Set or clear the API-driven override. Called by NowProvider whenever
 * the result of useGetNowOverrideQuery changes.
 *
 * Pass `null` to clear the override (when `enabled: false` server-side).
 * Pass `{ effectiveNow }` — the API computes effectiveNow = wall + offset
 * server-side, so the FE only needs to anchor it to local Date.now().
 */
export function setApiOverride(effectiveNow: Date | null): void {
  apiOverride = effectiveNow === null
    ? null
    : { reference: effectiveNow, capturedAt: Date.now() };
}

/** Returns the active override (URL wins over API). */
function activeOverride(): OverrideState | null {
  return ensureUrlOverride() ?? apiOverride;
}

export function getNow(): Date {
  const ov = activeOverride();
  if (ov === null) return new Date();
  return new Date(ov.reference.getTime() + (Date.now() - ov.capturedAt));
}

/** Returns true when a time override is active (URL or API). */
export function isTimeOverridden(): boolean {
  return activeOverride() !== null;
}

/** Reset the URL cache (used by tests / pushState handlers). */
export function resetNowCache(): void {
  urlOverride = undefined;
}
