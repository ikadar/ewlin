import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTooltipDelay } from './useTooltipDelay';

describe('useTooltipDelay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts hidden', () => {
    const { result } = renderHook(() => useTooltipDelay());
    expect(result.current.isVisible).toBe(false);
  });

  it('shows after default 500ms delay', () => {
    const { result } = renderHook(() => useTooltipDelay());

    act(() => result.current.onMouseEnter());
    expect(result.current.isVisible).toBe(false);

    act(() => vi.advanceTimersByTime(500));
    expect(result.current.isVisible).toBe(true);
  });

  it('hides immediately on mouse leave by default', () => {
    const { result } = renderHook(() => useTooltipDelay());

    act(() => result.current.onMouseEnter());
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.isVisible).toBe(true);

    act(() => result.current.onMouseLeave());
    expect(result.current.isVisible).toBe(false);
  });

  it('respects custom showDelay', () => {
    const { result } = renderHook(() => useTooltipDelay({ showDelay: 200 }));

    act(() => result.current.onMouseEnter());
    act(() => vi.advanceTimersByTime(199));
    expect(result.current.isVisible).toBe(false);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.isVisible).toBe(true);
  });

  it('respects custom hideDelay', () => {
    const { result } = renderHook(() => useTooltipDelay({ hideDelay: 100 }));

    act(() => result.current.onMouseEnter());
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.isVisible).toBe(true);

    act(() => result.current.onMouseLeave());
    expect(result.current.isVisible).toBe(true);

    act(() => vi.advanceTimersByTime(100));
    expect(result.current.isVisible).toBe(false);
  });

  it('cancels show if mouse leaves before delay', () => {
    const { result } = renderHook(() => useTooltipDelay());

    act(() => result.current.onMouseEnter());
    act(() => vi.advanceTimersByTime(300));
    act(() => result.current.onMouseLeave());
    act(() => vi.advanceTimersByTime(300));

    expect(result.current.isVisible).toBe(false);
  });

  it('cancels hide if mouse re-enters during hideDelay', () => {
    const { result } = renderHook(() => useTooltipDelay({ hideDelay: 100 }));

    act(() => result.current.onMouseEnter());
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.isVisible).toBe(true);

    act(() => result.current.onMouseLeave());
    act(() => vi.advanceTimersByTime(50));
    act(() => result.current.onMouseEnter());
    act(() => vi.advanceTimersByTime(100));

    expect(result.current.isVisible).toBe(true);
  });
});
