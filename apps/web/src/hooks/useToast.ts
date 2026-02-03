/**
 * useToast Hook
 *
 * Manages toast notification state.
 *
 * @see docs/releases/v0.5.2-assignment-operations.md
 */

import { useState, useCallback } from 'react';
import type { ToastType } from '../components/Toast';

interface ToastState {
  isVisible: boolean;
  message: string;
  type: ToastType;
}

interface UseToastReturn {
  /** Current toast state */
  toast: ToastState;
  /** Show a toast with the given message and type */
  showToast: (message: string, type?: ToastType) => void;
  /** Hide the current toast */
  hideToast: () => void;
}

/**
 * Hook for managing toast notification state.
 *
 * @example
 * ```tsx
 * const { toast, showToast, hideToast } = useToast();
 *
 * // Show error
 * showToast('Erreur de planification', 'error');
 *
 * // In render
 * <Toast {...toast} onDismiss={hideToast} />
 * ```
 */
export function useToast(): UseToastReturn {
  const [toast, setToast] = useState<ToastState>({
    isVisible: false,
    message: '',
    type: 'error',
  });

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    setToast({
      isVisible: true,
      message,
      type,
    });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({
      ...prev,
      isVisible: false,
    }));
  }, []);

  return {
    toast,
    showToast,
    hideToast,
  };
}
