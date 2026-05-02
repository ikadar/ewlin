/**
 * useProgressTriggers — derives the saisie state per in-progress assignment.
 *
 * For each assignment that's currently in-progress (scheduledStart ≤ now <
 * scheduledEnd, not completed), the hook computes one of:
 *   - 'tile-end' : `now ≥ scheduledEnd` (or within a `tileEndWindowMs` window
 *                  before, depending on caller's clock)
 *   - 'hourly'   : `now` falls inside the first `hourlyWindowMs` of an hour AND
 *                  no saisie has been recorded for this task in the last
 *                  `debounceMs`
 *   - 'inactive' : default — no active trigger
 *
 * The hook is **pure** : `lastSaisieByTask` is provided by the parent (sourced
 * from `Assignment.lastSaisieAt` once the field lands, or from any other
 * staleness store). This keeps the hook testable in isolation without coupling
 * it to a specific data fetch.
 *
 * Completed assignments are skipped entirely — they don't need a saisie.
 */
import { useMemo } from 'react';
import type { TaskAssignment } from '@flux/types';
import type { SaisieState } from '../components/Tile/SaisieIndicator';

export interface UseProgressTriggersOptions {
  /** Minutes after the hour mark during which the 'hourly' state is active. */
  hourlyWindowMs?: number;
  /** Minutes after the most recent saisie during which 'hourly' is suppressed. */
  debounceMs?: number;
}

const DEFAULT_HOURLY_WINDOW_MS = 5 * 60_000;     // 5 min
const DEFAULT_DEBOUNCE_MS      = 30 * 60_000;    // 30 min

export function useProgressTriggers(
  assignments: ReadonlyArray<TaskAssignment>,
  now: Date,
  lastSaisieByTask: Readonly<Record<string, Date>> = {},
  options: UseProgressTriggersOptions = {},
): Record<string, SaisieState> {
  const hourlyWindowMs = options.hourlyWindowMs ?? DEFAULT_HOURLY_WINDOW_MS;
  const debounceMs     = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;

  return useMemo(() => {
    const result: Record<string, SaisieState> = {};
    const nowMs = now.getTime();
    const minutesIntoHour = now.getMinutes();
    const millisIntoHour = minutesIntoHour * 60_000 + now.getSeconds() * 1_000;
    const isHourlyWindowActive = millisIntoHour < hourlyWindowMs;

    for (const a of assignments) {
      if (a.isCompleted) continue;

      const startMs = new Date(a.scheduledStart).getTime();
      const endMs   = new Date(a.scheduledEnd).getTime();

      // Not started yet — no trigger
      if (nowMs < startMs) continue;

      // Past the planned end — tile-end always fires (until parent dismisses
      // by recording a saisie, which the auto-completion fallback then handles).
      if (nowMs >= endMs) {
        result[a.taskId] = 'tile-end';
        continue;
      }

      // In-progress : check hourly window + debounce
      const lastSaisie = lastSaisieByTask[a.taskId];
      const hasRecentSaisie =
        lastSaisie !== undefined && (nowMs - lastSaisie.getTime()) < debounceMs;

      if (isHourlyWindowActive && !hasRecentSaisie) {
        result[a.taskId] = 'hourly';
      } else {
        result[a.taskId] = 'inactive';
      }
    }

    return result;
  }, [assignments, now, lastSaisieByTask, hourlyWindowMs, debounceMs]);
}
