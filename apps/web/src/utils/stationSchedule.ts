import type { Station, DaySchedule, TimeSlot, ScheduleException } from '@flux/types';

const DAY_NAMES: (keyof Station['operatingSchedule'])[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

const NON_OPERATING: DaySchedule = { isOperating: false, slots: [] };

function parseNaiveLocal(iso: string): Date {
  const [d, t = '00:00:00'] = iso.split('T');
  const [y, mo, dd] = d.split('-').map(Number);
  const [h, mi, s = 0] = t.split(':').map(Number);
  return new Date(y, mo - 1, dd, h, mi, s, 0);
}

function slotMinutes(slot: TimeSlot): { start: number; end: number } {
  const [sh, sm] = slot.start.split(':').map(Number);
  const [eh, em] = slot.end.split(':').map(Number);
  return { start: sh * 60 + sm, end: eh * 60 + em };
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function exceptionMinutesOnDay(
  ex: ScheduleException,
  date: Date,
): { start: number; end: number } | null {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

  const exStart = parseNaiveLocal(ex.startAt);
  const exEnd = parseNaiveLocal(ex.endAt);

  if (exEnd < dayStart || exStart >= dayEnd) return null;

  const startMin = exStart < dayStart ? 0 : exStart.getHours() * 60 + exStart.getMinutes();
  // endAt is inclusive in ADR-017, so the unavailable range is [startMin, endMin+1)
  const endMin = exEnd >= dayEnd ? 24 * 60 : exEnd.getHours() * 60 + exEnd.getMinutes() + 1;
  return { start: startMin, end: endMin };
}

/**
 * Effective day schedule for a station on a given date.
 *
 * ADR-017: Station.exceptions are closed periods {startAt, endAt}.
 * Start from the weekly schedule, then narrow each slot by subtracting
 * the union of overlapping exception periods. Mirrors PHP
 * Station.getEffectiveScheduleForDate.
 */
export function getStationDayScheduleForDate(date: Date, station: Station): DaySchedule {
  const base = station.operatingSchedule[DAY_NAMES[date.getDay()]];
  if (!base.isOperating || base.slots.length === 0) return base;

  const ranges: Array<{ start: number; end: number }> = [];
  for (const ex of station.exceptions ?? []) {
    const r = exceptionMinutesOnDay(ex, date);
    if (r) ranges.push(r);
  }
  if (ranges.length === 0) return base;

  ranges.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (!last || last.end < r.start) merged.push({ ...r });
    else last.end = Math.max(last.end, r.end);
  }

  if (merged.length === 1 && merged[0].start <= 0 && merged[0].end >= 24 * 60) {
    return NON_OPERATING;
  }

  const narrowed: TimeSlot[] = [];
  for (const slot of base.slots) {
    const { start: slotStart, end: slotEnd } = slotMinutes(slot);
    const overlapping = merged.filter((u) => u.end > slotStart && u.start < slotEnd);
    if (overlapping.length === 0) {
      narrowed.push(slot); // preserve original strings (may include '24:00')
      continue;
    }
    let cursor = slotStart;
    for (const u of overlapping) {
      if (u.end <= cursor) continue;
      if (u.start > cursor) {
        narrowed.push({
          start: minutesToTime(cursor),
          end: minutesToTime(Math.min(u.start, slotEnd)),
        });
      }
      cursor = Math.max(cursor, u.end);
      if (cursor >= slotEnd) break;
    }
    if (cursor < slotEnd) {
      narrowed.push({ start: minutesToTime(cursor), end: minutesToTime(slotEnd) });
    }
  }

  if (narrowed.length === 0) return NON_OPERATING;
  return { isOperating: true, slots: narrowed };
}
