import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNow } from './useNow';

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the current time on first render', () => {
    const { result } = renderHook(() => useNow());
    expect(result.current.getTime()).toBe(new Date('2026-05-01T10:00:00Z').getTime());
  });

  it('updates after the configured interval', () => {
    const { result } = renderHook(() => useNow(60_000));

    // advanceTimersByTime advances the fake clock AND fires due timers in one step.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.getTime()).toBe(new Date('2026-05-01T10:01:00Z').getTime());
  });

  it('respects a smaller interval', () => {
    const { result } = renderHook(() => useNow(1_000));

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(result.current.getTime()).toBe(new Date('2026-05-01T10:00:01Z').getTime());
  });

  it('clears the interval on unmount', () => {
    const { unmount } = renderHook(() => useNow(60_000));
    const clearSpy = vi.spyOn(window, 'clearInterval');
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});
