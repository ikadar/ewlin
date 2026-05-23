/**
 * JS mirror of the PHP `PlateGateService::computeEarliestStart` rule.
 *
 * Simpler than paper/forme: no working-day logic, just a flat
 * calendar-hour offset from now.
 */
import type { Element, PlateLeadTimeConfig } from '@flux/types';

export function computePlateEarliestStart(
  element: Pick<Element, 'plateStatus'>,
  config: PlateLeadTimeConfig | undefined,
  now: Date = new Date(),
): Date | null {
  if (!config) return null;
  if (element.plateStatus === 'none' || element.plateStatus === 'ready') return null;
  return new Date(now.getTime() + config.offsetHours * 3_600_000);
}
