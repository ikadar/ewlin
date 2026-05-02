/**
 * JS mirror of the PHP `FormeGateService::computeEarliestStart` rule.
 *
 * Same shape as `paperGate.ts` — kept as a parallel module rather than a
 * shared generic so future divergence in either gate doesn't cascade.
 */
import type { Element, FormeLeadTimeConfig } from '@flux/types';

function addWorkingDays(from: Date, workingDays: number): Date {
  if (workingDays <= 0) return new Date(from);
  const cursor = new Date(from);
  cursor.setDate(cursor.getDate() + 1);
  cursor.setHours(0, 0, 0, 0);
  let remaining = workingDays;
  for (let safety = 0; safety < 365; safety++) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      remaining--;
      if (remaining === 0) return cursor;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return cursor;
}

function resolveProcessingDay(reference: Date, cutoffHour: number): Date {
  const dow = reference.getDay();
  const isWorkingDay = dow !== 0 && dow !== 6;
  const beforeCutoff = reference.getHours() < cutoffHour;
  if (isWorkingDay && beforeCutoff) return new Date(reference);
  return addWorkingDays(reference, 1);
}

export function computeFormeEarliestStart(
  element: Pick<Element, 'formeStatus' | 'formeOrderedAt'>,
  config: FormeLeadTimeConfig | undefined,
  now: Date = new Date(),
): Date | null {
  if (!config) return null;
  if (
    element.formeStatus === 'none'
    || element.formeStatus === 'in_stock'
    || element.formeStatus === 'delivered'
  ) {
    return null;
  }
  const reference = element.formeStatus === 'ordered' && element.formeOrderedAt
    ? new Date(element.formeOrderedAt)
    : now;
  const processingDay = resolveProcessingDay(reference, config.cutoffHour);
  const earliest = addWorkingDays(processingDay, config.offsetWorkingDays);
  earliest.setHours(config.arrivalHour, 0, 0, 0);
  return earliest;
}
