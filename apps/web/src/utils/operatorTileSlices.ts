import { getActiveScheduleForDate } from '@flux/types';
import type { DaySchedule, Operator, TaskAssignment } from '@flux/types';

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

/** Get the day schedule for an operator on a given date (rotating schedule only — absences are handled separately). */
export function getOperatorDaySchedule(operator: Operator, date: Date): DaySchedule {
  const activeSchedule = getActiveScheduleForDate(
    operator.operatingSchedules,
    operator.scheduleRotationReferenceWeek,
    date,
  );
  if (!activeSchedule) {
    return { isOperating: true, slots: [{ start: '00:00', end: '24:00' }] };
  }
  const dayName = DAY_NAMES[date.getDay()];
  return activeSchedule[dayName] ?? { isOperating: false, slots: [] };
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

  const entries = assignments.map(a => {
    const opRef = a.operators?.find(o => o.operatorId === operator.id);
    const assignStart = new Date(a.scheduledStart).getTime();
    const assignEnd = new Date(a.scheduledEnd).getTime();
    const opFrom = opRef?.from ? new Date(opRef.from).getTime() : assignStart;
    const opTo = opRef?.to ? new Date(opRef.to).getTime() : assignEnd;
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
    const entry = entries.find(e => e.id === slice.assignmentId);
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

    const resolveRelayBeforeLabel = (): string | undefined => {
      if (!entry || !relayBeforeActive) return undefined;
      if (slice.isMasked) return 'reprise →';
      const syntheticGap = { gapStart: new Date(entry.assignStartMs), gapEnd: new Date(entry.startMs) };
      const otherOp = findRelayOperator(entries, slice.assignmentId, operator, syntheticGap, allOperators);
      return otherOp ? otherOp.replace('→ ', '') + ' →' : 'reprise →';
    };

    const resolveRelayAfterLabel = (): string | undefined => {
      if (!entry || !relayAfterActive) return undefined;
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
