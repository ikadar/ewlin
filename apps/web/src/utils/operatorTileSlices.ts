import { getActiveScheduleForDate } from '@flux/types';
import type { Absence, DaySchedule, Operator, Overtime, TaskAssignment } from '@flux/types';

const DAY_NAMES = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
] as const;

/** A rendered slice of a tile — one contiguous segment with fixed position. */
export interface TileSlice {
  assignmentId: string;
  taskId: string;
  from: Date;
  to: Date;
  position: 'full' | 'left' | 'right';
  isMasked: boolean;
  sawtoothTop: boolean;
  sawtoothBottom: boolean;
  relayLabelTop?: string;
  relayLabelBottom?: string;
}

/**
 * Get the effective day schedule for an operator on a given date.
 *
 * Three-step model (mirrors the Rust engine's `OperatorAvailability::compute_availability`):
 *   1. Base = the rotating weekly schedule for the date's weekday.
 *   2. Union with overtime slots intersecting the day (additive — extends availability).
 *   3. Narrow by absences (subtractive — the only way to remove availability).
 *
 * A day fully covered by absences returns `{isOperating: false, slots: []}`,
 * which makes every downstream consumer (hachures overlay, tile sawtooth, collapse
 * computation, timeline lens) honor the absence uniformly. Overtime ranges that
 * extend past base hours produce continuous merged slots — no internal sawtooth.
 *
 * Overtime and absence ranges are guaranteed disjoint by the PHP API (HTTP 400
 * on overlap), so the union and narrowing steps cannot contradict each other.
 */
export function getOperatorDaySchedule(operator: Operator, date: Date): DaySchedule {
  const activeSchedule = getActiveScheduleForDate(
    operator.operatingSchedules,
    operator.scheduleRotationReferenceWeek,
    date,
  );
  const base: DaySchedule = activeSchedule
    ? activeSchedule[DAY_NAMES[date.getDay()]] ?? { isOperating: false, slots: [] }
    : { isOperating: true, slots: [{ start: '00:00', end: '24:00' }] };

  const extended = unionWithOvertimes(base, operator.overtimes, date);
  return narrowByAbsences(extended, operator.absences, date);
}

function unionWithOvertimes(
  base: DaySchedule,
  overtimes: Overtime[] | null | undefined,
  date: Date,
): DaySchedule {
  if (!overtimes?.length) return base;

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const dayStart = `${dateStr}T00:00:00`;
  const dayEnd = `${dateStr}T23:59:59`;

  const otRanges: Array<[number, number]> = [];
  for (const ot of overtimes) {
    if (ot.startAt > dayEnd || ot.endAt < dayStart) continue;
    const startMin = ot.startAt < dayStart
      ? 0
      : parseInt(ot.startAt.slice(11, 13), 10) * 60 + parseInt(ot.startAt.slice(14, 16), 10);
    const endMin = ot.endAt > dayEnd
      ? 24 * 60
      : parseInt(ot.endAt.slice(11, 13), 10) * 60 + parseInt(ot.endAt.slice(14, 16), 10) + 1;
    if (endMin > startMin) otRanges.push([startMin, endMin]);
  }
  if (otRanges.length === 0) return base;

  const baseRanges: Array<[number, number]> = base.isOperating
    ? base.slots.map((slot) => {
        const startMin =
          parseInt(slot.start.slice(0, 2), 10) * 60 + parseInt(slot.start.slice(3, 5), 10);
        const endMin = slot.end === '24:00'
          ? 24 * 60
          : parseInt(slot.end.slice(0, 2), 10) * 60 + parseInt(slot.end.slice(3, 5), 10);
        return [startMin, endMin] as [number, number];
      })
    : [];

  const all = [...baseRanges, ...otRanges].sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of all) {
    const last = merged[merged.length - 1];
    if (!last || last[1] < r[0]) merged.push([...r]);
    else last[1] = Math.max(last[1], r[1]);
  }

  const toHm = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return {
    isOperating: true,
    slots: merged.map(([s, e]) => ({
      start: toHm(s),
      end: e === 24 * 60 ? '24:00' : toHm(e),
    })),
  };
}

