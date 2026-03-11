import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch } from '../store';
import { scheduleApi } from '../store/api/scheduleApi';
import { fluxApi } from '../store/api/fluxApi';
import { shouldUseMockMode } from '../store/api/baseApi';
import { isMercureMuted } from './mercureMute';

const MERCURE_URL = import.meta.env.VITE_MERCURE_URL ?? 'http://localhost:3000/.well-known/mercure';

export interface MercureSubscription {
  toastMessage: string | null;
  dismissToast: () => void;
}

/**
 * Subscribe to Mercure SSE updates for real-time schedule sync.
 *
 * When another client modifies the schedule, the Mercure Hub pushes
 * an SSE event. This hook invalidates RTK Query cache tags, triggering
 * automatic refetch of stale data.
 *
 * Features:
 * - Mute window: skips invalidation for the mutating client's own events
 * - Toast notification: shows "Planning mis à jour" for external updates
 *
 * Skips subscription in mock mode (no real backend).
 */
export function useMercureSubscription(): MercureSubscription {
  const dispatch = useAppDispatch();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const dismissToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  useEffect(() => {
    if (shouldUseMockMode()) {
      return;
    }

    const url = new URL(MERCURE_URL);
    url.searchParams.append('topic', 'schedule/updates');

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event: MessageEvent) => {
      try {
        JSON.parse(event.data) as { type: string };

        // Skip invalidation if this client just mutated (mute window active)
        if (isMercureMuted()) {
          return;
        }

        dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
        dispatch(fluxApi.util.invalidateTags(['FluxJobs']));
        setToastMessage('Planning mis à jour');
      } catch {
        // Ignore malformed messages
      }
    };

    eventSource.onerror = () => {
      // EventSource automatically reconnects with exponential backoff
      console.warn('[Mercure] Connection lost, reconnecting...');
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [dispatch]);

  return { toastMessage, dismissToast };
}
