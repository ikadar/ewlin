import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Loader2, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import { muteMercure, unmuteMercure } from '../hooks/mercureMute';

// ============================================================================
// Types
// ============================================================================

interface AutoPlaceProgress {
  type: 'progress' | 'iteration' | 'split' | 'complete' | 'error';
  phase: string;
  jobIndex: number;
  totalJobs: number;
  jobReference: string;
  jobPlacedCount: number;
  totalPlacedCount: number;
  fbiIteration?: number;
  lateCount?: number;
  totalLatenessMinutes?: number;
  splitsPerformed?: number;
  stepsCompleted?: number;
  computeMs?: number;
  score?: {
    lateJobCount: number;
    totalJobCount: number;
    totalLatenessMinutes: number;
    maxLatenessMinutes: number;
    makespanMinutes: number;
    onTimeRate: number;
    averageSlackMinutes: number;
  };
  message?: string; // for error type
}

interface AutoPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  apiBaseUrl: string;
}

type ModalState = 'running' | 'complete' | 'error';

interface PhaseLogEntry {
  phase: string;
  label: string;
  detail?: string;
  status: 'done' | 'active';
}

// ============================================================================
// Phase log helpers
// ============================================================================

const PHASE_LABELS: Record<string, string> = {
  placement: 'Initial placement',
  fbi_backward: 'FBI backward pass',
  fbi_forward: 'FBI forward pass',
  auto_split: 'Auto-split',
  split_replace: 'Re-placing after split',
  split_backward: 'Post-split backward pass',
  split_forward: 'Post-split late jobs',
};

function getPhaseDetail(phase: string, event: AutoPlaceProgress): string {
  switch (phase) {
    case 'placement':
    case 'split_replace':
      return `${event.totalPlacedCount} tiles`;
    case 'fbi_backward':
    case 'split_backward':
      return `${event.totalJobs} jobs`;
    case 'fbi_forward':
    case 'split_forward':
      return `${event.jobIndex}/${event.totalJobs} jobs`;
    case 'auto_split':
      return event.splitsPerformed ? `${event.splitsPerformed} splits` : 'processing…';
    default:
      return '';
  }
}

// ============================================================================
// Hook: useAutoPlaceSSE
// ============================================================================