/**
 * Compute overtime periods for a given day, in minutes-since-midnight, for
 * use by the OvertimeOverlay (gray plus-cross grid rendered ABOVE base column,
 * BELOW tiles). Returns merged, sorted ranges. Empty when the operator has
 * no overtime intersecting the day.
 *
 * Note: this returns the raw declared overtime ranges (clipped to the day),
 * not the diff-with-base. So an overtime entry that happens to sit inside
 * base hours still renders as overtime — the user's intent ("this is
 * overtime time") is preserved verbatim.
 */
export function getOperatorOvertimePeriodsForDay(
  operator: Operator,
  date: Date,
): Array<{ startMinutes: number; endMinutes: number }> {
  if (!operator.overtimes?.length) return [];

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const dayStart = `${dateStr}T00:00:00`;
  const dayEnd = `${dateStr}T23:59:59`;

  const ranges: Array<[number, number]> = [];
  for (const ot of operator.overtimes) {
    if (ot.startAt > dayEnd || ot.endAt < dayStart) continue;
    const startMin = ot.startAt < dayStart
      ? 0
      : parseInt(ot.startAt.slice(11, 13), 10) * 60 + parseInt(ot.startAt.slice(14, 16), 10);
    const endMin = ot.endAt > dayEnd
      ? 24 * 60
      : parseInt(ot.endAt.slice(11, 13), 10) * 60 + parseInt(ot.endAt.slice(14, 16), 10) + 1;
    if (endMin > startMin) ranges.push([startMin, endMin]);
  }
  if (ranges.length === 0) return [];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (!last || last[1] < r[0]) merged.push([...r]);
    else last[1] = Math.max(last[1], r[1]);
  }
  return merged.map(([s, e]) => ({ startMinutes: s, endMinutes: e }));
}

/**
 * Aggregate overtime periods on a *given station's day*, restricted to
 * operators who are qualified to run that station (i.e. who carry a
 * skill entry for it — proficiency > 0 is enforced upstream when skills
 * are persisted, so any entry in `operator.skills` means "can operate").
 *
 * Why this is per-station and not shop-wide: an operator in overtime can
 * only make the stations they're qualified for available. A bookbinding
 * operator working overtime does NOT make the Ryobi 528 (offset press)
 * available — only stations they can run gain availability.
 *
 * Mirrors the engine's qualification check in `forward_pass.rs` (qualified
 * = skill entry exists for the station).
 */
export function aggregateOperatorOvertimePeriodsForStationDay(
  operators: readonly Operator[],
  stationId: string,
  date: Date,
): Array<{ startMinutes: number; endMinutes: number }> {
  if (operators.length === 0) return [];
  const all: Array<[number, number]> = [];
  for (const op of operators) {
    if (!op.skills.some((s) => s.stationId === stationId)) continue;
    for (const p of getOperatorOvertimePeriodsForDay(op, date)) {
      all.push([p.startMinutes, p.endMinutes]);
    }
  }
  if (all.length === 0) return [];
  all.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of all) {
    const last = merged[merged.length - 1];
    if (!last || last[1] < r[0]) merged.push([...r]);
    else last[1] = Math.max(last[1], r[1]);
  }
  return merged.map(([s, e]) => ({ startMinutes: s, endMinutes: e }));
}

/**
 * Union a base day schedule with already-computed overtime periods (in
 * minutes-since-midnight). Mirrors the internal `unionWithOvertimes` but
 * accepts pre-merged ranges, letting the caller compute periods once and
 * use them both for the OvertimeOverlay and for narrowing the dark
 * unavailability hachures (dark = "no operator at all", amber = "at least
 * one operator in overtime").
 */
export function mergeDayScheduleWithOvertimePeriods(
  base: DaySchedule,
  periods: ReadonlyArray<{ startMinutes: number; endMinutes: number }>,
): DaySchedule {
  if (periods.length === 0) return base;

  const baseRanges: Array<[number, number]> = base.isOperating
    ? base.slots.map((slot) => {
        const startMin =
          parseInt(slot.start.slice(0, 2), 10) * 60 + parseInt(slot.start.slice(3, 5), 10);
        const endMin = slot.end === '24:00'
          ? 24 * 60
          : parseInt(slot.end.slice(0, 2), 10) * 60 + parseInt(slot.end.slice(3, 5), 10);
        return [startMin, endMin] as [number, number];
      })
    : [];

  const all: Array<[number, number]> = [
    ...baseRanges,
    ...periods.map((p) => [p.startMinutes, p.endMinutes] as [number, number]),
  ].sort((a, b) => a[0] - b[0]);

  const merged: Array<[number, number]> = [];
  for (const r of all) {
    const last = merged[merged.length - 1];
    if (!last || last[1] < r[0]) merged.push([...r]);
    else last[1] = Math.max(last[1], r[1]);
  }

  const toHm = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return {
    isOperating: true,
    slots: merged.map(([s, e]) => ({
      start: toHm(s),
      end: e === 24 * 60 ? '24:00' : toHm(e),
    })),
  };
}

