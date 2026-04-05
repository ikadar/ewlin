/**
 * OperatorSchedulePage - Gantt view organized by operator.
 *
 * Shows one column per operator from snapshot.operators.
 * Timeline on the left (hours, day separators).
 * Hatched overlay for non-working hours (from operator.operatingSchedule).
 * Tiles grouped by operator (from assignment.operators[]).
 * Multi-operator tiles (e.g. Hohner) appear in BOTH operators' columns.
 * Each tile shows station name + job reference.
 * Includes compute button FAB and toolbar.
 */

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Cpu, ZoomIn, ZoomOut } from 'lucide-react';
import { useGetSnapshotQuery, useComputeScheduleMutation } from '../store';
import type { ComputeScheduleResult } from '../store';
import { timeToYPosition } from '../components/TimelineColumn/utils';
import type { Operator, TaskAssignment, ScheduleSnapshot, DaySchedule } from '@flux/types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorState } from '../components/ErrorState';

// ============================================================================
// Constants
// ============================================================================

const DAY_COUNT = 30; // Show 30 days of timeline
const START_HOUR = 0;
const DEFAULT_PPH = 40; // Smaller default for operator view (more compact)
const COLUMN_WIDTH = 160;
const TIMELINE_WIDTH = 56;
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const ZOOM_LEVELS = [20, 30, 40, 60, 80];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the grid start date (today at midnight).
 */
function getGridStartDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ============================================================================
// Sub-components
// ============================================================================

interface OperatorTileProps {
  assignment: TaskAssignment;
  snapshot: ScheduleSnapshot;
  pixelsPerHour: number;
  startDate: Date;
}

/**
 * A compact tile showing station name + job reference for the operator Gantt.
 */
