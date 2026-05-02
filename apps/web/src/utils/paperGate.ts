/**
 * JS mirror of the PHP `PaperGateService::computeEarliestStart` rule.
 *
 * Kept in sync deliberately (small surface, pure logic) so the JDP tooltip
 * displays the same date the engine will actually enforce. Backend stays
 * the source of truth: this only computes the display date.
 */
import type { Element, PaperLeadTimeConfig } from '@flux/types';

/**
 * First working day strictly after `from`. Mirrors
 * `WorkingHoursService::addWorkingDays` with `workingDays >= 1`. For
 * `workingDays === 0` returns `from` unchanged (matches PHP semantics).
 */
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

/**
 * Returns `null` when the gate is off (paper ready or config missing),
 * else the wall-clock instant at which the supplier guarantees the paper
 * is on hand for this element.
 */
export function computePaperEarliestStart(
  element: Pick<Element, 'paperStatus' | 'paperOrderedAt'>,
  config: PaperLeadTimeConfig | undefined,
  now: Date = new Date(),
): Date | null {
  if (!config) return null;
  if (element.paperStatus === 'none' || element.paperStatus === 'in_stock' || element.paperStatus === 'delivered') {
    return null;
  }
  const reference = element.paperStatus === 'ordered' && element.paperOrderedAt
    ? new Date(element.paperOrderedAt)
    : now;
  const processingDay = resolveProcessingDay(reference, config.cutoffHour);
  const earliest = addWorkingDays(processingDay, config.offsetWorkingDays);
  earliest.setHours(config.arrivalHour, 0, 0, 0);
  return earliest;
}