/**
 * Narrow a station's day schedule to the intersection with the union of
 * qualified operators' availability for that day.
 *
 * A station is only physically workable when at least one qualified
 * operator can run it. The PHP API and the Rust engine both honour this
 * via separate availability checks; the StationColumn overlay used to
 * compute hatching purely from `station.operatingSchedule`, so a press
 * with a single qualified operator looked "open" past that operator's
 * shift end. This helper closes the gap, mirroring the engine's
 * effective-availability semantics.
 *
 * Empty `qualifiedOperators` collapses to non-operating: nobody can
 * conduct the press, so every minute of the day is unworkable.
 */
export function narrowDayScheduleByQualifiedOperators(
  base: DaySchedule,
  qualifiedOperators: readonly Operator[],
  date: Date,
): DaySchedule {
  if (qualifiedOperators.length === 0) return { isOperating: false, slots: [] };
  if (!base.isOperating || base.slots.length === 0) return base;

  // Union of operator availabilities expressed as [startMin, endMin) ranges.
  const opRanges: Array<[number, number]> = [];
  for (const op of qualifiedOperators) {
    const sched = getOperatorDaySchedule(op, date);
    if (!sched.isOperating) continue;
    for (const slot of sched.slots) {
      const startMin =
        parseInt(slot.start.slice(0, 2), 10) * 60 + parseInt(slot.start.slice(3, 5), 10);
      const endMin = slot.end === '24:00'
        ? 24 * 60
        : parseInt(slot.end.slice(0, 2), 10) * 60 + parseInt(slot.end.slice(3, 5), 10);
      if (endMin > startMin) opRanges.push([startMin, endMin]);
    }
  }
  if (opRanges.length === 0) return { isOperating: false, slots: [] };
  opRanges.sort((a, b) => a[0] - b[0]);
  const opUnion: Array<[number, number]> = [];
  for (const r of opRanges) {
    const last = opUnion[opUnion.length - 1];
    if (!last || last[1] < r[0]) opUnion.push([...r]);
    else last[1] = Math.max(last[1], r[1]);
  }

  // Intersect each base slot with the union of operator ranges.
  const toHm = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const narrowed: { start: string; end: string }[] = [];
  for (const slot of base.slots) {
    const slotStart =
      parseInt(slot.start.slice(0, 2), 10) * 60 + parseInt(slot.start.slice(3, 5), 10);
    const slotEnd = slot.end === '24:00'
      ? 24 * 60
      : parseInt(slot.end.slice(0, 2), 10) * 60 + parseInt(slot.end.slice(3, 5), 10);
    for (const [oStart, oEnd] of opUnion) {
      const s = Math.max(slotStart, oStart);
      const e = Math.min(slotEnd, oEnd);
      if (e > s) {
        narrowed.push({
          start: toHm(s),
          end: e === 24 * 60 ? '24:00' : toHm(e),
        });
      }
    }
  }

  if (narrowed.length === 0) return { isOperating: false, slots: [] };
  return { isOperating: true, slots: narrowed };
}

