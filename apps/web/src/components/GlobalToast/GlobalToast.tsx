/**
 * GlobalToast Component
 *
 * Connects to Redux error state and displays toast notifications
 * for API errors. Auto-dismisses after 5 seconds.
 *
 * @see docs/releases/v0.5.7-global-error-handling.md
 */

import { memo, useCallback } from 'react';
import { Toast } from '../Toast';
import { useAppSelector, useAppDispatch, selectCurrentError, clearError } from '../../store';

/**
 * Global toast notification connected to Redux error state.
 * Displays errors dispatched via setError action.
 */
export const GlobalToast = memo(function GlobalToast() {
  const dispatch = useAppDispatch();
  const currentError = useAppSelector(selectCurrentError);

  const handleDismiss = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  // Don't show toast for validation errors (409) - those should be inline
  // Don't show toast for 503 - MaintenanceState handles that
  const shouldShowToast =
    currentError &&
    currentError.status !== 409 &&
    currentError.status !== 503;

  return (
    <Toast
      message={currentError?.message ?? ''}
      type="error"
      isVisible={!!shouldShowToast}
      onDismiss={handleDismiss}
      autoHideMs={5000}
    />
  );
});
