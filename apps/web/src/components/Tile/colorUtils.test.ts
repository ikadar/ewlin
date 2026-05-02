import { describe, it, expect } from 'vitest';
import { isCompletedEffective } from './colorUtils';

describe('isCompletedEffective (V2 derived auto-completion)', () => {
  const NOW = new Date('2026-05-01T12:00:00Z').getTime();

  it('returns true when isCompleted is already true (legacy explicit flag)', () => {
    expect(isCompletedEffective(true, '2026-05-01T13:00:00Z', NOW)).toBe(true);
  });

  it('returns true when scheduledEnd is past now (no-news = good-news)', () => {
    expect(isCompletedEffective(false, '2026-05-01T11:00:00Z', NOW)).toBe(true);
  });

  it('returns false when scheduledEnd is in the future and isCompleted is false', () => {
    expect(isCompletedEffective(false, '2026-05-01T13:00:00Z', NOW)).toBe(false);
  });

  it('returns false when scheduledEnd equals now (boundary — strict <)', () => {
    expect(isCompletedEffective(false, '2026-05-01T12:00:00Z', NOW)).toBe(false);
  });

  it('returns true when explicit isCompleted overrides a future scheduledEnd', () => {
    expect(isCompletedEffective(true, '2026-05-01T13:00:00Z', NOW)).toBe(true);
  });
});