function narrowByAbsences(
  base: DaySchedule,
  absences: Absence[] | null | undefined,
  date: Date,
): DaySchedule {
  if (!absences?.length) return base;

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const dayStart = `${dateStr}T00:00:00`;
  const dayEnd = `${dateStr}T23:59:59`;

  const unavailable: Array<[number, number]> = [];
  for (const ab of absences) {
    if (ab.startAt > dayEnd || ab.endAt < dayStart) continue;
    const startMin = ab.startAt < dayStart
      ? 0
      : parseInt(ab.startAt.slice(11, 13), 10) * 60 + parseInt(ab.startAt.slice(14, 16), 10);
    const endMin = ab.endAt > dayEnd
      ? 24 * 60
      : parseInt(ab.endAt.slice(11, 13), 10) * 60 + parseInt(ab.endAt.slice(14, 16), 10) + 1;
    unavailable.push([startMin, endMin]);
  }
  if (unavailable.length === 0) return base;

  unavailable.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of unavailable) {
    const last = merged[merged.length - 1];
    if (!last || last[1] < range[0]) merged.push([...range]);
    else last[1] = Math.max(last[1], range[1]);
  }
  if (merged.length === 1 && merged[0][0] <= 0 && merged[0][1] >= 24 * 60) {
    return { isOperating: false, slots: [] };
  }

  if (!base.isOperating || !base.slots?.length) return base;

  const toHm = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const narrowedSlots: { start: string; end: string }[] = [];
  for (const slot of base.slots) {
    const slotStart = parseInt(slot.start.slice(0, 2), 10) * 60 + parseInt(slot.start.slice(3, 5), 10);
    const slotEnd = slot.end === '24:00'
      ? 24 * 60
      : parseInt(slot.end.slice(0, 2), 10) * 60 + parseInt(slot.end.slice(3, 5), 10);
    let cursor = slotStart;
    for (const [uStart, uEnd] of merged) {
      if (uEnd <= cursor || uStart >= slotEnd) continue;
      if (uStart > cursor) narrowedSlots.push({ start: toHm(cursor), end: toHm(Math.min(uStart, slotEnd)) });
      cursor = Math.max(cursor, uEnd);
      if (cursor >= slotEnd) break;
    }
    if (cursor < slotEnd) narrowedSlots.push({ start: toHm(cursor), end: toHm(slotEnd) });
  }

  if (narrowedSlots.length === 0) return { isOperating: false, slots: [] };
  return { isOperating: true, slots: narrowedSlots };
}

/** Parse "HH:MM" to minutes since midnight. */
export function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Find unavailability gaps for an operator within a time range. */
export function findOperatorGaps(
  operator: Operator,
  start: Date,
  end: Date,
): Array<{ gapStart: Date; gapEnd: Date }> {
  const gaps: Array<{ gapStart: Date; gapEnd: Date }> = [];
  const startMs = start.getTime();
  const endMs = end.getTime();

  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);

  for (let d = new Date(dayStart); d.getTime() < endMs; d.setDate(d.getDate() + 1)) {
    const daySchedule = getOperatorDaySchedule(operator, d);
    const dayBase = d.getTime();

    if (!daySchedule.isOperating || !daySchedule.slots?.length) {
      const gapStart = new Date(Math.max(dayBase, startMs));
      const gapEnd = new Date(Math.min(dayBase + 24 * 60 * 60000, endMs));
      if (gapStart < gapEnd) gaps.push({ gapStart, gapEnd });
      continue;
    }

    const slots = [...daySchedule.slots].sort((a, b) => parseHHMM(a.start) - parseHHMM(b.start));

    const firstSlotStart = dayBase + parseHHMM(slots[0].start) * 60000;
    if (dayBase < firstSlotStart) {
      const gs = new Date(Math.max(dayBase, startMs));
      const ge = new Date(Math.min(firstSlotStart, endMs));
      if (gs < ge) gaps.push({ gapStart: gs, gapEnd: ge });
    }

    for (let i = 0; i < slots.length - 1; i++) {
      const slotEnd = dayBase + parseHHMM(slots[i].end) * 60000;
      const nextStart = dayBase + parseHHMM(slots[i + 1].start) * 60000;
      if (slotEnd < nextStart) {
        const gs = new Date(Math.max(slotEnd, startMs));
        const ge = new Date(Math.min(nextStart, endMs));
        if (gs < ge) gaps.push({ gapStart: gs, gapEnd: ge });
      }
    }

    const lastSlotEnd = dayBase + parseHHMM(slots[slots.length - 1].end) * 60000;
    const dayEnd = dayBase + 24 * 60 * 60000;
    if (lastSlotEnd < dayEnd) {
      const gs = new Date(Math.max(lastSlotEnd, startMs));
      const ge = new Date(Math.min(dayEnd, endMs));
      if (gs < ge) gaps.push({ gapStart: gs, gapEnd: ge });
    }
  }

  return gaps;
}

