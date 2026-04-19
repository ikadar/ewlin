import type { DaySchedule, Station, Operator } from '@flux/types';
import { getOperatorDaySchedule } from '../../utils/operatorTileSlices';

export interface UnavailabilitySegment {
  startMs: number;
  endMs: number;
}

const DAY_NAMES: (keyof Station['operatingSchedule'])[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function getStationDaySchedule(station: Station, date: Date): DaySchedule {
  if (station.exceptions?.length) {
    const dateStr =
      `${date.getFullYear()}-` +
      `${String(date.getMonth() + 1).padStart(2, '0')}-` +
      `${String(date.getDate()).padStart(2, '0')}`;
    const exception = station.exceptions.find((e) => e.date === dateStr);
    if (exception) return exception.schedule;
  }
  return station.operatingSchedule[DAY_NAMES[date.getDay()]];
}

/**
 * Invert a day's operating schedule into unavailable segments, clipped to
 * [rangeStartMs, rangeEndMs]. Day boundaries are absolute (ms at 00:00 local).
 * Mirrors the logic of UnavailabilityOverlay.calculateUnavailablePeriods but
 * works in absolute-ms rather than minutes-since-midnight so the lens can
 * stitch multiple days into one wrapper.
 */
function segmentsForDay(
  dayStart: number,
  daySchedule: DaySchedule,
  rangeStartMs: number,
  rangeEndMs: number,
): UnavailabilitySegment[] {
  const segments: UnavailabilitySegment[] = [];
  const dayEndMs = dayStart + 24 * 3_600_000;

  if (!daySchedule.isOperating || daySchedule.slots.length === 0) {
    const s = Math.max(dayStart, rangeStartMs);
    const e = Math.min(dayEndMs, rangeEndMs);
    if (e > s) segments.push({ startMs: s, endMs: e });
    return segments;
  }

  const operating = daySchedule.slots
    .map((slot) => ({
      startMin: parseTimeToMinutes(slot.start),
      endMin: slot.end === '24:00' ? 24 * 60 : parseTimeToMinutes(slot.end),
    }))
    .sort((a, b) => a.startMin - b.startMin);

  let cursor = 0;
  for (const p of operating) {
    if (p.startMin > cursor) {
      const s = Math.max(dayStart + cursor * 60_000, rangeStartMs);
      const e = Math.min(dayStart + p.startMin * 60_000, rangeEndMs);
      if (e > s) segments.push({ startMs: s, endMs: e });
    }
    cursor = Math.max(cursor, p.endMin);
  }
  if (cursor < 24 * 60) {
    const s = Math.max(dayStart + cursor * 60_000, rangeStartMs);
    const e = Math.min(dayEndMs, rangeEndMs);
    if (e > s) segments.push({ startMs: s, endMs: e });
  }

  return segments;
}

function iterateDays(
  rangeStartMs: number,
  rangeEndMs: number,
  resolve: (date: Date) => DaySchedule,
): UnavailabilitySegment[] {
  const segments: UnavailabilitySegment[] = [];
  const first = new Date(rangeStartMs);
  first.setHours(0, 0, 0, 0);
  const last = new Date(rangeEndMs);
  last.setHours(0, 0, 0, 0);

  for (
    const d = new Date(first);
    d.getTime() <= last.getTime();
    d.setDate(d.getDate() + 1)
  ) {
    segments.push(...segmentsForDay(d.getTime(), resolve(d), rangeStartMs, rangeEndMs));
  }
  return segments;
}

export function computeStationUnavailabilitySegments(
  station: Station,
  rangeStartMs: number,
  rangeEndMs: number,
): UnavailabilitySegment[] {
  return iterateDays(rangeStartMs, rangeEndMs, (d) => getStationDaySchedule(station, d));
}

export function computeOperatorUnavailabilitySegments(
  operator: Operator,
  rangeStartMs: number,
  rangeEndMs: number,
): UnavailabilitySegment[] {
  return iterateDays(rangeStartMs, rangeEndMs, (d) => getOperatorDaySchedule(operator, d));
}
