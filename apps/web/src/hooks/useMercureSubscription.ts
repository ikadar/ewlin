import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch } from '../store';
import { scheduleApi } from '../store/api/scheduleApi';
import { fluxApi } from '../store/api/fluxApi';
import { shouldUseMockMode } from '../store/api/baseApi';
import { isMercureMuted } from './mercureMute';

const MERCURE_URL = import.meta.env.VITE_MERCURE_URL ?? '/.well-known/mercure';
const PROGRESS_TOAST_DEBOUNCE_MS = 3_000;

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
  const progressBatchRef = useRef<{ count: number; userName: string | null }>({ count: 0, userName: null });
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  useEffect(() => {
    if (shouldUseMockMode()) {
      return;
    }

    const url = new URL(MERCURE_URL, window.location.origin);
    url.searchParams.append('topic', 'schedule/updates');

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as {
          type: string;
          reference?: string;
          userName?: string;
          progressPct?: number;
        };

        if (isMercureMuted()) {
          return;
        }

        dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
        dispatch(fluxApi.util.invalidateTags(['FluxJobs']));

        if (payload.type === 'TaskProgressRecorded') {
          progressBatchRef.current.count++;
          progressBatchRef.current.userName = payload.userName ?? null;
          if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
          progressTimerRef.current = setTimeout(() => {
            const { count, userName } = progressBatchRef.current;
            progressBatchRef.current = { count: 0, userName: null };
            if (count > 0 && userName) {
              setToastMessage(
                count === 1
                  ? `Avancement enregistré par ${userName}`
                  : `Avancement enregistré par ${userName} (${count} tâches)`,
              );
            }
          }, PROGRESS_TOAST_DEBOUNCE_MS);
          return;
        }

        if (payload.type === 'JobBecamePlannable' && payload.reference) {
          setToastMessage(`+1 nouveau job ajouté à la préprod : ${payload.reference}`);
        } else {
          setToastMessage('Données mises à jour (externe)');
        }
      } catch {
        // Ignore malformed messages
      }
    };

    eventSource.onerror = () => {
      console.warn('[Mercure] Connection lost, reconnecting...');
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    };
  }, [dispatch]);

  return { toastMessage, dismissToast };
}
