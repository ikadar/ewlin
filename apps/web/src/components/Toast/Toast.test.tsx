/**
 * Tests for Toast component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Toast } from './Toast';

describe('Toast', () => {
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnDismiss.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders when visible', () => {
    render(
      <Toast message="Test message" isVisible={true} onDismiss={mockOnDismiss} />
    );

    expect(screen.getByTestId('toast')).toBeInTheDocument();
    expect(screen.getByTestId('toast-message')).toHaveTextContent('Test message');
  });

  it('does not render when not visible', () => {
    render(
      <Toast message="Test message" isVisible={false} onDismiss={mockOnDismiss} />
    );

    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('applies error styling by default', () => {
    render(
      <Toast message="Error" isVisible={true} onDismiss={mockOnDismiss} />
    );

    const content = screen.getByTestId('toast-content');
    expect(content).toHaveClass('bg-red-600');
  });

  it('applies success styling when type is success', () => {
    render(
      <Toast message="Success" type="success" isVisible={true} onDismiss={mockOnDismiss} />
    );

    const content = screen.getByTestId('toast-content');
    expect(content).toHaveClass('bg-green-600');
  });

  it('applies info styling when type is info', () => {
    render(
      <Toast message="Info" type="info" isVisible={true} onDismiss={mockOnDismiss} />
    );

    const content = screen.getByTestId('toast-content');
    expect(content).toHaveClass('bg-blue-600');
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    render(
      <Toast message="Test" isVisible={true} onDismiss={mockOnDismiss} />
    );

    fireEvent.click(screen.getByTestId('toast-dismiss'));
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after timeout', () => {
    render(
      <Toast message="Test" isVisible={true} onDismiss={mockOnDismiss} autoHideMs={3000} />
    );

    expect(mockOnDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not auto-dismiss when autoHideMs is 0', () => {
    render(
      <Toast message="Test" isVisible={true} onDismiss={mockOnDismiss} autoHideMs={0} />
    );

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(mockOnDismiss).not.toHaveBeenCalled();
  });

  it('has correct accessibility attributes', () => {
    render(
      <Toast message="Test" isVisible={true} onDismiss={mockOnDismiss} />
    );

    const toast = screen.getByTestId('toast');
    expect(toast).toHaveAttribute('role', 'alert');
    expect(toast).toHaveAttribute('aria-live', 'assertive');
  });

  it('dismiss button has French aria-label', () => {
    render(
      <Toast message="Test" isVisible={true} onDismiss={mockOnDismiss} />
    );

    const dismissButton = screen.getByTestId('toast-dismiss');
    expect(dismissButton).toHaveAttribute('aria-label', 'Fermer');
  });
});
