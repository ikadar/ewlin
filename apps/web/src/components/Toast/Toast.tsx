/**
 * Toast Component
 *
 * Simple toast notification for displaying error messages.
 * Positioned at bottom-right of the screen.
 *
 * @see docs/releases/v0.5.2-assignment-operations.md
 */

import { memo, useEffect } from 'react';

export type ToastType = 'error' | 'success' | 'info';

export interface ToastProps {
  /** The message to display */
  message: string;
  /** The type of toast (affects styling) */
  type?: ToastType;
  /** Whether the toast is visible */
  isVisible: boolean;
  /** Callback when toast should be dismissed */
  onDismiss: () => void;
  /** Auto-dismiss timeout in ms (0 = no auto-dismiss) */
  autoHideMs?: number;
}

const typeStyles: Record<ToastType, string> = {
  error: 'bg-red-600 text-white',
  success: 'bg-green-600 text-white',
  info: 'bg-blue-600 text-white',
};

/**
 * A toast notification component.
 * Shows a message that auto-dismisses after a timeout.
 */
export const Toast = memo(function Toast({
  message,
  type = 'error',
  isVisible,
  onDismiss,
  autoHideMs = 5000,
}: ToastProps) {
  // Auto-dismiss after timeout
  useEffect(() => {
    if (!isVisible || autoHideMs === 0) return;

    const timer = setTimeout(() => {
      onDismiss();
    }, autoHideMs);

    return () => clearTimeout(timer);
  }, [isVisible, autoHideMs, onDismiss]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300"
      data-testid="toast"
      role="alert"
      aria-live="assertive"
    >
      <div
        className={`flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg ${typeStyles[type]}`}
        data-testid="toast-content"
      >
        {/* Icon based on type */}
        {type === 'error' && (
          <svg
            className="h-5 w-5 flex-shrink-0"
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
        )}
        {type === 'success' && (
          <svg
            className="h-5 w-5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
        {type === 'info' && (
          <svg
            className="h-5 w-5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )}

        {/* Message */}
        <span className="text-sm font-medium" data-testid="toast-message">
          {message}
        </span>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={onDismiss}
          className="ml-2 rounded p-1 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
          data-testid="toast-dismiss"
          aria-label="Fermer"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
});
