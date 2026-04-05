/**
 * OperatorSchedulePage - Gantt view organized by operator.
 *
 * Mirrors the station scheduling view (App.tsx) layout:
 * - Left sidebar: JobsList
 * - DateStrip column
 * - TimelineColumn (sticky left)
 * - One column per operator (instead of station)
 *
 * Tiles use the real Tile component. Each tile shows station name
 * (via operatorNames prop) since the column already identifies the operator.
 * Multi-operator assignments appear in every assigned operator's column.
 *
 * Read-only: no drag & drop, no pick & place, no context menus.
 * Click on a tile selects its job (highlighted in JobsList + selection ring).
 */

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Cpu } from 'lucide-react';
import { useGetSnapshotQuery, useComputeScheduleMutation } from '../store';
import type { ComputeScheduleResult } from '../store';
import { isInternalTask } from '@flux/types';
import type {
  Operator,
  TaskAssignment,
  ScheduleSnapshot,
  DaySchedule,
  InternalTask,
  Job,
  Element,
} from '@flux/types';

import {
  JobsList,
  DateStrip,
  TimelineColumn,
  Tile,
  DEFAULT_PIXELS_PER_HOUR,
  computeTileState,
  timeToYPosition,
} from '../components';
import { UnavailabilityOverlay } from '../components/StationColumns/UnavailabilityOverlay';
import { LoadingSpinner } from '../components/LoadingSpinner/LoadingSpinner';
import { ErrorState } from '../components/ErrorState';
import { useVirtualScroll, isAssignmentVisible } from '../hooks';

// ============================================================================
// Constants (matching App.tsx)
// ============================================================================

const START_HOUR = 0;
const DAY_COUNT = 365;
const OPERATOR_COLUMN_WIDTH = 240; // w-60 = 15rem = 240px (same as default station column)

const DAY_NAMES = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
] as const;

const defaultSnapshot: ScheduleSnapshot = {
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
};

// ============================================================================
// Helpers
// ============================================================================

