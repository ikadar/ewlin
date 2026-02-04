/**
 * MaintenanceState Component
 *
 * Displays a maintenance message when the API returns 503 Service Unavailable.
 * Shows a friendly message and auto-retries after a delay.
 *
 * @see docs/releases/v0.5.7-global-error-handling.md
 */

import { memo, useCallback, useEffect, useState } from 'react';
import { useAppDispatch, setServiceUnavailable } from '../../store';

interface MaintenanceStateProps {
  /** Callback to retry the failed request */
  onRetry?: () => void;
}

/**
 * A centered maintenance state with countdown and retry button.
 * Displayed when API returns 503 Service Unavailable.
 */
export const MaintenanceState = memo(function MaintenanceState({ onRetry }: MaintenanceStateProps) {
  const dispatch = useAppDispatch();
  const [countdown, setCountdown] = useState(30);

  // Auto-retry countdown
  useEffect(() => {
    if (countdown <= 0) {
      dispatch(setServiceUnavailable(false));
      onRetry?.();
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, dispatch, onRetry]);

  const handleRetry = useCallback(() => {
    dispatch(setServiceUnavailable(false));
    onRetry?.();
  }, [dispatch, onRetry]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-gray-50"
      data-testid="maintenance-state"
      role="alert"
    >
      <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-lg">
        {/* Maintenance Icon */}
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <svg
              className="h-6 w-6 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2
          className="mb-2 text-center text-lg font-semibold text-gray-900"
          data-testid="maintenance-title"
        >
          Maintenance en cours
        </h2>

        {/* Message */}
        <p
          className="mb-4 text-center text-sm text-gray-600"
          data-testid="maintenance-message"
        >
          Le service est temporairement indisponible. Veuillez patienter quelques instants.
        </p>

        {/* Countdown */}
        <p className="mb-6 text-center text-xs text-gray-500" data-testid="maintenance-countdown">
          Nouvelle tentative dans {countdown} seconde{countdown !== 1 ? 's' : ''}...
        </p>

        {/* Retry Button */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleRetry}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            data-testid="maintenance-retry"
          >
            Réessayer maintenant
          </button>
        </div>
      </div>
    </div>
  );
});