function useAutoPlaceSSE(apiBaseUrl: string) {
  const [state, setState] = useState<ModalState>('running');
  const [progress, setProgress] = useState<AutoPlaceProgress | null>(null);
  const [result, setResult] = useState<AutoPlaceProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastProgressRef = useRef<AutoPlaceProgress | null>(null);
  const [logEntries, setLogEntries] = useState<PhaseLogEntry[]>([]);
  const prevPhaseRef = useRef<string | null>(null);
  const needsNewActiveRef = useRef(false);

  const start = useCallback(() => {
    // Abort any previous in-flight request
    abortRef.current?.abort();

    setState('running');
    setProgress(null);
    setResult(null);
    setError(null);
    setLogEntries([]);
    prevPhaseRef.current = null;
    needsNewActiveRef.current = false;

    // Accumulate phase log entries from SSE events
    function logEvent(event: AutoPlaceProgress) {
      if (event.type === 'iteration') {
        setLogEntries(prev => {
          const entries = [...prev];
          const lastActive = entries.findLastIndex(e => e.status === 'active');
          if (lastActive >= 0) entries.splice(lastActive, 1);
          entries.push({
            phase: 'fbi_iteration',
            label: `FBI iteration #${event.fbiIteration ?? 1}`,
            detail: `${event.lateCount ?? 0} late, ${formatMinutes(event.totalLatenessMinutes ?? 0)}`,
            status: 'done',
          });
          return entries;
        });
        needsNewActiveRef.current = true;
        return;
      }

      if (event.type === 'split') {
        setLogEntries(prev => {
          const entries = [...prev];
          const lastActive = entries.findLastIndex(e => e.status === 'active');
          if (lastActive >= 0) entries.splice(lastActive, 1);
          entries.push({
            phase: 'split',
            label: 'Auto-split',
            detail: `${event.splitsPerformed ?? 0} splits performed`,
            status: 'done',
          });
          return entries;
        });
        needsNewActiveRef.current = true;
        return;
      }

      if (event.type === 'complete') {
        setLogEntries(prev => prev.map(e =>
          e.status === 'active' ? { ...e, status: 'done' as const } : e
        ));
        return;
      }

      // Regular progress — detect phase transitions
      const currentPhase = event.phase;
      const isNewPhase = currentPhase !== prevPhaseRef.current || needsNewActiveRef.current;

      if (isNewPhase && currentPhase) {
        prevPhaseRef.current = currentPhase;
        needsNewActiveRef.current = false;
        setLogEntries(prev => {
          const entries = [...prev];
          const lastActive = entries.findLastIndex(e => e.status === 'active');
          if (lastActive >= 0) {
            entries[lastActive] = { ...entries[lastActive], status: 'done' };
          }
          entries.push({
            phase: currentPhase,
            label: PHASE_LABELS[currentPhase] ?? currentPhase,
            detail: getPhaseDetail(currentPhase, event),
            status: 'active',
          });
          return entries;
        });
      } else {
        setLogEntries(prev => {
          const entries = [...prev];
          const lastActive = entries.findLastIndex(e => e.status === 'active');
          if (lastActive >= 0) {
            entries[lastActive] = {
              ...entries[lastActive],
              detail: getPhaseDetail(entries[lastActive].phase, event),
            };
          }
          return entries;
        });
      }
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // Suppress Mercure invalidations for the entire auto-place duration.
    // Backend flushes trigger Mercure events that would cause full snapshot
    // refetches, blocking the main thread and freezing the SSE stream.
    muteMercure(10 * 60 * 1000);

    // Use fetch with ReadableStream for SSE (EventSource doesn't support POST)
    const token = sessionStorage.getItem('flux_auth_token');
    const headers: Record<string, string> = { 'Accept': 'text/event-stream' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    fetch(`${apiBaseUrl}/schedule/auto-place-all`, {
      method: 'POST',
      headers,
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Flush TextDecoder internal state + drain remaining buffer
            buffer += decoder.decode(new Uint8Array(), { stream: false });
            if (buffer.trim()) {
              for (const line of buffer.split('\n')) {
                if (!line.startsWith('data: ')) continue;
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;
                try {
                  const event: AutoPlaceProgress = JSON.parse(jsonStr);
                  if (event.type === 'error') {
                    unmuteMercure();
                    setError(event.message ?? 'Unknown error');
                    setState('error');
                    return;
                  }
                  logEvent(event);
                  if (event.type === 'complete') {
                    unmuteMercure();
                    setResult(event);
                    setState('complete');
                    return;
                  }
                  setProgress(event);
                  lastProgressRef.current = event;
                } catch {
                  // Skip malformed JSON
                }
              }
            }
            // Stream ended — treat as complete
            unmuteMercure();
            setState('complete');
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const event: AutoPlaceProgress = JSON.parse(jsonStr);

              if (event.type === 'error') {
                unmuteMercure();
                setError(event.message ?? 'Unknown error');
                setState('error');
                return;
              }

              logEvent(event);

              if (event.type === 'complete') {
                unmuteMercure();
                setResult(event);
                setState('complete');
                return;
              }

              // progress, iteration, split events
              setProgress(event);
              lastProgressRef.current = event;
            } catch {
              // Skip malformed JSON
            }
          }
        }
      })
      .catch((err) => {
        unmuteMercure();
        if (err.name === 'AbortError') return;
        setError(err.message ?? 'Connection failed');
        setState('error');
      });
  }, [apiBaseUrl]);

  const abort = useCallback(() => {
    unmuteMercure();
    abortRef.current?.abort();
  }, []);

  return { state, progress, result, error, logEntries, start, abort, lastProgressRef };
}

// ============================================================================
// Helper: format minutes as human-readable
// ============================================================================

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

// ============================================================================
// Component: AutoPlaceModal
// ============================================================================