/** Check if a timestamp is inside an operator's working hours. */
export function isOperatorWorking(operator: Operator, timestamp: Date): boolean {
  const daySchedule = getOperatorDaySchedule(operator, timestamp);
  if (!daySchedule.isOperating || !daySchedule.slots?.length) return false;
  const h = timestamp.getHours();
  const m = timestamp.getMinutes();
  const mins = h * 60 + m;
  return daySchedule.slots.some(slot => {
    const slotStart = parseHHMM(slot.start);
    const slotEnd = parseHHMM(slot.end);
    return mins >= slotStart && mins < slotEnd;
  });
}

function findRelayOperator(
  entries: Array<{ id: string; assignment: TaskAssignment }>,
  assignmentId: string,
  currentOp: Operator,
  gap: { gapStart: Date; gapEnd: Date },
  allOperators: Operator[],
): string | undefined {
  const entry = entries.find(e => e.id === assignmentId);
  if (!entry) return undefined;
  const otherOp = entry.assignment.operators?.find(o => {
    if (o.operatorId === currentOp.id) return false;
    if (!o.from || !o.to) return false;
    const opFrom = new Date(o.from).getTime();
    const opTo = new Date(o.to).getTime();
    return opFrom <= gap.gapEnd.getTime() && opTo >= gap.gapStart.getTime();
  });
  if (otherOp) {
    const op = allOperators.find(o => o.id === otherOp.operatorId);
    return op ? `→ ${op.firstName} ${op.lastName}` : undefined;
  }
  return undefined;
}