function OperatorTile({ assignment, snapshot, pixelsPerHour, startDate }: OperatorTileProps) {
  const task = snapshot.tasks.find(t => t.id === assignment.taskId);
  if (!task) return null;

  const element = snapshot.elements.find(e => e.id === task.elementId);
  const job = element ? snapshot.jobs.find(j => j.id === element.jobId) : null;
  const station = task.type === 'Internal'
    ? snapshot.stations.find(s => s.id === task.stationId)
    : null;

  const startTime = new Date(assignment.scheduledStart);
  const endTime = new Date(assignment.scheduledEnd);
  const top = timeToYPosition(startTime, START_HOUR, pixelsPerHour, startDate);
  const bottom = timeToYPosition(endTime, START_HOUR, pixelsPerHour, startDate);
  const height = Math.max(bottom - top, 16);

  const stationName = station?.name ?? 'ST';
  const jobRef = job?.reference ?? '?';

  const bgClass = assignment.isCompleted
    ? 'bg-emerald-900/50 border-emerald-700'
    : 'bg-blue-900/50 border-blue-700';

  return (
    <div
      className={`absolute left-1 right-1 rounded border text-[10px] leading-tight px-1 py-0.5 overflow-hidden ${bgClass}`}
      style={{ top: `${top}px`, height: `${height}px` }}
      title={`${stationName} - ${jobRef} (${assignment.scheduledStart.slice(0, 16)})`}
    >
      <div className="text-zinc-200 font-medium truncate">{stationName}</div>
      {height > 24 && (
        <div className="text-zinc-400 truncate">{jobRef}</div>
      )}
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function OperatorSchedulePage() {
  const navigate = useNavigate();
  const {
    data: snapshotData,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetSnapshotQuery();

  const [computeSchedule, { isLoading: isComputingSchedule }] = useComputeScheduleMutation();
  const [computeResult, setComputeResult] = useState<ComputeScheduleResult | null>(null);
  const [pixelsPerHour, setPixelsPerHour] = useState(DEFAULT_PPH);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const snapshot = useMemo(
    () =>
      snapshotData ?? {
        version: 0,
        generatedAt: new Date().toISOString(),
        stations: [],
        categories: [],
        groups: [],
        providers: [],
        jobs: [],
        elements: [],
        tasks: [],
        assignments: [],
        conflicts: [],
        lateJobs: [],
        operators: [],
      },
    [snapshotData],
  );

  const operators = snapshot.operators ?? [];
  const gridStartDate = useMemo(() => getGridStartDate(), []);
  const totalHeight = DAY_COUNT * 24 * pixelsPerHour;

  // Build assignment-per-operator map
  // A tile appears in an operator's column if the operator is in assignment.operators[]
  const assignmentsByOperator = useMemo(() => {
    const map = new Map<string, TaskAssignment[]>();
    for (const op of operators) {
      map.set(op.id, []);
    }
    for (const a of snapshot.assignments) {
      if (!a.operators || a.operators.length === 0) continue;
      for (const opRef of a.operators) {
        const list = map.get(opRef.operatorId);
        if (list) {
          list.push(a);
        }
      }
    }
    // Sort each list by start time
    map.forEach((list) => {
      list.sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());
    });
    return map;
  }, [operators, snapshot.assignments]);

  // Scroll to current time on mount
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const now = new Date();
    const y = timeToYPosition(now, START_HOUR, pixelsPerHour, gridStartDate);
    const viewportHeight = scrollContainerRef.current.clientHeight;
    scrollContainerRef.current.scrollTop = Math.max(0, y - viewportHeight / 3);
  }, [pixelsPerHour, gridStartDate]);

  const handleComputeSchedule = useCallback(async () => {
    try {
      const result = await computeSchedule().unwrap();
      setComputeResult(result);
    } catch (err) {
      console.error('Compute failed:', err);
    }
  }, [computeSchedule]);

  const handleZoomIn = useCallback(() => {
    setPixelsPerHour(prev => {
      const idx = ZOOM_LEVELS.indexOf(prev);
      return idx < ZOOM_LEVELS.length - 1 ? ZOOM_LEVELS[idx + 1] : prev;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setPixelsPerHour(prev => {
      const idx = ZOOM_LEVELS.indexOf(prev);
      return idx > 0 ? ZOOM_LEVELS[idx - 1] : prev;
    });
  }, []);

  const handleScroll = useCallback((_e: React.UIEvent<HTMLDivElement>) => {
    // Reserved for future sync (minimap, sticky headers)
  }, []);

  // Loading / error states
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  // Build hour markers
  const hourMarkers: Array<{ y: number; label: string; isDayStart: boolean }> = [];
  for (let day = 0; day < DAY_COUNT; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const date = new Date(gridStartDate);
      date.setDate(date.getDate() + day);
      date.setHours(hour, 0, 0, 0);
      const y = timeToYPosition(date, START_HOUR, pixelsPerHour, gridStartDate);
      const isDayStart = hour === 0;
      const label = isDayStart
        ? date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
        : `${hour.toString().padStart(2, '0')}:00`;
      hourMarkers.push({ y, label, isDayStart });
    }
  }

  // Now line position
  const nowY = timeToYPosition(new Date(), START_HOUR, pixelsPerHour, gridStartDate);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-flux-base">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-flux-border bg-flux-surface shrink-0">
        <button
          onClick={() => navigate('/')}
          className="p-1.5 rounded hover:bg-flux-hover text-flux-text-secondary transition-colors"
          aria-label="Retour"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-sm font-semibold text-flux-text-primary">
          Planning opérateurs
        </h1>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded hover:bg-flux-hover text-flux-text-secondary transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-flux-text-muted font-mono w-8 text-center">
            {pixelsPerHour}
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded hover:bg-flux-hover text-flux-text-secondary transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Gantt content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sticky header row (operator names) */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Column headers */}
          <div className="flex shrink-0 border-b border-flux-border bg-flux-surface overflow-hidden">
            {/* Timeline spacer */}
            <div className="shrink-0 border-r border-flux-border" style={{ width: TIMELINE_WIDTH }} />
            {/* Operator headers */}
            <div className="flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {operators.map(op => (
                <div
                  key={op.id}
                  className="shrink-0 text-center text-xs font-medium text-flux-text-primary py-2 border-r border-flux-border truncate"
                  style={{ width: COLUMN_WIDTH }}
                  title={`${op.firstName} ${op.lastName}${op.role ? ` (${op.role})` : ''}`}
                >
                  {op.firstName} {op.lastName}
                </div>
              ))}
            </div>
          </div>

          {/* Scrollable Gantt body */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-auto"
            onScroll={handleScroll}
          >
            <div className="flex" style={{ height: totalHeight, minHeight: '100%' }}>
              {/* Timeline column */}
              <div className="shrink-0 border-r border-flux-border relative bg-flux-base" style={{ width: TIMELINE_WIDTH, height: totalHeight }}>
                {hourMarkers.map((marker, i) => (
                  <div
                    key={i}
                    className={`absolute left-0 right-0 text-right pr-1 ${
                      marker.isDayStart
                        ? 'text-[10px] font-semibold text-flux-text-primary'
                        : 'text-[9px] text-flux-text-muted'
                    }`}
                    style={{ top: marker.y }}
                  >
                    {marker.label}
                  </div>
                ))}
              </div>

              {/* Operator columns */}
              {operators.map(op => {
                const opAssignments = assignmentsByOperator.get(op.id) ?? [];
                return (
                  <div
                    key={op.id}
                    className="shrink-0 border-r border-flux-border relative"
                    style={{ width: COLUMN_WIDTH, height: totalHeight }}
                  >
                    {/* Hatched overlay for non-working hours */}
                    {renderNonWorkingOverlay(op, gridStartDate, pixelsPerHour)}

                    {/* Day separator lines */}
                    {Array.from({ length: DAY_COUNT }, (_, day) => {
                      const date = new Date(gridStartDate);
                      date.setDate(date.getDate() + day);
                      date.setHours(0, 0, 0, 0);
                      const y = timeToYPosition(date, START_HOUR, pixelsPerHour, gridStartDate);
                      return (
                        <div
                          key={day}
                          className="absolute left-0 right-0 border-t border-flux-border"
                          style={{ top: y }}
                        />
                      );
                    })}

                    {/* Now line */}
                    <div
                      className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none"
                      style={{ top: nowY }}
                    />

                    {/* Tiles */}
                    {opAssignments.map(a => (
                      <OperatorTile
                        key={a.id}
                        assignment={a}
                        snapshot={snapshot}
                        pixelsPerHour={pixelsPerHour}
                        startDate={gridStartDate}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Compute Schedule FAB */}
      <button
        onClick={handleComputeSchedule}
        disabled={isComputingSchedule}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white shadow-lg transition-all flex items-center justify-center"
        aria-label="Calculer le planning"
        title="Calculer le planning"
        data-testid="compute-schedule-fab-operator"
      >
        {isComputingSchedule ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Cpu size={20} />
        )}
      </button>

      {/* Compute result modal */}
      {computeResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setComputeResult(null)}
          onKeyDown={e => { if (e.key === 'Escape') setComputeResult(null); }}
          tabIndex={-1}
        >
          <div
            className="bg-flux-elevated border border-flux-border rounded-lg p-6 shadow-xl"
            style={{ width: '24rem' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-flux-text-primary font-semibold mb-4">
              Calcul terminé
            </h2>
            <div className="space-y-2 text-sm text-flux-text-secondary mb-6">
              <p>Tâches placées : <span className="text-flux-text-primary font-mono">{computeResult.stats.scheduledTasks} / {computeResult.stats.totalTasks}</span></p>
              <p>Retard : <span className="text-flux-text-primary font-mono">{computeResult.stats.lateTaskCount} tâche(s), {computeResult.stats.totalLatenessMinutes}min</span></p>
              <p>Temps de calcul : <span className="text-flux-text-primary font-mono">{computeResult.computeTimeMs}ms</span></p>
              {computeResult.warnings.length > 0 && (
                <div className="pt-2 border-t border-flux-border mt-2">
                  {computeResult.warnings.slice(0, 3).map((w, i) => (
                    <p key={i} className="text-amber-400 text-xs">{w.message}</p>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                className="px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                onClick={() => setComputeResult(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Non-working hours overlay renderer
// ============================================================================

/**
 * Render hatched overlay blocks for non-working hours within the visible range.
 */
function renderNonWorkingOverlay(
  operator: Operator,
  gridStartDate: Date,
  pixelsPerHour: number,
): React.ReactNode[] {
  const schedule = operator.operatingSchedule;
  if (!schedule) return [];

  const blocks: React.ReactNode[] = [];

  for (let day = 0; day < DAY_COUNT; day++) {
    const date = new Date(gridStartDate);
    date.setDate(date.getDate() + day);
    const dow = date.getDay();
    const dayName = DAY_NAMES[dow];
    const daySchedule: DaySchedule = schedule[dayName];

    if (!daySchedule.isOperating || daySchedule.slots.length === 0) {
      // Full day off
      const yStart = day * 24 * pixelsPerHour;
      const yEnd = (day + 1) * 24 * pixelsPerHour;
      blocks.push(
        <div
          key={`off-${day}`}
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            top: yStart,
            height: yEnd - yStart,
            background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.04) 4px, rgba(255,255,255,0.04) 8px)',
          }}
        />,
      );
      continue;
    }

    // Build non-working ranges from slots
    const workingRanges = daySchedule.slots.map(slot => ({
      start: parseInt(slot.start.split(':')[0], 10),
      end: parseInt(slot.end.split(':')[0], 10),
    }));

    // Sort by start
    workingRanges.sort((a, b) => a.start - b.start);

    // Gaps: 0..first.start, first.end..second.start, ..., last.end..24
    let cursor = 0;
    for (const range of workingRanges) {
      if (cursor < range.start) {
        const yStart = (day * 24 + cursor) * pixelsPerHour;
        const yEnd = (day * 24 + range.start) * pixelsPerHour;
        blocks.push(
          <div
            key={`gap-${day}-${cursor}`}
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              top: yStart,
              height: yEnd - yStart,
              background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.04) 4px, rgba(255,255,255,0.04) 8px)',
            }}
          />,
        );
      }
      cursor = range.end;
    }
    // Trailing gap
    if (cursor < 24) {
      const yStart = (day * 24 + cursor) * pixelsPerHour;
      const yEnd = (day + 1) * 24 * pixelsPerHour;
      blocks.push(
        <div
          key={`gap-${day}-${cursor}-end`}
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            top: yStart,
            height: yEnd - yStart,
            background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.04) 4px, rgba(255,255,255,0.04) 8px)',
          }}
        />,
      );
    }
  }

  return blocks;
}
