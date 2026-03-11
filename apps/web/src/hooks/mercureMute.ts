/**
 * Mercure Mute Window
 *
 * Module-level mute state to suppress Mercure-triggered cache invalidation
 * for the mutating client. When a client sends a mutation (POST/PUT/DELETE),
 * it already has the latest data — the returning Mercure event would cause
 * a redundant refetch.
 *
 * Usage:
 * - Call muteMercure() before non-GET requests (done in realBaseQuery)
 * - Check isMercureMuted() in useMercureSubscription before invalidating
 */

let muteUntil = 0;

/**
 * Mute Mercure-triggered invalidations for the given duration.
 * Called automatically by realBaseQuery for non-GET requests.
 */
export function muteMercure(durationMs = 2000): void {
  muteUntil = Date.now() + durationMs;
}

/**
 * Check whether Mercure events should be ignored (own mutation in flight).
 */
export function isMercureMuted(): boolean {
  return Date.now() < muteUntil;
}
