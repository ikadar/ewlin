/**
 * useToast — thin facade over the unified compute toaster.
 *
 * Routes the legacy `showToast(message, type?)` API through the
 * top-right ComputeToastStack so the app has a single notification
 * surface (no more bottom-right blocks clashing with the FAB).
 *
 * Must be called below <AutoRecomputeProvider> (mounted in RootLayout).
 */

import { useCallback } from 'react';
import { useAutoRecomputeCtx } from '../contexts/AutoRecomputeContext';

export type ToastType = 'info' | 'success' | 'error';

interface UseToastReturn {
  showToast: (message: string, type?: ToastType) => void;
}

export function useToast(): UseToastReturn {
  const { showToast: emit } = useAutoRecomputeCtx();
  const showToast = useCallback(
    (message: string, type: ToastType = 'error') => {
      emit({ type, title: message });
    },
    [emit],
  );
  return { showToast };
}
