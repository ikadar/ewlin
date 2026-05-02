import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { TaskAssignment } from '@flux/types';
import { useProgressTriggers } from './useProgressTriggers';

function makeAssignment(overrides: Partial<TaskAssignment>): TaskAssignment {
  return {
    id: 'a-1',
    taskId: 't-1',
    targetId: 's-1',
    isOutsourced: false,
    scheduledStart: '2026-05-01T09:30:00Z',
    scheduledEnd:   '2026-05-01T12:00:00Z',
    isCompleted: false,
    completedAt: null,
    isPinned: false,
    pinnedAt: null,
    createdAt: '2026-05-01T08:00:00Z',
    updatedAt: '2026-05-01T08:00:00Z',
    ...overrides,
  };
}

describe('useProgressTriggers', () => {
  it('skips completed assignments', () => {
    const a = makeAssignment({ isCompleted: true });
    const { result } = renderHook(() =>
      useProgressTriggers([a], new Date('2026-05-01T10:30:00Z')),
    );
    expect(result.current).toEqual({});
  });

  it('skips assignments that have not started yet', () => {
    const a = makeAssignment();
    const { result } = renderHook(() =>
      useProgressTriggers([a], new Date('2026-05-01T09:00:00Z')),
    );
    expect(result.current).toEqual({});
  });

  it('marks tile-end when now >= scheduledEnd', () => {
    const a = makeAssignment({ taskId: 't-1' });
    const { result } = renderHook(() =>
      useProgressTriggers([a], new Date('2026-05-01T12:00:00Z')),
    );
    expect(result.current['t-1']).toBe('tile-end');
  });

  it('marks tile-end when now is past scheduledEnd', () => {
    const a = makeAssignment({ taskId: 't-1' });
    const { result } = renderHook(() =>
      useProgressTriggers([a], new Date('2026-05-01T13:00:00Z')),
    );
    expect(result.current['t-1']).toBe('tile-end');
  });

  it('marks hourly when now is just after an hour mark and no recent saisie', () => {
    const a = makeAssignment({ taskId: 't-1' });
    const { result } = renderHook(() =>
      useProgressTriggers([a], new Date('2026-05-01T10:02:00Z')),
    );
    expect(result.current['t-1']).toBe('hourly');
  });

  it('marks inactive after the hourly window ends', () => {
    const a = makeAssignment({ taskId: 't-1' });
    // 10:30 is past the default 5-minute hourly window
    const { result } = renderHook(() =>
      useProgressTriggers([a], new Date('2026-05-01T10:30:00Z')),
    );
    expect(result.current['t-1']).toBe('inactive');
  });

  it('suppresses hourly within the debounce window after a recent saisie', () => {
    const a = makeAssignment({ taskId: 't-1' });
    const recentSaisie = { 't-1': new Date('2026-05-01T09:50:00Z') };
    // Now = 10:02 → within hourly window. Last saisie = 09:50 → 12 min ago, < 30 min debounce.
    const { result } = renderHook(() =>
      useProgressTriggers([a], new Date('2026-05-01T10:02:00Z'), recentSaisie),
    );
    expect(result.current['t-1']).toBe('inactive');
  });

  it('re-triggers hourly once the debounce window has passed', () => {
    const a = makeAssignment({ taskId: 't-1' });
    const oldSaisie = { 't-1': new Date('2026-05-01T09:00:00Z') };
    // Now = 10:02 → within hourly window. Last saisie = 09:00 → 62 min ago, > 30 min debounce.
    const { result } = renderHook(() =>
      useProgressTriggers([a], new Date('2026-05-01T10:02:00Z'), oldSaisie),
    );
    expect(result.current['t-1']).toBe('hourly');
  });

  it('handles multiple in-progress assignments independently', () => {
    const a1 = makeAssignment({ taskId: 't-1', scheduledEnd: '2026-05-01T12:00:00Z' });
    const a2 = makeAssignment({ id: 'a-2', taskId: 't-2', scheduledEnd: '2026-05-01T10:00:00Z' });
    const { result } = renderHook(() =>
      useProgressTriggers([a1, a2], new Date('2026-05-01T10:30:00Z')),
    );
    // a1 is in-progress mid-slot → inactive (past hourly window)
    expect(result.current['t-1']).toBe('inactive');
    // a2 is past its scheduled end → tile-end
    expect(result.current['t-2']).toBe('tile-end');
  });

  it('respects a custom hourlyWindowMs option', () => {
    const a = makeAssignment({ taskId: 't-1' });
    // With a 1-minute window, 10:02 is no longer in the window
    const { result } = renderHook(() =>
      useProgressTriggers([a], new Date('2026-05-01T10:02:00Z'), {}, { hourlyWindowMs: 60_000 }),
    );
    expect(result.current['t-1']).toBe('inactive');
  });

  it('respects a custom debounceMs option', () => {
    const a = makeAssignment({ taskId: 't-1' });
    const saisie = { 't-1': new Date('2026-05-01T09:50:00Z') };
    // Now = 10:02 → 12 min after saisie. With debounce = 5 min, no longer suppressed.
    const { result } = renderHook(() =>
      useProgressTriggers([a], new Date('2026-05-01T10:02:00Z'), saisie, { debounceMs: 5 * 60_000 }),
    );
    expect(result.current['t-1']).toBe('hourly');
  });
});
