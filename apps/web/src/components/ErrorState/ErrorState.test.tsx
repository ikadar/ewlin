/**
 * Tests for ErrorState component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  const mockOnRetry = vi.fn();

  beforeEach(() => {
    mockOnRetry.mockClear();
  });

  it('renders with default title', () => {
    render(<ErrorState error="Some error" onRetry={mockOnRetry} />);

    expect(screen.getByTestId('error-state')).toBeInTheDocument();
    expect(screen.getByTestId('error-title')).toHaveTextContent('Erreur de chargement');
  });

  it('renders with custom title', () => {
    render(
      <ErrorState error="Some error" onRetry={mockOnRetry} title="Custom Error" />
    );

    expect(screen.getByTestId('error-title')).toHaveTextContent('Custom Error');
  });

  it('displays error message from string', () => {
    render(<ErrorState error="Network error occurred" onRetry={mockOnRetry} />);

    expect(screen.getByTestId('error-message')).toHaveTextContent('Network error occurred');
  });

  it('displays error message from Error object', () => {
    const error = new Error('Connection failed');
    render(<ErrorState error={error} onRetry={mockOnRetry} />);

    expect(screen.getByTestId('error-message')).toHaveTextContent('Connection failed');
  });

  it('displays error message from RTK Query error format', () => {
    const error = { data: { message: 'Server unavailable' } };
    render(<ErrorState error={error} onRetry={mockOnRetry} />);

    expect(screen.getByTestId('error-message')).toHaveTextContent('Server unavailable');
  });

  it('calls onRetry when retry button is clicked', () => {
    render(<ErrorState error="Some error" onRetry={mockOnRetry} />);

    const retryButton = screen.getByTestId('retry-button');
    fireEvent.click(retryButton);

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('has French text for retry button', () => {
    render(<ErrorState error="Some error" onRetry={mockOnRetry} />);

    expect(screen.getByTestId('retry-button')).toHaveTextContent('Réessayer');
  });

  it('has correct accessibility attributes', () => {
    render(<ErrorState error="Some error" onRetry={mockOnRetry} />);

    const container = screen.getByTestId('error-state');
    expect(container).toHaveAttribute('role', 'alert');
  });
});
