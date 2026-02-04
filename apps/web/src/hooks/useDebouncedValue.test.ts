/**
 * Tests for useDebouncedValue hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('test', 300));

    expect(result.current).toBe('test');
  });

  it('updates value after delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'initial' } }
    );

    expect(result.current).toBe('initial');

    // Change the value
    rerender({ value: 'updated' });

    // Value should still be initial before delay
    expect(result.current).toBe('initial');

    // Advance time past the delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Now value should be updated
    expect(result.current).toBe('updated');
  });

  it('resets timer on rapid value changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'a' } }
    );

    // Rapid changes
    rerender({ value: 'ab' });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: 'abc' });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: 'abcd' });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Value should still be 'a' because timer keeps resetting
    expect(result.current).toBe('a');

    // Advance past delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Now should have the final value
    expect(result.current).toBe('abcd');
  });

  it('uses default delay of 300ms', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });

    // Should not update before 300ms
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe('initial');

    // Should update at 300ms
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('updated');
  });

  it('works with different types', () => {
    // Number
    const { result: numResult } = renderHook(() => useDebouncedValue(42, 300));
    expect(numResult.current).toBe(42);

    // Object
    const obj = { foo: 'bar' };
    const { result: objResult } = renderHook(() => useDebouncedValue(obj, 300));
    expect(objResult.current).toEqual({ foo: 'bar' });

    // Array
    const arr = [1, 2, 3];
    const { result: arrResult } = renderHook(() => useDebouncedValue(arr, 300));
    expect(arrResult.current).toEqual([1, 2, 3]);
  });

  it('cleans up timer on unmount', () => {
    const { unmount } = renderHook(() => useDebouncedValue('test', 300));

    // Should not throw when unmounting
    expect(() => unmount()).not.toThrow();
  });
});