function mergeAdjacentSlices(slices: TileSlice[]): TileSlice[] {
  const merged: TileSlice[] = [];
  for (const s of slices) {
    const prev = merged.length > 0 ? merged[merged.length - 1] : null;
    if (prev
      && prev.assignmentId === s.assignmentId
      && prev.position === s.position
      && prev.to.getTime() === s.from.getTime()
    ) {
      prev.to = s.to;
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

/**
 * Compute tile slices for an operator column.
 * Two passes:
 *   1. Overlap segmentation: split at concurrency change points
 *   2. Gap segmentation: split at unavailability boundaries, add sawtooth edges
 */
export function computeTileSlices(
  assignments: TaskAssignment[],
  operator: Operator,
  allOperators: Operator[],
): TileSlice[] {
  if (assignments.length === 0) return [];

  // One TaskAssignment can list the same operator across multiple
  // non-contiguous `from/to` windows — e.g. an operator who launches
  // press A (11:00-11:15), runs press B in between, then comes back to A
  // (13:30-13:45) appears twice in A.operators. Earlier code used `find`
  // which dropped every entry past the first; the operator's column was
  // missing the late comeback and visually overlapped the side trip on
  // press B (which actually fits in the gap).
  // Fix: emit one `entry` per operator window, all sharing the same
  // assignment id but each with its own [startMs, endMs]. The downstream
  // boundary/overlap algorithm treats them as independent slices, so
  // adjacent windows naturally interleave with windows of other tasks
  // on the same operator without false overlaps.
  const entries = assignments.flatMap(a => {
    const assignStart = new Date(a.scheduledStart).getTime();
    const assignEnd = new Date(a.scheduledEnd).getTime();
    const opEntries = (a.operators ?? []).filter(o => o.operatorId === operator.id);
    if (opEntries.length === 0) {
      return [{
        id: a.id,
        taskId: a.taskId,
        startMs: assignStart,
        endMs: assignEnd,
        assignStartMs: assignStart,
        assignEndMs: assignEnd,
        relayBefore: false,
        relayAfter: false,
        isMasked: a.isMaskedTime ?? false,
        assignment: a,
      }];
    }
    return opEntries.map(opRef => {
      const opFrom = opRef.from ? new Date(opRef.from).getTime() : assignStart;
      const opTo = opRef.to ? new Date(opRef.to).getTime() : assignEnd;
      return {
        id: a.id,
        taskId: a.taskId,
        startMs: opFrom,
        endMs: opTo,
        assignStartMs: assignStart,
        assignEndMs: assignEnd,
        relayBefore: opFrom > assignStart + 30000,
        relayAfter: opTo < assignEnd - 30000,
        isMasked: a.isMaskedTime ?? false,
        assignment: a,
      };
    });
  });

  const boundarySet = new Set<number>();
  for (const e of entries) {
    boundarySet.add(e.startMs);
    boundarySet.add(e.endMs);
  }
  const boundaries = [...boundarySet].sort((a, b) => a - b);

  let rawSlices: TileSlice[] = [];

  for (let b = 0; b < boundaries.length - 1; b++) {
    const sliceStart = boundaries[b];
    const sliceEnd = boundaries[b + 1];
    if (sliceEnd - sliceStart < 30000) continue;

    const active = entries.filter(e => e.startMs < sliceEnd && e.endMs > sliceStart);
    if (active.length === 0) continue;

    if (active.length === 1) {
      rawSlices.push({
        assignmentId: active[0].id, taskId: active[0].taskId,
        from: new Date(sliceStart), to: new Date(sliceEnd),
        position: 'full', isMasked: active[0].isMasked,
        sawtoothTop: false, sawtoothBottom: false,
      });
    } else {
      const sorted = [...active].sort((x, y) =>
        x.isMasked === y.isMasked ? x.startMs - y.startMs : x.isMasked ? -1 : 1
      );
      for (let idx = 0; idx < sorted.length; idx++) {
        const a = sorted[idx];
        rawSlices.push({
          assignmentId: a.id, taskId: a.taskId,
          from: new Date(sliceStart), to: new Date(sliceEnd),
          position: idx === 0 ? 'left' : 'right', isMasked: a.isMasked,
          sawtoothTop: false, sawtoothBottom: false,
        });
      }
    }
  }

  rawSlices = mergeAdjacentSlices(rawSlices);

  const finalSlices: TileSlice[] = [];

  for (const slice of rawSlices) {
    // With multiple operator entries per assignment (interleaved windows),
    // we must pick the entry whose [startMs, endMs] window covers this
    // slice — not just any entry sharing the assignment id. Falling back
    // to id-only `find` would return the FIRST window, so a slice that
    // belongs to a later window would inherit the wrong startMs/endMs and
    // the relay-before/after detection would misfire.
    const sliceFromMs = slice.from.getTime();
    const sliceToMs = slice.to.getTime();
    const entry = entries.find(e =>
      e.id === slice.assignmentId &&
      e.startMs <= sliceFromMs + 30_000 &&
      e.endMs >= sliceToMs - 30_000,
    ) ?? entries.find(e => e.id === slice.assignmentId);
    const gaps = findOperatorGaps(operator, slice.from, slice.to);
    const ss = slice.from.getTime();
    const se = slice.to.getTime();
    const splittingGaps = gaps.filter(g => {
      const overlapStart = Math.max(g.gapStart.getTime(), ss);
      const overlapEnd = Math.min(g.gapEnd.getTime(), se);
      if (overlapEnd - overlapStart < 30000) return false;
      const hasWorkBefore = overlapStart - ss >= 30000;
      const hasWorkAfter = se - overlapEnd >= 30000;
      return hasWorkBefore || hasWorkAfter;
    });

    const atEntryStart = entry ? Math.abs(ss - entry.startMs) < 30000 : false;
    const atEntryEnd = entry ? Math.abs(se - entry.endMs) < 30000 : false;
    const relayBeforeActive = !!(entry?.relayBefore && atEntryStart);
    const relayAfterActive = !!(entry?.relayAfter && atEntryEnd);

    // Co-presence detection: another operator on the same assignment whose
    // interval overlaps with mine. The "→" arrow on a relay label implies a
    // handoff (other op left, I joined). When the other op stays alongside
    // me, that arrow is misleading — we work in parallel, not in sequence.
    // Sawtooth (the visual cue that I started mid-assignment) is still
    // meaningful and is rendered regardless; only the label is suppressed.
    const hasConcurrentOperator = (): boolean => {
      if (!entry) return false;
      for (const otherOp of (entry.assignment.operators ?? [])) {
        if (otherOp.operatorId === operator.id) continue;
        if (!otherOp.from || !otherOp.to) continue;
        const oFrom = new Date(otherOp.from).getTime();
        const oTo = new Date(otherOp.to).getTime();
        if (oFrom < entry.endMs && oTo > entry.startMs) return true;
      }
      return false;
    };

    const resolveRelayBeforeLabel = (): string | undefined => {
      if (!entry || !relayBeforeActive) return undefined;
      if (hasConcurrentOperator()) return undefined;
      if (slice.isMasked) return 'reprise →';
      const syntheticGap = { gapStart: new Date(entry.assignStartMs), gapEnd: new Date(entry.startMs) };
      const otherOp = findRelayOperator(entries, slice.assignmentId, operator, syntheticGap, allOperators);
      return otherOp ? otherOp.replace('→ ', '') + ' →' : 'reprise →';
    };

    const resolveRelayAfterLabel = (): string | undefined => {
      if (!entry || !relayAfterActive) return undefined;
      if (hasConcurrentOperator()) return undefined;
      if (slice.isMasked) return '→ pause';
      const syntheticGap = { gapStart: new Date(entry.endMs), gapEnd: new Date(entry.assignEndMs) };
      const otherOp = findRelayOperator(entries, slice.assignmentId, operator, syntheticGap, allOperators);
      return otherOp ?? '→ pause';
    };

    if (splittingGaps.length === 0) {
      if (relayBeforeActive || relayAfterActive) {
        finalSlices.push({
          ...slice,
          sawtoothTop: relayBeforeActive,
          sawtoothBottom: relayAfterActive,
          relayLabelTop: resolveRelayBeforeLabel(),
          relayLabelBottom: resolveRelayAfterLabel(),
        });
      } else {
        finalSlices.push(slice);
      }
      continue;
    }

    const tileStartsInGap = splittingGaps[0].gapStart.getTime() <= ss + 30000;
    const tileEndsInGap = splittingGaps[splittingGaps.length - 1].gapEnd.getTime() >= se - 30000;

    const segments: Array<{ start: Date; end: Date }> = [];
    let segStart = slice.from;
    for (const gap of splittingGaps) {
      if (gap.gapStart.getTime() > segStart.getTime() + 30000) {
        segments.push({ start: segStart, end: gap.gapStart });
      }
      segStart = gap.gapEnd;
    }
    if (slice.to.getTime() > segStart.getTime() + 30000) {
      segments.push({ start: segStart, end: slice.to });
    }
    if (segments.length === 0) {
      continue;
    }

    for (let i = 0; i < segments.length; i++) {
      const isFirst = i === 0;
      const isLast = i === segments.length - 1;
      let sawBottom = !isLast || tileEndsInGap;
      let sawTop = !isFirst || tileStartsInGap;

      let relayBottom: string | undefined;
      let relayTop: string | undefined;

      const gapOffset = tileStartsInGap ? 1 : 0;

      if (sawBottom && !isLast) {
        const gap = splittingGaps[i + gapOffset];
        if (gap) {
          const otherOp = slice.isMasked ? undefined : findRelayOperator(entries, slice.assignmentId, operator, gap, allOperators);
          relayBottom = otherOp ?? '→ pause';
        }
      }
      if (sawTop && !isFirst) {
        const gap = splittingGaps[i - 1 + gapOffset];
        if (gap) {
          const otherOp = slice.isMasked ? undefined : findRelayOperator(entries, slice.assignmentId, operator, gap, allOperators);
          relayTop = otherOp ? otherOp.replace('→ ', '') + ' →' : 'reprise →';
        }
      }
      if (isFirst && tileStartsInGap) {
        relayTop = 'reprise →';
      }
      if (isLast && tileEndsInGap) {
        relayBottom = '→ pause';
      }

      if (isFirst && relayBeforeActive) {
        sawTop = true;
        relayTop = relayTop ?? resolveRelayBeforeLabel();
      }
      if (isLast && relayAfterActive) {
        sawBottom = true;
        relayBottom = relayBottom ?? resolveRelayAfterLabel();
      }

      finalSlices.push({
        ...slice,
        from: segments[i].start,
        to: segments[i].end,
        sawtoothTop: sawTop,
        sawtoothBottom: sawBottom,
        relayLabelBottom: relayBottom,
        relayLabelTop: relayTop,
      });
    }
  }

  return finalSlices;
}
