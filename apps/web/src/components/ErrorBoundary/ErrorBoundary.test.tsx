/**
 * Tests for ErrorBoundary component
 *
 * @see docs/releases/v0.5.7-global-error-handling.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

// Component that throws an error for testing
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div data-testid="child-content">Child content</div>;
}

describe('ErrorBoundary', () => {
  // Suppress console.error for expected errors in tests
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
  });

  it('renders fallback UI when child throws error', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();
  });

  it('displays French error title', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('error-boundary-title')).toHaveTextContent(
      'Une erreur est survenue'
    );
  });

  it('displays French error message', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('error-boundary-message')).toHaveTextContent(
      "L'application a rencontré une erreur inattendue."
    );
  });

  it('has reset button with French text', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('error-boundary-reset')).toHaveTextContent('Réessayer');
  });

  it('clears error state when reset button is clicked', () => {
    // Create a controllable component
    let shouldThrow = true;

    function ControllableComponent() {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <div data-testid="recovered-content">Recovered</div>;
    }

    render(
      <ErrorBoundary key="test-boundary">
        <ControllableComponent />
      </ErrorBoundary>
    );

    // Verify error state
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();

    // Change the throwing behavior before clicking reset
    shouldThrow = false;

    // Click reset - this clears the internal error state
    fireEvent.click(screen.getByTestId('error-boundary-reset'));

    // After reset, the ErrorBoundary should try to render children again
    // Since shouldThrow is now false, the component should render successfully
    expect(screen.getByTestId('recovered-content')).toBeInTheDocument();
    expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    const customFallback = <div data-testid="custom-fallback">Custom fallback</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
  });

  it('has correct accessibility attributes', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    const errorBoundary = screen.getByTestId('error-boundary');
    expect(errorBoundary).toHaveAttribute('role', 'alert');
  });
});
