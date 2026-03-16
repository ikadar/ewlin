import { useState, useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { selectAuthToken, scheduleApi } from '../store';

export type PlacementStrategy = 'edd' | 'cr' | 'dynamic_cr';

export interface AutoPlaceProgress {
  type: 'progress' | 'complete' | 'error';
  jobIndex: number;
  totalJobs: number;
  jobReference: string;
  jobPlacedCount: number;
  totalPlacedCount: number;
  computeMs?: number;
  strategy?: string;
  message?: string;
}

/**
 * Hook for streaming global auto-placement progress via SSE (POST + ReadableStream).
 *
 * Uses fetch() with ReadableStream instead of EventSource (which is GET-only).
 * Parses SSE `data: {...}\n\n` lines from the streaming POST response.
 */
export function useAutoPlaceAllStream() {
  const [progress, setProgress] = useState<AutoPlaceProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectAuthToken);

  const start = useCallback(async (strategy: PlacementStrategy = 'edd') => {
    if (isRunning) return;

    setIsRunning(true);
    setError(null);
    setProgress(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Build the URL using the same base as the rest of the API
      const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
      const url = `${apiUrl}/schedule/auto-place-all?strategy=${strategy}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'text/event-stream',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines: "data: {...}\n\n"
        const lines = buffer.split('\n\n');
        // Keep the last incomplete chunk in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const dataLine = line.trim();
          if (!dataLine.startsWith('data: ')) continue;

          try {
            const json = dataLine.slice(6); // Remove "data: " prefix
            const event: AutoPlaceProgress = JSON.parse(json);
            setProgress(event);

            if (event.type === 'error') {
              setError(event.message || 'Unknown error');
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      // Invalidate snapshot to refetch after placement
      dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled — not an error
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [isRunning, dispatch, token]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { start, cancel, progress, isRunning, error };
}
