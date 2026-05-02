/**
 * Time + volume helpers shared by Tile (station grid) and TileSegment
 * (operator column / focus). They derive the props the saisie modal +
 * VolumeGauge consume from a raw assignment.
 */

export function isoToMinFromMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function applyMinToDate(baseIso: string, minutesFromMidnight: number): string {
  const base = new Date(baseIso);
  const result = new Date(base);
  result.setHours(0, 0, 0, 0);
  result.setMinutes(minutesFromMidnight);
  return result.toISOString();
}

/**
 * Volume already delivered by this slot at `now`, in job-percentage units.
 * Calage-aware: only the run portion contributes (cf. project_calage_run_ratio).
 */
export function computeExpectedAtNowPct(
  scheduledStart: string,
  scheduledEnd: string,
  setupMin: number,
  runMin: number,
  nowMs: number,
  slotVolumePct: number,
): number {
  const startMs = new Date(scheduledStart).getTime();
  const setupEndMs = startMs + setupMin * 60_000;
  if (nowMs <= setupEndMs) return 0;
  const endMs = new Date(scheduledEnd).getTime();
  if (nowMs >= endMs) return slotVolumePct;
  if (runMin === 0) return slotVolumePct;
  const runElapsedMin = (nowMs - setupEndMs) / 60_000;
  return Math.min(slotVolumePct, (runElapsedMin / runMin) * slotVolumePct);
}
