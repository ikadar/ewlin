/**
 * Tests for useToast hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from './useToast';

describe('useToast', () => {
  it('initializes with hidden state', () => {
    const { result } = renderHook(() => useToast());

    expect(result.current.toast.isVisible).toBe(false);
    expect(result.current.toast.message).toBe('');
    expect(result.current.toast.type).toBe('error');
  });

  it('shows toast with message', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test message');
    });

    expect(result.current.toast.isVisible).toBe(true);
    expect(result.current.toast.message).toBe('Test message');
    expect(result.current.toast.type).toBe('error');
  });

  it('shows toast with custom type', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Success!', 'success');
    });

    expect(result.current.toast.isVisible).toBe(true);
    expect(result.current.toast.message).toBe('Success!');
    expect(result.current.toast.type).toBe('success');
  });

  it('hides toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test message');
    });

    expect(result.current.toast.isVisible).toBe(true);

    act(() => {
      result.current.hideToast();
    });

    expect(result.current.toast.isVisible).toBe(false);
    // Message is preserved but not visible
    expect(result.current.toast.message).toBe('Test message');
  });

  it('can show multiple toasts in sequence', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('First');
    });
    expect(result.current.toast.message).toBe('First');

    act(() => {
      result.current.showToast('Second', 'info');
    });
    expect(result.current.toast.message).toBe('Second');
    expect(result.current.toast.type).toBe('info');
  });
});