/** Get the day schedule for an operator on a given date (checks exceptions first). */
function getOperatorDaySchedule(operator: Operator, date: Date): DaySchedule {
  // Check for date-specific exceptions
  if (operator.scheduleExceptions?.length) {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const exception = operator.scheduleExceptions.find((e) => e.date === dateStr);
    if (exception) {
      return exception.schedule;
    }
  }
  // Fall back to weekly schedule
  const schedule = operator.operatingSchedule;
  if (!schedule) {
    // No schedule defined = always available (no hatching)
    return { isOperating: true, slots: [{ start: '00:00', end: '24:00' }] };
  }
  const dayName = DAY_NAMES[date.getDay()];
  return schedule[dayName];
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
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [pixelsPerHour] = useState(DEFAULT_PIXELS_PER_HOUR);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const snapshot = useMemo(() => snapshotData ?? defaultSnapshot, [snapshotData]);
  const operators = snapshot.operators ?? [];

  const gridStartDate = useMemo(() => {
    const d = new Date();
    d.setHours(START_HOUR, 0, 0, 0);
    return d;
  }, []);

  // ---- Virtual scrolling (same as SchedulingGrid) ----
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const dayHeightPx = 24 * pixelsPerHour;

  const virtualScroll = useVirtualScroll({
    totalDays: DAY_COUNT,
    bufferDays: 3,
    dayHeightPx,
    scrollTop,
    viewportHeight,
  });

  const totalHeight = virtualScroll.totalHeight;

  // Track scroll position for virtual scrolling + DateStrip sync
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);
  const [viewportStartHour, setViewportStartHour] = useState<number | undefined>(undefined);
  const [viewportEndHour, setViewportEndHour] = useState<number | undefined>(undefined);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    setViewportHeight(container.clientHeight);

    const handleScroll = () => {
      const newScrollTop = container.scrollTop;
      setScrollTop(newScrollTop);

      // Sync focused date for DateStrip (same logic as App.tsx handleGridScroll)
      const hoursFromStart = newScrollTop / pixelsPerHour;
      const fd = new Date(gridStartDate);
      fd.setTime(gridStartDate.getTime() + hoursFromStart * 60 * 60 * 1000);
      setFocusedDate(fd);

      // Viewport hour range
      const startH = newScrollTop / pixelsPerHour;
      const endH = (newScrollTop + container.clientHeight) / pixelsPerHour;
      setViewportStartHour(startH % 24);
      setViewportEndHour(endH % 24);
    };

    const handleResize = () => {
      setViewportHeight(container.clientHeight);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    handleScroll(); // initial sync

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [pixelsPerHour, gridStartDate]);

  // Scroll to current time on mount
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const now = new Date();
    const y = timeToYPosition(now, START_HOUR, pixelsPerHour, gridStartDate);
    const vh = scrollContainerRef.current.clientHeight;
    scrollContainerRef.current.scrollTop = Math.max(0, y - vh / 3);
  }, [pixelsPerHour, gridStartDate]);

  // ---- Data lookups ----
  const jobMap = useMemo(() => {
    const m = new Map<string, Job>();
    snapshot.jobs.forEach((j) => m.set(j.id, j));
    return m;
  }, [snapshot.jobs]);

  const elementMap = useMemo(
    () => new Map(snapshot.elements.map((e) => [e.id, e])),
    [snapshot.elements],
  );

  const taskMap = useMemo(() => {
    const m = new Map<string, (typeof snapshot.tasks)[number]>();
    snapshot.tasks.forEach((t) => m.set(t.id, t));
    return m;
  }, [snapshot.tasks]);

  const stationMap = useMemo(
    () => new Map(snapshot.stations.map((s) => [s.id, s])),
    [snapshot.stations],
  );

  const lateJobIds = useMemo(
    () => new Set(snapshot.lateJobs.map((lj) => lj.jobId)),
    [snapshot.lateJobs],
  );

  // ---- Group assignments by operator ----
  const assignmentsByOperator = useMemo(() => {
    const map = new Map<string, TaskAssignment[]>();
    for (const op of operators) {
      map.set(op.id, []);
    }
    for (const a of snapshot.assignments) {
      if (!a.operators || a.operators.length === 0) continue;

      // Virtual-scroll visibility filter
      if (!isAssignmentVisible(a.scheduledStart, a.scheduledEnd, gridStartDate, virtualScroll.visibleRange)) {
        continue;
      }

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
  }, [operators, snapshot.assignments, gridStartDate, virtualScroll.visibleRange]);

  // ---- DateStrip date click ----
  const handleDateClick = useCallback((date: Date) => {
    if (!scrollContainerRef.current) return;
    const y = timeToYPosition(date, START_HOUR, pixelsPerHour, gridStartDate);
    scrollContainerRef.current.scrollTo({ top: y, behavior: 'smooth' });
  }, [pixelsPerHour, gridStartDate]);

  // ---- Compute schedule ----
  const handleComputeSchedule = useCallback(async () => {
    try {
      const result = await computeSchedule().unwrap();
      setComputeResult(result);
    } catch (err) {
      console.error('Compute failed:', err);
    }
  }, [computeSchedule]);

  // ---- Now line ----
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);
  const nowPosition = timeToYPosition(now, START_HOUR, pixelsPerHour, gridStartDate);

  // ---- Loading / error ----
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

  // ---- Render helper: build a Tile for an assignment in an operator column ----
  function renderTile(assignment: TaskAssignment) {
    const task = taskMap.get(assignment.taskId);
    if (!task || !isInternalTask(task)) return null;

    const element = elementMap.get(task.elementId);
    const jobId = element?.jobId;
    const job = jobId ? jobMap.get(jobId) : undefined;
    if (!job) return null;

    const top = timeToYPosition(new Date(assignment.scheduledStart), START_HOUR, pixelsPerHour, gridStartDate);

    // Station name (shown on tile since column = operator)
    const station = stationMap.get(task.stationId);
    const stationName = station?.name;

    // Tile state
    const isLate = lateJobIds.has(job.id) || (!assignment.isCompleted && new Date(assignment.scheduledEnd) < now);
    const hasConflict = false; // Read-only view, no conflict rendering needed
    const tileState = computeTileState(false, isLate, hasConflict, false, assignment.isCompleted);

    return (
      <Tile
        key={assignment.id}
        assignment={assignment}
        task={task as InternalTask}
        job={job}
        element={element as Element | undefined}
        top={top}
        isSelected={selectedJobId === job.id}
        onSelect={setSelectedJobId}
        showSwapUp={false}
        showSwapDown={false}
        hasConflict={false}
        tileState={tileState}
        pixelsPerHour={pixelsPerHour}
        isPicked={false}
        isPickingActive={false}
        isBlocked={false}
        operatorNames={stationName}
      />
    );
  }

  // minWidth so horizontal scroll works for many operators
  const gridMinWidth = 48 + OPERATOR_COLUMN_WIDTH * operators.length; // 48 = timeline w-12

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ---- Left sidebar: JobsList ---- */}
      <div>
        <JobsList
          jobs={snapshot.jobs}
          tasks={snapshot.tasks}
          elements={snapshot.elements}
          assignments={snapshot.assignments}
          lateJobs={snapshot.lateJobs}
          conflicts={snapshot.conflicts}
          selectedJobId={selectedJobId}
          onSelectJob={setSelectedJobId}
        />
      </div>

      {/* ---- Main content ---- */}
      <div className="flex-1 flex flex-col overflow-hidden">
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
        </div>

        {/* Grid area */}
        <div className="flex-1 flex overflow-hidden">
          {/* DateStrip */}
          <DateStrip
            startDate={gridStartDate}
            onDateClick={handleDateClick}
            focusedDate={focusedDate}
            viewportStartHour={viewportStartHour}
            viewportEndHour={viewportEndHour}
          />

          {/* Timeline + Operator columns */}
          <div className="flex-1 overflow-auto min-w-0" ref={scrollContainerRef} data-testid="operator-scheduling-grid">
            <div className="inline-flex flex-col" style={{ minWidth: 'fit-content', minHeight: '100%' }}>
              {/* ---- Header row (sticky top) ---- */}
              <div className="flex sticky top-0 z-30 bg-zinc-900">
                {/* Timeline header placeholder (sticky left) */}
                <div className="w-12 shrink-0 bg-zinc-900 border-r border-white/5 border-b border-white/10 sticky left-0 z-40" />

                {/* Operator headers */}
                <div className="flex gap-3 px-3 border-b border-white/10">
                  {operators.map((op) => (
                    <div
                      key={op.id}
                      className="w-60 shrink-0 py-2 px-3 text-sm flex items-center"
                      style={{ width: `${OPERATOR_COLUMN_WIDTH}px` }}
                      data-testid={`operator-header-${op.id}`}
                    >
                      <span className="font-medium text-zinc-300 truncate">
                        {op.firstName} {op.lastName}
                        {op.role && (
                          <span className="text-zinc-500 font-normal ml-1">({op.role})</span>
                        )}
                      </span>
                    </div>
                  ))}
                  {/* Spacer for rightmost column scrollability */}
                  <div className="shrink-0" style={{ width: 'calc(100vw - 300px)' }} aria-hidden="true" />
                </div>
              </div>

              {/* ---- Content row ---- */}
              <div className="flex relative" style={{ height: `${totalHeight}px` }}>
                {/* Timeline column (sticky left) */}
                <div className="sticky left-0 z-20">
                  <TimelineColumn
                    startHour={START_HOUR}
                    hourCount={DAY_COUNT * 24}
                    currentTime={now}
                    showNowLine={false}
                    pixelsPerHour={pixelsPerHour}
                    visibleDayRange={virtualScroll.visibleRange}
                  />
                </div>

                {/* Operator columns */}
                <div className="flex gap-3 px-3 bg-zinc-950 relative">
                  {/* Now line spanning all columns */}
                  <div
                    className="absolute left-0 right-0 h-0.5 bg-red-500 z-10 pointer-events-none"
                    style={{ top: `${nowPosition}px` }}
                    data-testid="now-line"
                  />

                  {operators.map((op) => {
                    const opAssignments = assignmentsByOperator.get(op.id) ?? [];
                    return (
                      <OperatorColumn
                        key={op.id}
                        operator={op}
                        assignments={opAssignments}
                        totalHeight={totalHeight}
                        pixelsPerHour={pixelsPerHour}
                        gridStartDate={gridStartDate}
                        visibleDayRange={virtualScroll.visibleRange}
                        renderTile={renderTile}
                        onDeselect={() => setSelectedJobId(null)}
                      />
                    );
                  })}

                  {/* Spacer for rightmost column scrollability */}
                  <div className="shrink-0" style={{ width: 'calc(100vw - 300px)' }} aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Selection ring (CSS-only, same as App.tsx) ---- */}
      {selectedJobId && (
        <style>{`[data-job-id="${selectedJobId}"]::after { content: ''; position: absolute; inset: 0; border: 2px solid rgba(255,255,255,0.7); z-index: 5; pointer-events: none; }`}</style>
      )}

      {/* ---- Compute Schedule FAB ---- */}
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

      {/* ---- Compute result modal ---- */}
      {computeResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setComputeResult(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setComputeResult(null); }}
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <div
            className="bg-flux-elevated border border-flux-border rounded-lg p-6 shadow-xl"
            style={{ width: '24rem' }}
            onClick={(e) => e.stopPropagation()}
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
// OperatorColumn sub-component
// ============================================================================

