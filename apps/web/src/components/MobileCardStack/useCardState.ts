export type CardState = 'attente' | 'en-cours' | 'fin-proche' | 'grace';

const GRACE_DURATION_MS = 5 * 60 * 1000;

export function deriveCardState(
  scheduledStart: string,
  scheduledEnd: string,
  durationMin: number,
  now: Date,
  isCompleted: boolean,
): { state: CardState; inEndZone: boolean; thresholdMin: number } {
  const startMs = new Date(scheduledStart).getTime();
  const endMs = new Date(scheduledEnd).getTime();
  const nowMs = now.getTime();
  const thresholdMin = Math.max(5, Math.round(durationMin * 0.1));
  const thresholdMs = thresholdMin * 60 * 1000;

  if (isCompleted && nowMs < endMs + GRACE_DURATION_MS) {
    return { state: 'grace', inEndZone: false, thresholdMin };
  }

  if (nowMs < startMs) {
    return { state: 'attente', inEndZone: false, thresholdMin };
  }

  if (nowMs >= endMs) {
    return { state: 'grace', inEndZone: false, thresholdMin };
  }

  const inEndZone = nowMs >= endMs - thresholdMs;
  return {
    state: inEndZone ? 'fin-proche' : 'en-cours',
    inEndZone,
    thresholdMin,
  };
}
