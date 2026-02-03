/**
 * ErrorState Component
 *
 * Displays error message with retry button when API requests fail.
 * Text is in French to match the application's locale.
 *
 * @see docs/releases/v0.5.1-snapshot-loading.md
 */

import { memo, useCallback } from 'react';
import { getErrorMessage } from '../../store/api/errorNormalization';

interface ErrorStateProps {
  /** The error object from RTK Query */
  error: unknown;
  /** Callback to retry the failed request */
  onRetry: () => void;
  /** Optional title override */
  title?: string;
}

/**
 * A centered error state with message and retry button.
 * Used when API requests fail.
 */
export const ErrorState = memo(function ErrorState({
  error,
  onRetry,
  title = 'Erreur de chargement',
}: ErrorStateProps) {
  const errorMessage = getErrorMessage(error);

  const handleRetry = useCallback(() => {
    onRetry();
  }, [onRetry]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-gray-50"
      data-testid="error-state"
      role="alert"
    >
      <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-lg">
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
          data-testid="error-title"
        >
          {title}
        </h2>

        {/* Error Message */}
        <p
          className="mb-6 text-center text-sm text-gray-600"
          data-testid="error-message"
        >
          {errorMessage}
        </p>

        {/* Retry Button */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleRetry}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            data-testid="retry-button"
          >
            Réessayer
          </button>
        </div>
      </div>
    </div>
  );
});
