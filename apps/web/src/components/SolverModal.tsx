/**
 * SolverModal — CP-SAT Solver interface (Ctrl+Alt+S)
 *
 * Two modes:
 * - Strategic: full-horizon placement optimizing deadlines + changeovers
 * - Compact: short-window changeover optimization without deadline degradation
 *
 * Follows the same pattern as SmartCompactModal (pre-config + SSE streaming).
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { muteMercure, unmuteMercure } from '../hooks/mercureMute';

// --- Types ---

type SolverMode = 'strategic' | 'compact';
type ModalState = 'config' | 'running' | 'complete' | 'error';

interface SolverScore {
  lateJobCount: number;
  totalJobCount: number;
  totalLatenessMinutes: number;
  maxLatenessMinutes: number;
  makespanMinutes: number;
  onTimeRate: number;
  totalChangeoverCost: number;
  similarityScore: number;
}

interface SolverEvent {
  type: 'progress' | 'complete' | 'error';
  phase?: string;
  message?: string;
  stepsCompleted?: number;
  totalSteps?: number;
  status?: string;
  solveTimeSeconds?: number;
  score?: SolverScore;
  assignments?: Array<{
    taskId: string;
    stationId: string;
    scheduledStart: string;
    scheduledEnd: string;
    isFixed: boolean;
  }>;
}

interface LogEntry {
  phase: string;
  message: string;
  timestamp: number;
}

interface SolverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  apiBaseUrl?: string;
}

// --- Component ---

export function SolverModal({ isOpen, onClose, onComplete, apiBaseUrl }: SolverModalProps) {
  const baseUrl = apiBaseUrl || import.meta.env.VITE_API_BASE_URL || '/api/v1';

  const [mode, setMode] = useState<SolverMode>('strategic');
  const [state, setState] = useState<ModalState>('config');
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<SolverEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Strategic config
  const [timeLimitPerWindow, setTimeLimitPerWindow] = useState(20);
  const [windowDays, setWindowDays] = useState(15);

  // Compact config
  const [horizonHours, setHorizonHours] = useState(8);

  const abortRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logEntries]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setState('config');
      setLogEntries([]);
      setResult(null);
      setError(null);
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [isOpen]);

  // Escape to close (only when not running)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state !== 'running') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, state, onClose]);

  const handleStart = useCallback(async () => {
    setState('running');
    setLogEntries([]);
    setResult(null);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const endpoint = mode === 'strategic'
      ? `${baseUrl}/schedule/solver/strategic`
      : `${baseUrl}/schedule/solver/compact`;

    const body = mode === 'strategic'
      ? { timeLimitPerWindow, windowDays, overlapDays: 5, windowed: false }
      : { horizonHours, maxSolveSeconds: 3 };

    const token = sessionStorage.getItem('flux_auth_token');

    muteMercure(300_000); // 5 min mute

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event: SolverEvent = JSON.parse(line.slice(6));
            handleEvent(event);
          } catch {
            // Skip malformed lines
          }
        }
      }

      // Process remaining buffer
      if (buffer.startsWith('data: ')) {
        try {
          const event: SolverEvent = JSON.parse(buffer.slice(6));
          handleEvent(event);
        } catch {
          // Skip
        }
      }

      if (state === 'running') {
        setState('complete');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Unknown error');
        setState('error');
      }
    } finally {
      unmuteMercure();
    }
  }, [mode, baseUrl, timeLimitPerWindow, windowDays, horizonHours]);

  const handleEvent = useCallback((event: SolverEvent) => {
    if (event.type === 'progress') {
      setLogEntries(prev => [
        ...prev,
        {
          phase: event.phase || 'solving',
          message: event.message || '',
          timestamp: Date.now(),
        },
      ]);
    } else if (event.type === 'complete') {
      setResult(event);
      setState('complete');
      onComplete();
    } else if (event.type === 'error') {
      setError(event.message || 'Unknown solver error');
      setState('error');
    }
  }, [onComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      {/* Backdrop click */}
      <div
        className="absolute inset-0"
        onClick={state !== 'running' ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-flux-elevated border border-flux-border rounded-lg shadow-xl flex flex-col" style={{ minWidth: '28rem', maxWidth: '36rem' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-flux-border">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h2 className="text-flux-text-primary font-semibold text-sm">CP-SAT Solver</h2>
          </div>
          {state !== 'running' && (
            <button onClick={onClose} className="text-flux-text-secondary hover:text-flux-text-primary transition-colors text-xl leading-none">&times;</button>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {state === 'config' && (
            <ConfigView
              mode={mode}
              onModeChange={setMode}
              timeLimitPerWindow={timeLimitPerWindow}
              onTimeLimitChange={setTimeLimitPerWindow}
              windowDays={windowDays}
              onWindowDaysChange={setWindowDays}
              horizonHours={horizonHours}
              onHorizonHoursChange={setHorizonHours}
            />
          )}

          {state === 'running' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-flux-text-secondary">
                <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                <span>Solving ({mode})...</span>
              </div>
              <PhaseLog entries={logEntries} logEndRef={logEndRef} />
            </div>
          )}

          {state === 'complete' && result?.score && (
            <ResultView score={result.score} solveTime={result.solveTimeSeconds} status={result.status} />
          )}

          {state === 'complete' && !result?.score && (
            <div className="p-3 bg-amber-900/30 border border-amber-700/50 rounded text-sm text-amber-300">
              Solver returned <span className="font-medium">{result?.status || 'unknown'}</span> — no feasible schedule found within time limit.
            </div>
          )}

          {state === 'error' && (
            <div className="p-3 bg-red-900/30 border border-red-700/50 rounded text-sm text-red-300">
              <span className="font-medium">Error:</span> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-flux-border">
          {state === 'config' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded text-sm bg-zinc-700 hover:bg-zinc-600 text-white font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStart}
                className="px-4 py-2 rounded text-sm bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors"
              >
                Start Solver
              </button>
            </>
          )}
          {(state === 'complete' || state === 'error') && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded text-sm bg-zinc-700 hover:bg-zinc-600 text-white font-medium transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function ConfigView({
  mode, onModeChange,
  timeLimitPerWindow, onTimeLimitChange,
  windowDays, onWindowDaysChange,
  horizonHours, onHorizonHoursChange,
}: {
  mode: SolverMode;
  onModeChange: (m: SolverMode) => void;
  timeLimitPerWindow: number;
  onTimeLimitChange: (v: number) => void;
  windowDays: number;
  onWindowDaysChange: (v: number) => void;
  horizonHours: number;
  onHorizonHoursChange: (v: number) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="flex rounded-lg border border-flux-border overflow-hidden">
        <button
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${mode === 'strategic' ? 'bg-violet-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
          onClick={() => onModeChange('strategic')}
        >
          Strategic
        </button>
        <button
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${mode === 'compact' ? 'bg-violet-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
          onClick={() => onModeChange('compact')}
        >
          Compact
        </button>
      </div>

      {/* Mode description */}
      <p className="text-xs text-flux-text-secondary">
        {mode === 'strategic'
          ? 'Full-horizon placement optimizing deadlines and changeovers across all stations.'
          : 'Short-window changeover optimization. No on-time job will become late.'}
      </p>

      {/* Config fields */}
      {mode === 'strategic' ? (
        <div className="space-y-3">
          <label className="block">
            <span className="text-flux-text-primary text-xs font-medium">Time limit per window (seconds)</span>
            <input
              type="number"
              value={timeLimitPerWindow}
              onChange={e => onTimeLimitChange(Number(e.target.value))}
              min={5}
              max={120}
              className="mt-1 block w-full px-3 py-2 bg-zinc-800 border border-flux-border rounded-md text-sm text-flux-text-primary focus:outline-none focus:border-violet-500"
            />
          </label>
          <label className="block">
            <span className="text-flux-text-primary text-xs font-medium">Window size (days)</span>
            <input
              type="number"
              value={windowDays}
              onChange={e => onWindowDaysChange(Number(e.target.value))}
              min={5}
              max={60}
              className="mt-1 block w-full px-3 py-2 bg-zinc-800 border border-flux-border rounded-md text-sm text-flux-text-primary focus:outline-none focus:border-violet-500"
            />
          </label>
        </div>
      ) : (
        <div className="space-y-2">
          <span className="text-flux-text-primary text-xs font-medium">Horizon</span>
          <div className="flex gap-2">
            {[8, 12, 24].map(h => (
              <button
                key={h}
                onClick={() => onHorizonHoursChange(h)}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${horizonHours === h ? 'bg-violet-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PhaseLog({ entries, logEndRef }: { entries: LogEntry[]; logEndRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="overflow-y-auto pr-1 space-y-1.5" style={{ maxHeight: '12rem' }}>
      {entries.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="text-zinc-500 shrink-0">[{new Date(entry.timestamp).toLocaleTimeString()}]</span>
          <span className="text-violet-400 shrink-0">{entry.phase}</span>
          <span className="text-flux-text-secondary">{entry.message}</span>
        </div>
      ))}
      <div ref={logEndRef} />
    </div>
  );
}

function ResultView({ score, solveTime, status }: { score: SolverScore; solveTime?: number; status?: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-emerald-400">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm font-medium">
          Solver {status || 'complete'}{solveTime ? ` in ${solveTime.toFixed(1)}s` : ''}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="On-time rate"
          value={`${score.onTimeRate}%`}
          warn={score.onTimeRate < 80}
        />
        <Stat
          label="Late jobs"
          value={`${score.lateJobCount} / ${score.totalJobCount}`}
          warn={score.lateJobCount > 0}
        />
        <Stat
          label="Total lateness"
          value={`${Math.round(score.totalLatenessMinutes / 60)}h`}
          warn={score.totalLatenessMinutes > 0}
        />
        <Stat
          label="Max lateness"
          value={`${Math.round(score.maxLatenessMinutes / 60)}h`}
          warn={score.maxLatenessMinutes > 0}
        />
        <Stat
          label="Changeover cost"
          value={String(score.totalChangeoverCost)}
        />
        <Stat
          label="Similarity score"
          value={String(score.similarityScore)}
        />
        <Stat
          label="Makespan"
          value={`${(score.makespanMinutes / 1440).toFixed(1)}d`}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-zinc-800 rounded p-2">
      <div className="text-xs text-flux-text-secondary">{label}</div>
      <div className={`text-sm font-semibold ${warn ? 'text-amber-400' : 'text-flux-text-primary'}`}>{value}</div>
    </div>
  );
}
