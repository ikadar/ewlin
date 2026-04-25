import type { DaySchedule, Station, Operator } from '@flux/types';
import {
  getOperatorDaySchedule,
  getOperatorOvertimePeriodsForDay,
  aggregateOperatorOvertimePeriodsForStationDay,
  mergeDayScheduleWithOvertimePeriods,
} from '../../utils/operatorTileSlices';

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
  operators: readonly Operator[] = [],
): UnavailabilitySegment[] {
  return iterateDays(rangeStartMs, rangeEndMs, (d) => {
    const base = getStationDaySchedule(station, d);
    if (operators.length === 0) return base;
    const overtime = aggregateOperatorOvertimePeriodsForStationDay(operators, station.id, d);
    return overtime.length === 0 ? base : mergeDayScheduleWithOvertimePeriods(base, overtime);
  });
}

export function computeOperatorUnavailabilitySegments(
  operator: Operator,
  rangeStartMs: number,
  rangeEndMs: number,
): UnavailabilitySegment[] {
  return iterateDays(rangeStartMs, rangeEndMs, (d) => getOperatorDaySchedule(operator, d));
}

/**
 * Same shape as `UnavailabilitySegment` but represents *overtime* periods
 * (positive availability). Caller renders these with yellow hachures
 * (bg-stripes-amber) instead of the dark hachures used for unavailability.
 */
export type OvertimeSegment = UnavailabilitySegment;

/**
 * Compute overtime segments for an operator within a range of absolute ms.
 * Mirrors `computeOperatorUnavailabilitySegments` but returns the *positive*
 * overtime periods (heures supplémentaires) per day, in absolute ms ranges,
 * for the TimelineLens to render with yellow hachures.
 */
export function computeOperatorOvertimeSegments(
  operator: Operator,
  rangeStartMs: number,
  rangeEndMs: number,
): OvertimeSegment[] {
  if (!operator.overtimes?.length) return [];

  const segments: OvertimeSegment[] = [];
  const first = new Date(rangeStartMs);
  first.setHours(0, 0, 0, 0);
  const last = new Date(rangeEndMs);
  last.setHours(0, 0, 0, 0);

  for (
    const d = new Date(first);
    d.getTime() <= last.getTime();
    d.setDate(d.getDate() + 1)
  ) {
    const dayBaseMs = d.getTime();
    const periods = getOperatorOvertimePeriodsForDay(operator, d);
    for (const p of periods) {
      const s = Math.max(dayBaseMs + p.startMinutes * 60_000, rangeStartMs);
      const e = Math.min(dayBaseMs + p.endMinutes * 60_000, rangeEndMs);
      if (e > s) segments.push({ startMs: s, endMs: e });
    }
  }
  return segments;
}

/**
 * Aggregate overtime across qualified operators into absolute-ms segments,
 * for a specific station. Used when the timeline lens magnifies a station:
 * the lens should show the same amber stripes as the underlying StationColumn,
 * which means the same per-station qualification filter (only operators with
 * a skill entry on this station contribute their overtime).
 */
export function computeStationOvertimeSegments(
  operators: readonly Operator[],
  stationId: string,
  rangeStartMs: number,
  rangeEndMs: number,
): OvertimeSegment[] {
  if (operators.length === 0) return [];
  const segments: OvertimeSegment[] = [];
  const first = new Date(rangeStartMs);
  first.setHours(0, 0, 0, 0);
  const last = new Date(rangeEndMs);
  last.setHours(0, 0, 0, 0);

  for (
    const d = new Date(first);
    d.getTime() <= last.getTime();
    d.setDate(d.getDate() + 1)
  ) {
    const dayBaseMs = d.getTime();
    const periods = aggregateOperatorOvertimePeriodsForStationDay(operators, stationId, d);
    for (const p of periods) {
      const s = Math.max(dayBaseMs + p.startMinutes * 60_000, rangeStartMs);
      const e = Math.min(dayBaseMs + p.endMinutes * 60_000, rangeEndMs);
      if (e > s) segments.push({ startMs: s, endMs: e });
    }
  }
  return segments;
}
