import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Loader2, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { muteMercure, unmuteMercure } from '../hooks/mercureMute';
import { COMPACT_HORIZONS } from '../constants';
import type { CompactHorizon } from '../constants';
import type { ScheduleSnapshot, InternalTask, Station } from '@flux/types';
import { runSmartCompact } from '../utils/smartCompaction';
import type { SmartCompactResult, SmartCompactProgress } from '../utils/smartCompaction';
import { calculateEndTime } from '../utils/timeCalculations';
import { useBatchRescheduleMutation } from '../store';

// ============================================================================
// Types
// ============================================================================

interface SmartCompactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  snapshot: ScheduleSnapshot;
}

type ModalState = 'config' | 'running' | 'complete' | 'error';

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
  analyze: 'Analyzing schedule',
  reorder: 'Reordering station',
  validate: 'Validating constraints',
  apply: 'Applying changes',
};

// ============================================================================
// Component
// ============================================================================

export function SmartCompactModal({ isOpen, onClose, onComplete, snapshot }: SmartCompactModalProps) {
  const [state, setState] = useState<ModalState>('config');
  const [horizon, setHorizon] = useState<CompactHorizon>(24);
  const [logEntries, setLogEntries] = useState<PhaseLogEntry[]>([]);
  const [result, setResult] = useState<SmartCompactResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SmartCompactProgress | null>(null);
  const abortRef = useRef(false);
  const [batchReschedule] = useBatchRescheduleMutation();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setState('config');
      setHorizon(24);
      setLogEntries([]);
      setResult(null);
      setError(null);
      setProgress(null);
      abortRef.current = false;
    }
  }, [isOpen]);

  const handleStart = useCallback(async () => {
    setState('running');
    setLogEntries([]);
    setResult(null);
    setError(null);
    abortRef.current = false;

    // Mute Mercure during the operation
    muteMercure(5 * 60 * 1000);

    const calcEndTime = (task: InternalTask, start: string, station: Station | undefined) =>
      calculateEndTime(task, start, station);

    try {
      const generator = runSmartCompact({
        snapshot,
        horizonHours: horizon,
        calculateEndTime: calcEndTime,
      });

      let finalResult: SmartCompactResult | null = null;

      for await (const event of generator) {
        if (abortRef.current) break;

        setProgress(event);

        if (event.phase === 'complete' && event.result) {
          // Mark all active phases as done
          setLogEntries((prev) => prev.map((e) =>
            e.status === 'active' ? { ...e, status: 'done' as const } : e
          ));
          finalResult = event.result;
          continue;
        }

        // Phase transition
        setLogEntries((prev) => {
          const entries = [...prev];
          // Mark previous active as done
          const lastActive = entries.findLastIndex((e) => e.status === 'active');
          if (lastActive >= 0) {
            entries[lastActive] = { ...entries[lastActive], status: 'done' };
          }

          const label = event.phase === 'reorder' && event.stationName
            ? `${PHASE_LABELS.reorder}: ${event.stationName}`
            : PHASE_LABELS[event.phase] ?? event.phase;

          const detail = event.phase === 'reorder' && event.totalStations
            ? `${(event.stationIndex ?? 0) + 1}/${event.totalStations}`
            : undefined;

          entries.push({ phase: event.phase, label, detail, status: 'active' });
          return entries;
        });
      }

      unmuteMercure();

      if (abortRef.current) return;

      if (!finalResult) {
        setError('Algorithm finished without producing results');
        setState('error');
        return;
      }

      // Persist changes via batch-reschedule API
      const movedAssignments = finalResult.snapshot.assignments.filter((newA) => {
        const origA = snapshot.assignments.find((a) => a.taskId === newA.taskId);
        return origA && origA.scheduledStart !== newA.scheduledStart;
      });

      if (movedAssignments.length > 0) {
        await batchReschedule({
          assignments: movedAssignments.map((a) => ({
            taskId: a.taskId,
            scheduledStart: a.scheduledStart,
            scheduledEnd: a.scheduledEnd,
          })),
        }).unwrap();
      }

      setResult(finalResult);
      setState('complete');
      onComplete();
    } catch (err) {
      unmuteMercure();
      if (abortRef.current) return;
      setError(err instanceof Error ? err.message : 'Unknown error');
      setState('error');
    }
  }, [snapshot, horizon, batchReschedule, onComplete]);

  if (!isOpen) return null;

  const handleClose = () => {
    abortRef.current = true;
    unmuteMercure();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

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
            <Sparkles size={18} className="text-amber-400" />
            <h2 className="text-flux-text-primary font-semibold text-sm">
              Smart Compaction
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
          {state === 'config' && (
            <ConfigView horizon={horizon} onHorizonChange={setHorizon} />
          )}
          {state === 'running' && (
            <RunningView logEntries={logEntries} progress={progress} />
          )}
          {state === 'complete' && result && (
            <CompleteView result={result} logEntries={logEntries} />
          )}
          {state === 'error' && (
            <ErrorView error={error} />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-flux-border">
          {state === 'config' && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded text-sm bg-zinc-700 hover:bg-zinc-600 text-white font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStart}
                className="px-4 py-2 rounded text-sm bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors"
              >
                Start
              </button>
            </>
          )}
          {(state === 'complete' || state === 'error') && (
            <button
              onClick={handleClose}
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

// ============================================================================
// Sub-components
// ============================================================================

function ConfigView({
  horizon,
  onHorizonChange,
}: {
  horizon: CompactHorizon;
  onHorizonChange: (h: CompactHorizon) => void;
}) {
  return (
    <>
      <p className="text-flux-text-secondary text-xs">
        Reorders tiles to group similar work together, reducing changeover time.
        Respects all precedence rules and deadline constraints.
      </p>

      <div className="space-y-2">
        <p className="text-flux-text-primary text-xs font-medium">Time horizon</p>
        <div className="flex gap-2">
          {COMPACT_HORIZONS.map((h) => (
            <button
              key={h.hours}
              onClick={() => onHorizonChange(h.hours)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                horizon === h.hours
                  ? 'bg-amber-600 text-white'
                  : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function RunningView({
  logEntries,
  progress,
}: {
  logEntries: PhaseLogEntry[];
  progress: SmartCompactProgress | null;
}) {
  const startTimeRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const iv = setInterval(
      () => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)),
      1000,
    );
    return () => clearInterval(iv);
  }, []);

  const pct =
    progress?.totalStations && progress.stationIndex != null
      ? Math.round(((progress.stationIndex + 1) / progress.totalStations) * 100)
      : 0;

  return (
    <>
      <PhaseLog entries={logEntries} />

      {/* Progress bar */}
      {progress?.totalStations && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-flux-text-secondary">
            <span>
              {(progress.stationIndex ?? 0) + 1} / {progress.totalStations} stations
            </span>
            <span>{pct}%</span>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-flux-text-secondary">
        <span>{formatElapsed(elapsed)}</span>
      </div>
    </>
  );
}

function CompleteView({
  result,
  logEntries,
}: {
  result: SmartCompactResult;
  logEntries: PhaseLogEntry[];
}) {
  return (
    <>
      <PhaseLog entries={logEntries} />

      {/* Success header */}
      <div className="flex items-center gap-3">
        <CheckCircle2 size={20} className="text-emerald-400" />
        <p className="text-flux-text-primary text-sm font-medium">Compaction complete</p>
      </div>

      {/* Similarity improvement */}
      {(result.similarityBefore > 0 || result.similarityAfter > 0) && (
        <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-flux-text-primary">
            {result.similarityBefore} → {result.similarityAfter}
          </p>
          <p className="text-xs text-flux-text-secondary mt-0.5">matched similarity pairs</p>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
        <Stat label="Tiles reordered" value={result.reorderedCount} />
        <Stat label="Tiles moved" value={result.movedCount} />
        {result.rollbackCount > 0 && (
          <Stat label="Rollbacks" value={result.rollbackCount} warn />
        )}
        {result.rollbackCount === 0 && (
          <Stat label="Deadline safety" value="No jobs made late" />
        )}
      </div>
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
        <p className="text-flux-text-primary text-sm font-medium">Smart compaction failed</p>
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

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}
