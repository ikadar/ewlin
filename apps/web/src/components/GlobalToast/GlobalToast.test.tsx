/**
 * Tests for GlobalToast component
 *
 * @see docs/releases/v0.5.7-global-error-handling.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderWithRedux, createTestStore } from '../../test/testUtils';
import { Provider } from 'react-redux';
import { GlobalToast } from './GlobalToast';
import { setError } from '../../store/slices/errorSlice';

describe('GlobalToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render when there is no error', () => {
    renderWithRedux(<GlobalToast />);

    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('renders when there is an error in Redux state', () => {
    const store = createTestStore();

    store.dispatch(
      setError({
        status: 500,
        message: 'Internal server error',
        isNetworkError: false,
        isValidationError: false,
      })
    );

    render(<Provider store={store}><GlobalToast /></Provider>);

    // GlobalToast should render the Toast component
    expect(screen.getByTestId('toast')).toBeInTheDocument();
    expect(screen.getByTestId('toast-message')).toHaveTextContent('Internal server error');
  });

  it('does not show toast for 409 validation errors', () => {
    const store = createTestStore();

    store.dispatch(
      setError({
        status: 409,
        message: 'Validation error',
        isNetworkError: false,
        isValidationError: true,
      })
    );

    render(<Provider store={store}><GlobalToast /></Provider>);

    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('does not show toast for 503 service unavailable', () => {
    const store = createTestStore();

    store.dispatch(
      setError({
        status: 503,
        message: 'Service unavailable',
        isNetworkError: false,
        isValidationError: false,
      })
    );

    render(<Provider store={store}><GlobalToast /></Provider>);

    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('clears error when toast is dismissed', () => {
    const store = createTestStore();

    store.dispatch(
      setError({
        status: 500,
        message: 'Server error',
        isNetworkError: false,
        isValidationError: false,
      })
    );

    render(<Provider store={store}><GlobalToast /></Provider>);

    // Click dismiss button
    fireEvent.click(screen.getByTestId('toast-dismiss'));

    // Error should be cleared in store
    expect(store.getState().error.currentError).toBeNull();
  });

  it('auto-dismisses after timeout', () => {
    const store = createTestStore();

    store.dispatch(
      setError({
        status: 500,
        message: 'Server error',
        isNetworkError: false,
        isValidationError: false,
      })
    );

    render(<Provider store={store}><GlobalToast /></Provider>);

    expect(screen.getByTestId('toast')).toBeInTheDocument();

    // Advance timers past the auto-hide timeout (5000ms)
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Error should be cleared in store
    expect(store.getState().error.currentError).toBeNull();
  });
});
