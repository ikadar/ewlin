/**
 * Tests for LoadingSpinner component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with default message', () => {
    render(<LoadingSpinner />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByTestId('loading-message')).toHaveTextContent('Chargement...');
  });

  it('renders with custom message', () => {
    render(<LoadingSpinner message="Loading data..." />);

    expect(screen.getByTestId('loading-message')).toHaveTextContent('Loading data...');
  });

  it('has correct accessibility attributes', () => {
    render(<LoadingSpinner />);

    const container = screen.getByTestId('loading-spinner');
    expect(container).toHaveAttribute('role', 'status');
    expect(container).toHaveAttribute('aria-live', 'polite');
  });

  it('includes screen reader text', () => {
    render(<LoadingSpinner message="Loading..." />);

    // Screen reader text should be present (sr-only class hides it visually)
    // We check for the sr-only span specifically
    const srText = screen.getByRole('status').querySelector('.sr-only');
    expect(srText).toBeInTheDocument();
    expect(srText).toHaveTextContent('Loading...');
  });
});