interface OperatorColumnProps {
  operator: Operator;
  assignments: TaskAssignment[];
  totalHeight: number;
  pixelsPerHour: number;
  gridStartDate: Date;
  visibleDayRange: { start: number; end: number };
  renderTile: (assignment: TaskAssignment) => React.ReactNode;
  onDeselect: () => void;
}

/**
 * A single operator column: unavailability overlays + hour grid lines + tiles.
 * Styled like StationColumn (same width, hatched overlay via UnavailabilityOverlay + bg-stripes-dark).
 */
function OperatorColumn({
  operator,
  assignments,
  totalHeight,
  pixelsPerHour,
  gridStartDate,
  visibleDayRange,
  renderTile,
  onDeselect,
}: OperatorColumnProps) {
  const numberOfDays = Math.ceil(totalHeight / (24 * pixelsPerHour));

  // Hour grid lines (only visible range)
  const gridLines = useMemo(() => {
    const lines: number[] = [];
    const startDay = visibleDayRange.start;
    const endDay = visibleDayRange.end;
    for (let dayIndex = startDay; dayIndex <= endDay && dayIndex < numberOfDays; dayIndex++) {
      for (let h = 0; h < 24; h++) {
        lines.push((dayIndex * 24 + h) * pixelsPerHour);
      }
    }
    return lines;
  }, [visibleDayRange, numberOfDays, pixelsPerHour]);

  // Unavailability overlays (only visible range)
  const overlays = useMemo(() => {
    const startDay = visibleDayRange.start;
    const endDay = visibleDayRange.end;
    const elements: React.ReactNode[] = [];

    for (let dayIndex = startDay; dayIndex <= endDay && dayIndex < numberOfDays; dayIndex++) {
      const currentDate = new Date(gridStartDate.getTime() + dayIndex * 24 * 60 * 60 * 1000);
      const daySchedule = getOperatorDaySchedule(operator, currentDate);
      const dayYOffset = dayIndex * 24 * pixelsPerHour;

      elements.push(
        <UnavailabilityOverlay
          key={`overlay-day-${dayIndex}`}
          daySchedule={daySchedule}
          startHour={0}
          hoursToDisplay={24}
          pixelsPerHour={pixelsPerHour}
          yOffset={dayYOffset}
        />,
      );
    }
    return elements;
  }, [operator, gridStartDate, pixelsPerHour, visibleDayRange, numberOfDays]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Background click only (not tile clicks which stopPropagation)
    if (e.target === e.currentTarget) {
      onDeselect();
    }
  };

  return (
    <div
      className="shrink-0 bg-zinc-950 relative transition-[filter,opacity,box-shadow] duration-150 ease-out outline-none"
      style={{ width: `${OPERATOR_COLUMN_WIDTH}px`, height: `${totalHeight}px` }}
      data-testid={`operator-column-${operator.id}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
      }}
      aria-label={`Opérateur ${operator.firstName} ${operator.lastName}`}
    >
      {/* Unavailability overlays */}
      {overlays}

      {/* Hour grid lines */}
      {gridLines.map((top) => (
        <div
          key={top}
          className="absolute left-0 right-0 h-px bg-zinc-700/50 pointer-events-none"
          style={{ top: `${top}px` }}
        />
      ))}

      {/* Tiles */}
      {assignments.map(renderTile)}
    </div>
  );
}
