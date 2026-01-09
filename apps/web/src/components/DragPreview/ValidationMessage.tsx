/**
 * ValidationMessage - Tooltip showing validation conflict message during drag
 * v0.3.52: Human-Readable Validation Messages (REQ-07)
 */

export interface ValidationMessageProps {
  /** The validation message to display (French) */
  message: string;
}

/**
 * Renders a validation message tooltip below the drag preview.
 * Uses red/warning styling to indicate invalid drop position.
 */
export function ValidationMessage({ message }: ValidationMessageProps) {
  return (
    <div
      className="mt-2 px-3 py-2 bg-red-950/95 border border-red-500/50 rounded-md shadow-lg backdrop-blur-sm"
      data-testid="validation-message"
    >
      <div className="flex items-center gap-2">
        {/* Warning icon */}
        <svg
          className="w-4 h-4 text-red-400 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        {/* Message text */}
        <span className="text-sm text-red-200 font-medium">
          {message}
        </span>
      </div>
    </div>
  );
}