export function AutoPlaceModal({ isOpen, onClose, onComplete, apiBaseUrl }: AutoPlaceModalProps) {
  const { state, progress, result, error, logEntries, start, abort, lastProgressRef } = useAutoPlaceSSE(apiBaseUrl);

  // Start the algorithm when modal opens
  useEffect(() => {
    if (isOpen) {
      start();
    }
    return () => {
      abort();
    };
  }, [isOpen, start, abort]);

  // Notify parent on completion (to trigger snapshot refetch)
  useEffect(() => {
    if (state === 'complete') {
      onComplete();
    }
  }, [state, onComplete]);

  if (!isOpen) return null;

  const handleClose = () => {
    abort();
    onClose();
  };

  // Escape key to close
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  const pct = progress && progress.totalJobs > 0
    ? Math.round((progress.jobIndex / progress.totalJobs) * 100)
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={handleClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        className="bg-flux-elevated border border-flux-border rounded-lg shadow-xl"
        style={{ minWidth: '28rem', maxWidth: '36rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-flux-border">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-amber-400" />
            <h2 className="text-flux-text-primary font-semibold text-sm">
              Auto-Placement V1
            </h2>
          </div>
          {state !== 'running' && (
            <button
              onClick={handleClose}
              className="text-flux-text-secondary hover:text-flux-text-primary transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {state === 'running' && <RunningView progress={progress} pct={pct} logEntries={logEntries} />}
          {state === 'complete' && result && <CompleteView result={result} logEntries={logEntries} />}
          {state === 'complete' && !result && <IncompleteView lastProgress={lastProgressRef.current} logEntries={logEntries} />}
          {state === 'error' && <ErrorView error={error} />}
        </div>

        {/* Footer */}
        {state !== 'running' && (
          <div className="flex justify-end px-5 py-3 border-t border-flux-border">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded text-sm bg-zinc-700 hover:bg-zinc-600 text-white font-medium transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function RunningView({ progress, pct, logEntries }: { progress: AutoPlaceProgress | null; pct: number; logEntries: PhaseLogEntry[] }) {
  const startTimeRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <>
      {/* Phase log */}
      <PhaseLog entries={logEntries} />

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-flux-text-secondary">
          <span>{progress ? `${progress.jobIndex} / ${progress.totalJobs} jobs` : 'Initializing...'}</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Compact running stats */}
      {progress && (
        <div className="flex items-center gap-4 text-xs text-flux-text-secondary">
          <span>{progress.totalPlacedCount} tiles</span>
          <span>{formatElapsed(elapsed)}</span>
        </div>
      )}
    </>
  );
}

function CompleteView({ result, logEntries }: { result: AutoPlaceProgress; logEntries: PhaseLogEntry[] }) {
  const score = result.score;

  return (
    <>
      {/* Phase log */}
      <PhaseLog entries={logEntries} />

      {/* Success header */}
      <div className="flex items-center gap-3">
        <CheckCircle2 size={20} className="text-emerald-400" />
        <p className="text-flux-text-primary text-sm font-medium">Placement complete</p>
      </div>

      {/* Score summary */}
      {score && (
        <div className="bg-zinc-900/50 rounded-lg p-4 space-y-3">
          {/* On-time rate — large */}
          <div className="text-center">
            <p className="text-3xl font-bold text-flux-text-primary">
              {score.onTimeRate.toFixed(1)}%
            </p>
            <p className="text-xs text-flux-text-secondary mt-0.5">on-time rate</p>
          </div>

          {/* Grid of stats */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs pt-2 border-t border-flux-border">
            <Stat label="Total jobs" value={score.totalJobCount} />
            <Stat label="Late jobs" value={score.lateJobCount} warn={score.lateJobCount > 0} />
            <Stat label="Total lateness" value={formatMinutes(score.totalLatenessMinutes)} warn={score.totalLatenessMinutes > 0} />
            <Stat label="Max lateness" value={formatMinutes(score.maxLatenessMinutes)} warn={score.maxLatenessMinutes > 0} />
            <Stat label="Makespan" value={formatMinutes(score.makespanMinutes)} />
            <Stat label="Avg slack" value={formatMinutes(Math.abs(score.averageSlackMinutes))} warn={score.averageSlackMinutes < 0} />
          </div>
        </div>
      )}

      {/* Tiles placed + compute time */}
      <div className="grid grid-cols-2 gap-x-6 text-xs">
        <Stat label="Tiles placed" value={result.totalPlacedCount} />
        {result.computeMs != null && (
          <Stat label="Compute time" value={`${result.computeMs}ms`} />
        )}
      </div>
    </>
  );
}

function IncompleteView({ lastProgress, logEntries }: { lastProgress: AutoPlaceProgress | null; logEntries: PhaseLogEntry[] }) {
  return (
    <>
      {/* Phase log */}
      <PhaseLog entries={logEntries} />

      <div className="flex items-center gap-3">
        <AlertTriangle size={20} className="text-amber-400" />
        <div>
          <p className="text-flux-text-primary text-sm font-medium">
            Placement finished with incomplete results
          </p>
          <p className="text-flux-text-secondary text-xs mt-0.5">
            The server stream ended before sending a completion summary.
          </p>
        </div>
      </div>

      {lastProgress && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <Stat label="Tiles placed" value={lastProgress.totalPlacedCount} />
          <Stat label="Late jobs" value={lastProgress.lateCount ?? 0} warn={(lastProgress.lateCount ?? 0) > 0} />
        </div>
      )}
    </>
  );
}

function PhaseLog({ entries }: { entries: PhaseLogEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  if (entries.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="space-y-1.5 overflow-y-auto pr-1"
      style={{ maxHeight: '12rem' }}
    >
      {entries.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          {entry.status === 'done' ? (
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
          ) : (
            <Loader2 size={14} className="text-amber-400 animate-spin shrink-0" />
          )}
          <span className="text-flux-text-primary">{entry.label}</span>
          {entry.detail && (
            <span className="text-flux-text-secondary ml-auto whitespace-nowrap">{entry.detail}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function ErrorView({ error }: { error: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <AlertTriangle size={20} className="text-red-400" />
      <div>
        <p className="text-flux-text-primary text-sm font-medium">Auto-placement failed</p>
        <p className="text-flux-text-secondary text-xs mt-0.5">{error ?? 'Unknown error'}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-flux-text-secondary">{label}</span>
      <span className={warn ? 'text-amber-400 font-medium' : 'text-flux-text-primary font-medium'}>
        {value}
      </span>
    </div>
  );
}
