/**
 * LoadingSpinner Component
 *
 * Full-screen centered loading spinner for initial data fetch.
 *
 * @see docs/releases/v0.5.1-snapshot-loading.md
 */

import { memo } from 'react';

interface LoadingSpinnerProps {
  /** Optional message to display below the spinner */
  message?: string;
}

/**
 * A centered loading spinner with optional message.
 * Used during initial data loading from the API.
 */
export const LoadingSpinner = memo(function LoadingSpinner({
  message = 'Chargement...',
}: LoadingSpinnerProps) {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-gray-50"
      data-testid="loading-spinner"
      role="status"
      aria-live="polite"
    >
      {/* Spinner */}
      <div
        className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"
        aria-hidden="true"
      />

      {/* Message */}
      {message && (
        <p className="mt-4 text-sm text-gray-600" data-testid="loading-message">
          {message}
        </p>
      )}

      {/* Screen reader text */}
      <span className="sr-only">{message}</span>
    </div>
  );
});
