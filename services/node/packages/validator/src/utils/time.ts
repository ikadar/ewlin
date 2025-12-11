/**
 * Time Utilities
 * Functions for time range overlap detection and duration calculations.
 */

import type { InternalDuration, OutsourcedDuration } from '@flux/types';

/** Time range with start and end timestamps */
export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Check if two time ranges overlap.
 * Ranges are considered overlapping if they share any common time.
 * Adjacent ranges (end of one equals start of another) do NOT overlap.
 */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Parse ISO timestamp string to Date.
 */
export function parseTimestamp(iso: string): Date {
  return new Date(iso);
}

/**
 * Format Date to ISO timestamp string.
 */
export function formatTimestamp(date: Date): string {
  return date.toISOString();
}

/**
 * Calculate end time for an internal task.
 * Simple calculation: start + (setup + run) minutes.
 * NOTE: In full implementation, this would stretch across non-operating periods.
 */
export function calculateInternalEndTime(start: Date, duration: InternalDuration): Date {
  const totalMinutes = duration.setupMinutes + duration.runMinutes;
  return new Date(start.getTime() + totalMinutes * 60 * 1000);
}

/**
 * Calculate end time for an outsourced task.
 * Simple calculation: start + openDays (as calendar days for MVP).
 * NOTE: In full implementation, this would use business calendar.
 */
export function calculateOutsourcedEndTime(start: Date, duration: OutsourcedDuration): Date {
  const daysInMs = duration.openDays * 24 * 60 * 60 * 1000;
  return new Date(start.getTime() + daysInMs);
}

/**
 * Check if a timestamp is within a time range (inclusive start, exclusive end).
 */
export function isWithinRange(timestamp: Date, range: TimeRange): boolean {
  return timestamp >= range.start && timestamp < range.end;
}

/**
 * Get the overlap between two time ranges.
 * Returns null if ranges don't overlap.
 */
export function getOverlap(a: TimeRange, b: TimeRange): TimeRange | null {
  if (!rangesOverlap(a, b)) {
    return null;
  }
  return {
    start: new Date(Math.max(a.start.getTime(), b.start.getTime())),
    end: new Date(Math.min(a.end.getTime(), b.end.getTime())),
  };
}

/**
 * Count how many assignments are active at a specific point in time.
 */
export function countActiveAtTime(timestamp: Date, ranges: TimeRange[]): number {
  return ranges.filter((range) => timestamp >= range.start && timestamp < range.end).length;
}

/**
 * Get maximum concurrent count for a set of time ranges.
 */
export function getMaxConcurrent(ranges: TimeRange[]): number {
  if (ranges.length === 0) return 0;

  // Collect all start and end events
  const events: { time: Date; type: 'start' | 'end' }[] = [];
  for (const range of ranges) {
    events.push({ time: range.start, type: 'start' });
    events.push({ time: range.end, type: 'end' });
  }

  // Sort by time, with 'end' events before 'start' events at same time
  events.sort((a, b) => {
    const timeDiff = a.time.getTime() - b.time.getTime();
    if (timeDiff !== 0) return timeDiff;
    // End events come before start events at same timestamp
    return a.type === 'end' ? -1 : 1;
  });

  let current = 0;
  let max = 0;
  for (const event of events) {
    if (event.type === 'start') {
      current++;
      max = Math.max(max, current);
    } else {
      current--;
    }
  }

  return max;
}
