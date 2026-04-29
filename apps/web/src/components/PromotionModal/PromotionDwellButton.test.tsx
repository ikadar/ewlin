import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PromotionDwellButton } from './PromotionDwellButton';

describe('PromotionDwellButton', () => {
  it('does not fire onConfirmed if released before 1.2s', () => {
    vi.useFakeTimers();
    const onConfirmed = vi.fn();
    render(<PromotionDwellButton onConfirmed={onConfirmed} />);
    const btn = screen.getByTestId('promotion-dwell-button');

    fireEvent.mouseDown(btn);
    act(() => { vi.advanceTimersByTime(800); });
    fireEvent.mouseUp(btn);
    act(() => { vi.advanceTimersByTime(2000); });

    expect(onConfirmed).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('fires onConfirmed after 1.2s hold', () => {
    vi.useFakeTimers();
    const onConfirmed = vi.fn();
    render(<PromotionDwellButton onConfirmed={onConfirmed} />);
    const btn = screen.getByTestId('promotion-dwell-button');

    fireEvent.mouseDown(btn);
    act(() => { vi.advanceTimersByTime(1300); });

    expect(onConfirmed).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('does not fire when disabled', () => {
    vi.useFakeTimers();
    const onConfirmed = vi.fn();
    render(<PromotionDwellButton onConfirmed={onConfirmed} disabled />);
    const btn = screen.getByTestId('promotion-dwell-button');

    fireEvent.mouseDown(btn);
    act(() => { vi.advanceTimersByTime(2000); });

    expect(onConfirmed).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('cancels when mouse leaves the button', () => {
    vi.useFakeTimers();
    const onConfirmed = vi.fn();
    render(<PromotionDwellButton onConfirmed={onConfirmed} />);
    const btn = screen.getByTestId('promotion-dwell-button');

    fireEvent.mouseDown(btn);
    act(() => { vi.advanceTimersByTime(600); });
    fireEvent.mouseLeave(btn);
    act(() => { vi.advanceTimersByTime(2000); });

    expect(onConfirmed).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
