/**
 * Tests for MaintenanceState component
 *
 * @see docs/releases/v0.5.7-global-error-handling.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithRedux, createTestStore } from '../../test/testUtils';
import { Provider } from 'react-redux';
import { MaintenanceState } from './MaintenanceState';
import { setServiceUnavailable } from '../../store/slices/errorSlice';

describe('MaintenanceState', () => {
  const mockOnRetry = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnRetry.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders maintenance state UI', () => {
    renderWithRedux(<MaintenanceState onRetry={mockOnRetry} />);

    expect(screen.getByTestId('maintenance-state')).toBeInTheDocument();
    expect(screen.getByTestId('maintenance-title')).toHaveTextContent('Maintenance en cours');
  });

  it('displays French maintenance message', () => {
    renderWithRedux(<MaintenanceState onRetry={mockOnRetry} />);

    expect(screen.getByTestId('maintenance-message')).toHaveTextContent(
      'Le service est temporairement indisponible. Veuillez patienter quelques instants.'
    );
  });

  it('displays countdown timer', () => {
    renderWithRedux(<MaintenanceState onRetry={mockOnRetry} />);

    expect(screen.getByTestId('maintenance-countdown')).toHaveTextContent(
      'Nouvelle tentative dans 30 secondes...'
    );
  });

  it('countdown timer updates every second', () => {
    renderWithRedux(<MaintenanceState onRetry={mockOnRetry} />);

    expect(screen.getByTestId('maintenance-countdown')).toHaveTextContent('30 secondes');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('maintenance-countdown')).toHaveTextContent('29 secondes');
  });

  it('shows singular "seconde" when countdown is 1', () => {
    renderWithRedux(<MaintenanceState onRetry={mockOnRetry} />);

    act(() => {
      vi.advanceTimersByTime(29000); // Go to 1 second left
    });

    expect(screen.getByTestId('maintenance-countdown')).toHaveTextContent('1 seconde...');
  });

  it('has retry button with French text', () => {
    renderWithRedux(<MaintenanceState onRetry={mockOnRetry} />);

    expect(screen.getByTestId('maintenance-retry')).toHaveTextContent('Réessayer maintenant');
  });

  it('calls onRetry when retry button is clicked', () => {
    const store = createTestStore();
    store.dispatch(setServiceUnavailable(true));

    renderWithRedux(<MaintenanceState onRetry={mockOnRetry} />, {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    fireEvent.click(screen.getByTestId('maintenance-retry'));

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
    // Also check that service unavailable state is cleared
    expect(store.getState().error.isServiceUnavailable).toBe(false);
  });

  it('auto-retries when countdown reaches zero', () => {
    const store = createTestStore();
    store.dispatch(setServiceUnavailable(true));

    renderWithRedux(<MaintenanceState onRetry={mockOnRetry} />, {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    expect(mockOnRetry).not.toHaveBeenCalled();

    // Advance 30 seconds
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
    expect(store.getState().error.isServiceUnavailable).toBe(false);
  });

  it('has correct accessibility attributes', () => {
    renderWithRedux(<MaintenanceState onRetry={mockOnRetry} />);

    const maintenanceState = screen.getByTestId('maintenance-state');
    expect(maintenanceState).toHaveAttribute('role', 'alert');
  });
});
