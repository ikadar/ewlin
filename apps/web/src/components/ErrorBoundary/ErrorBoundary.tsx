/**
 * ErrorBoundary Component
 *
 * React error boundary for catching render errors.
 * Displays a fallback UI when a child component throws an error.
 *
 * @see docs/releases/v0.5.7-global-error-handling.md
 */

import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component that catches JavaScript errors in child components.
 *
 * Must be a class component because React's error boundary API
 * (getDerivedStateFromError, componentDidCatch) is only available for classes.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Custom fallback provided
      if (fallback) {
        return fallback;
      }

      // Default fallback UI
      return (
        <div
          className="fixed inset-0 flex items-center justify-center bg-gray-50"
          data-testid="error-boundary"
          role="alert"
        >
          <div className="mx-4 max-w-lg rounded-lg bg-white p-6 shadow-lg">
            {/* Error Icon */}
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h2
              className="mb-2 text-center text-lg font-semibold text-gray-900"
              data-testid="error-boundary-title"
            >
              Une erreur est survenue
            </h2>

            {/* Error Message */}
            <p
              className="mb-4 text-center text-sm text-gray-600"
              data-testid="error-boundary-message"
            >
              L&apos;application a rencontré une erreur inattendue.
            </p>

            {/* Error Details (dev only) */}
            {import.meta.env.DEV && error && (
              <div className="mb-4 rounded bg-gray-100 p-3">
                <p className="text-xs font-mono text-gray-700" data-testid="error-boundary-details">
                  {error.message}
                </p>
              </div>
            )}

            {/* Reset Button */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                data-testid="error-boundary-reset"
              >
                Réessayer
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}
