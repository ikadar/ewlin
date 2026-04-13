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
import {
  useGetSnapshotQuery,
  useComputeScheduleMutation,
  scheduleApi,
  useToggleCompletionMutation,
  useTogglePinMutation,
  useUpdateOutsourcingDatesMutation,
  useUnassignTaskMutation,
  useUpdateElementStatusMutation,
  useSplitTaskMutation,
  useFuseTaskMutation,
} from '../store';
import type { ComputeScheduleResult } from '../store';
import { useAppDispatch, useUpdateSTStatusMutation } from '../store';
import { isCtrlAltLetter } from '../utils/keyboardLayout';
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
import { JobDetailsPanel } from '../components/JobDetailsPanel/JobDetailsPanel';
import type { ElementStatusUpdate } from '../components/JobDetailsPanel/JobDetailsPanel';
import { UnavailabilityOverlay } from '../components/StationColumns/UnavailabilityOverlay';
import { TileSegment } from '../components/Tile/TileSegment';
import { LoadingSpinner } from '../components/LoadingSpinner/LoadingSpinner';
import { ErrorState } from '../components/ErrorState';
import { useVirtualScroll, isAssignmentVisible, useMassUnschedule } from '../hooks';
import { MassUnscheduleDialog } from '../components/MassUnscheduleDialog';

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
  return schedule[dayName] ?? { isOperating: false, slots: [] };
}

/** Parse "HH:MM" to minutes since midnight. */
function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Find unavailability gaps for an operator within a time range.
 * Returns gaps as [{gapStart: Date, gapEnd: Date}].
 */
function findOperatorGaps(
  operator: Operator,
  start: Date,
  end: Date,
): Array<{ gapStart: Date; gapEnd: Date }> {
  const gaps: Array<{ gapStart: Date; gapEnd: Date }> = [];
  const startMs = start.getTime();
  const endMs = end.getTime();

  // Iterate day by day
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);

  for (let d = new Date(dayStart); d.getTime() < endMs; d.setDate(d.getDate() + 1)) {
    const daySchedule = getOperatorDaySchedule(operator, d);
    const dayBase = d.getTime();

    if (!daySchedule.isOperating || !daySchedule.slots?.length) {
      // Entire day is a gap
      const gapStart = new Date(Math.max(dayBase, startMs));
      const gapEnd = new Date(Math.min(dayBase + 24 * 60 * 60000, endMs));
      if (gapStart < gapEnd) gaps.push({ gapStart, gapEnd });
      continue;
    }

    // Sort slots by start time
    const slots = [...daySchedule.slots].sort((a, b) => parseHHMM(a.start) - parseHHMM(b.start));

    // Gap before first slot
    const firstSlotStart = dayBase + parseHHMM(slots[0].start) * 60000;
    if (dayBase < firstSlotStart) {
      const gs = new Date(Math.max(dayBase, startMs));
      const ge = new Date(Math.min(firstSlotStart, endMs));
      if (gs < ge) gaps.push({ gapStart: gs, gapEnd: ge });
    }

    // Gaps between slots
    for (let i = 0; i < slots.length - 1; i++) {
      const slotEnd = dayBase + parseHHMM(slots[i].end) * 60000;
      const nextStart = dayBase + parseHHMM(slots[i + 1].start) * 60000;
      if (slotEnd < nextStart) {
        const gs = new Date(Math.max(slotEnd, startMs));
        const ge = new Date(Math.min(nextStart, endMs));
        if (gs < ge) gaps.push({ gapStart: gs, gapEnd: ge });
      }
    }

    // Gap after last slot
    const lastSlotEnd = dayBase + parseHHMM(slots[slots.length - 1].end) * 60000;
    const dayEnd = dayBase + 24 * 60 * 60000;
    if (lastSlotEnd < dayEnd) {
      const gs = new Date(Math.max(lastSlotEnd, startMs));
      const ge = new Date(Math.min(dayEnd, endMs));
      if (gs < ge) gaps.push({ gapStart: gs, gapEnd: ge });
    }
  }

  return gaps;
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
  const [toggleCompletion] = useToggleCompletionMutation();
  const [togglePin] = useTogglePinMutation();
  const [updateOutsourcingDates] = useUpdateOutsourcingDatesMutation();
  const [unassignTask] = useUnassignTaskMutation();
  const [updateElementStatus] = useUpdateElementStatusMutation();
  const [updateSTStatus] = useUpdateSTStatusMutation();
  const [splitTask] = useSplitTaskMutation();
  const [fuseTask] = useFuseTaskMutation();
  const dispatch = useAppDispatch();
  const invalidateSnapshot = useCallback(() => {
    dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
  }, [dispatch]);

  const [computeResult, setComputeResult] = useState<ComputeScheduleResult | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const massUnschedule = useMassUnschedule(snapshotData);
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
  const [focusedDate, setFocusedDate] = useState<Date | null>(new Date());
  const [viewportStartHour, setViewportStartHour] = useState<number>(0);
  const [viewportEndHour, setViewportEndHour] = useState<number>(8);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    setViewportHeight(container.clientHeight);

    const handleScroll = () => {
      const newScrollTop = container.scrollTop;
      setScrollTop(newScrollTop);

      // Sync focused date for DateStrip — use center of viewport (same as App.tsx)
      const viewportH = container.clientHeight;
      const centerY = newScrollTop + viewportH / 2;
      const hoursFromStart = centerY / pixelsPerHour;
      const fd = new Date(gridStartDate);
      fd.setTime(gridStartDate.getTime() + hoursFromStart * 60 * 60 * 1000);
      setFocusedDate(fd);

      // Viewport hour range — absolute hours from grid start (NOT % 24)
      const startH = newScrollTop / pixelsPerHour;
      const endH = (newScrollTop + viewportH) / pixelsPerHour;
      setViewportStartHour(startH);
      setViewportEndHour(endH);
    };

    const handleResize = () => {
      setViewportHeight(container.clientHeight);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    requestAnimationFrame(() => handleScroll()); // initial sync after layout

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [pixelsPerHour, gridStartDate]);

  // Scroll to current time on mount (use rAF to ensure scroll listener is attached first)
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const now = new Date();
      const y = timeToYPosition(now, START_HOUR, pixelsPerHour, gridStartDate);
      const vh = container.clientHeight;
      container.scrollTop = Math.max(0, y - vh / 3);
    });
  }, [pixelsPerHour, gridStartDate]);

  // ---- Data lookups ----
  const jobMap = useMemo(() => {
    const m = new Map<string, Job>();
    snapshot.jobs.forEach((j) => m.set(j.id, j));
    return m;
  }, [snapshot.jobs]);

  const selectedJob = selectedJobId ? jobMap.get(selectedJobId) ?? null : null;

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
          // Use operator-specific from/to for tile positioning if available
          if (opRef.from && opRef.to) {
            list.push({ ...a, scheduledStart: opRef.from, scheduledEnd: opRef.to });
          } else {
            list.push(a);
          }
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

  // ---- Job details panel handlers (same UX as station schedule) ----

  const handleRecallAssignment = useCallback(async (assignmentId: string) => {
    const assignment = snapshot.assignments.find((a) => a.taskId === assignmentId);
    if (!assignment) return;
    try { await unassignTask(assignment.taskId).unwrap(); } catch { /* ignore */ }
  }, [snapshot.assignments, unassignTask]);

  const handleElementStatusChange = useCallback(async (update: ElementStatusUpdate) => {
    try { await updateElementStatus(update).unwrap(); } catch { /* ignore */ }
  }, [updateElementStatus]);

  const handleOutsourcingDepartureChange = useCallback(async (taskId: string, departure: Date | undefined) => {
    try {
      await updateOutsourcingDates({ taskId, manualDeparture: departure?.toISOString() ?? null }).unwrap();
    } catch { /* ignore */ }
    invalidateSnapshot();
  }, [updateOutsourcingDates, invalidateSnapshot]);

  const handleOutsourcingReturnChange = useCallback(async (taskId: string, returnDate: Date | undefined) => {
    try {
      await updateOutsourcingDates({ taskId, manualReturn: returnDate?.toISOString() ?? null }).unwrap();
    } catch { /* ignore */ }
    invalidateSnapshot();
  }, [updateOutsourcingDates, invalidateSnapshot]);

  const handleToggleComplete = useCallback(async (assignmentId: string) => {
    try { await toggleCompletion(assignmentId).unwrap(); } catch { /* ignore */ }
  }, [toggleCompletion]);

  const handleToggleOutsourcedDone = useCallback(async (taskId: string) => {
    const task = snapshot.tasks.find((t) => t.id === taskId);
    if (!task || task.type !== 'Outsourced') return;
    const nextStatus = task.status === 'Completed' ? 'Ready' : 'Completed';
    try { await updateSTStatus({ taskId, status: nextStatus }).unwrap(); } catch { /* ignore */ }
    invalidateSnapshot();
  }, [snapshot.tasks, updateSTStatus, invalidateSnapshot]);

  const handleTogglePin = useCallback(async (assignmentId: string) => {
    try { await togglePin(assignmentId).unwrap(); } catch { /* ignore */ }
  }, [togglePin]);

  const handleSplitTask = useCallback(async (taskId: string) => {
    try { await splitTask(taskId).unwrap(); } catch { /* ignore */ }
  }, [splitTask]);

  const handleFuseTask = useCallback(async (taskId: string) => {
    try { await fuseTask(taskId).unwrap(); } catch { /* ignore */ }
  }, [fuseTask]);

  // ---- Keyboard navigation: Alt+Up/Down to cycle jobs ----
  const orderedJobIds = useMemo(() => snapshot.jobs.map(j => j.id), [snapshot.jobs]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Alt+Z: mass unschedule
      if (isCtrlAltLetter(e, 'z')) {
        e.preventDefault();
        massUnschedule.trigger();
        return;
      }

      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      e.preventDefault();
      if (orderedJobIds.length === 0) return;
      const direction = e.key === 'ArrowUp' ? -1 : 1;
      if (!selectedJobId) {
        setSelectedJobId(orderedJobIds[0]);
        return;
      }
      const idx = orderedJobIds.indexOf(selectedJobId);
      const newIdx = (idx + direction + orderedJobIds.length) % orderedJobIds.length;
      setSelectedJobId(orderedJobIds[newIdx]);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedJobId, orderedJobIds, setSelectedJobId, massUnschedule]);

  // ---- Now line ----
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);
  const nowPosition = timeToYPosition(now, START_HOUR, pixelsPerHour, gridStartDate);

  // Precompute tile slices for all operators (must be before early returns — hooks rule)
  const allTileSlices = useMemo(() => {
    const map = new Map<string, TileSlice[]>();
    for (const op of operators) {
      const opAssignments = assignmentsByOperator.get(op.id) ?? [];
      map.set(op.id, computeTileSlices(opAssignments, op, operators));
    }
    return map;
  }, [operators, assignmentsByOperator]);

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

  // ---- Render helper: build TileSegment for a slice ----
  function renderSlice(slice: TileSlice, operatorId: string) {
    const task = taskMap.get(slice.taskId);
    if (!task || !isInternalTask(task)) return null;

    const element = elementMap.get(task.elementId);
    const jobId = element?.jobId;
    const job = jobId ? jobMap.get(jobId) : undefined;
    if (!job) return null;

    const station = stationMap.get(task.stationId);
    const stationName = station?.name;

    // Find assignment for this slice (to get operator attention)
    const assignment = snapshot.assignments.find(a => a.id === slice.assignmentId);
    // Match operator segment by ID AND time overlap (an operator can have multiple
    // segments with different attention values: concurrent vs solo periods)
    const opRef = assignment?.operators?.find(o =>
      o.operatorId === operatorId &&
      new Date(o.from) < slice.to &&
      new Date(o.to) > slice.from
    ) ?? assignment?.operators?.find(o => o.operatorId === operatorId);
    const operatorAttention = opRef?.attention;

    const isLate = lateJobIds.has(job.id) || (!assignment?.isCompleted && new Date(slice.to) < now);
    const tileState = computeTileState(false, isLate, false, false, assignment?.isCompleted ?? false);

    const segTop = timeToYPosition(slice.from, START_HOUR, pixelsPerHour, gridStartDate);
    const segBottom = timeToYPosition(slice.to, START_HOUR, pixelsPerHour, gridStartDate);
    const segHeight = Math.max(segBottom - segTop, 8);

    const colWidth = OPERATOR_COLUMN_WIDTH - 8; // column minus padding
    const positionProps = slice.position === 'left'
      ? { overrideLeft: '0', overrideWidth: '49%' }
      : slice.position === 'right'
        ? { overrideLeft: '51%', overrideWidth: '49%' }
        : {};

    // SVG width must match the actual rendered width
    const svgWidth = slice.position === 'full' ? colWidth : Math.floor(colWidth * 0.48);

    const label = `${job.reference} · ${job.client}`;

    return (
      <TileSegment
        key={`${slice.assignmentId}-${slice.from.getTime()}-${slice.position}`}
        segmentKey={`${slice.assignmentId}-${slice.from.getTime()}`}
        label={label}
        stationName={stationName}
        top={segTop}
        height={segHeight}
        width={svgWidth}
        sawtoothTop={slice.sawtoothTop}
        sawtoothBottom={slice.sawtoothBottom}
        relayLabelBottom={slice.relayLabelBottom}
        relayLabelTop={slice.relayLabelTop}
        tileState={tileState}
        operatorAttention={operatorAttention}
        isMaskedTime={slice.isMasked}
        onClick={() => setSelectedJobId(job.id)}
        {...positionProps}
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

      {/* ---- Job Details Panel (between sidebar and grid) ---- */}
      {selectedJob && (
        <div className="shrink-0">
          <JobDetailsPanel
            job={selectedJob}
            tasks={snapshot.tasks}
            elements={snapshot.elements}
            assignments={snapshot.assignments}
            stations={snapshot.stations}
            categories={snapshot.categories}
            providers={snapshot.providers}
            onClose={() => setSelectedJobId(null)}
            onRecallTask={handleRecallAssignment}
            onElementStatusChange={handleElementStatusChange}
            onToggleComplete={handleToggleComplete}
            onToggleOutsourcedDone={handleToggleOutsourcedDone}
            onTogglePin={handleTogglePin}
            onDepartureChange={handleOutsourcingDepartureChange}
            onReturnChange={handleOutsourcingReturnChange}
            onSplitTask={handleSplitTask}
            onFuseTask={handleFuseTask}
            lateJobIds={lateJobIds}
            allJobs={snapshot.jobs}
            onSelectJob={setSelectedJobId}
            snapshotOperators={snapshot.operators}
          />
        </div>
      )}

      {/* ---- Main content ---- */}
      <div className="flex-1 flex flex-col overflow-hidden">
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
                    const opSlices = allTileSlices.get(op.id) ?? [];
                    return (
                      <OperatorColumn
                        key={op.id}
                        operator={op}
                        slices={opSlices}
                        totalHeight={totalHeight}
                        pixelsPerHour={pixelsPerHour}
                        gridStartDate={gridStartDate}
                        visibleDayRange={virtualScroll.visibleRange}
                        renderSlice={renderSlice}
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
        className="fixed bottom-24 right-6 z-40 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white shadow-lg transition-all flex items-center justify-center"
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

      {/* ---- Mass unschedule confirmation dialog ---- */}
      {massUnschedule.confirmState && (
        <MassUnscheduleDialog
          state={massUnschedule.confirmState}
          getClearableCount={massUnschedule.getClearableCount}
          onConfirm={massUnschedule.confirm}
          onDismiss={massUnschedule.dismiss}
          onUpdate={massUnschedule.setConfirmState}
        />
      )}

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
// Overlap layout for masked-time side-by-side tiles
// ============================================================================

/**
 * Compute overlap info for assignments in one operator column.
 * Returns a map of taskId → { hasOverlap, isMasked } for tile width overrides.
 */
/** A rendered slice of a tile — one contiguous segment with fixed position. */
interface TileSlice {
  assignmentId: string;
  taskId: string;
  from: Date;
  to: Date;
  position: 'full' | 'left' | 'right';
  isMasked: boolean;
  sawtoothTop: boolean;
  sawtoothBottom: boolean;
  relayLabelTop?: string;
  relayLabelBottom?: string;
}

/**
 * Check if a timestamp is inside an operator's working hours.
 */
function isOperatorWorking(operator: Operator, timestamp: Date): boolean {
  const daySchedule = getOperatorDaySchedule(operator, timestamp);
  if (!daySchedule.isOperating || !daySchedule.slots?.length) return false;
  const h = timestamp.getHours();
  const m = timestamp.getMinutes();
  const mins = h * 60 + m;
  return daySchedule.slots.some(slot => {
    const slotStart = parseHHMM(slot.start);
    const slotEnd = parseHHMM(slot.end);
    return mins >= slotStart && mins < slotEnd;
  });
}

/**
 * Compute tile slices for an operator column.
 * Two passes:
 *   1. Overlap segmentation: split at concurrency change points
 *   2. Gap segmentation: split at unavailability boundaries, add sawtooth edges
 */
function computeTileSlices(
  assignments: TaskAssignment[],
  operator: Operator,
  allOperators: Operator[],
): TileSlice[] {
  if (assignments.length === 0) return [];

  const entries = assignments.map(a => ({
    id: a.id,
    taskId: a.taskId,
    startMs: new Date(a.scheduledStart).getTime(),
    endMs: new Date(a.scheduledEnd).getTime(),
    isMasked: a.isMaskedTime ?? false,
    assignment: a,
  }));

  // ── Pass 1: Overlap segmentation ──
  // Collect concurrency change points
  const boundarySet = new Set<number>();
  for (const e of entries) {
    boundarySet.add(e.startMs);
    boundarySet.add(e.endMs);
  }
  const boundaries = [...boundarySet].sort((a, b) => a - b);

  let rawSlices: TileSlice[] = [];

  for (let b = 0; b < boundaries.length - 1; b++) {
    const sliceStart = boundaries[b];
    const sliceEnd = boundaries[b + 1];
    if (sliceEnd - sliceStart < 30000) continue;

    const active = entries.filter(e => e.startMs < sliceEnd && e.endMs > sliceStart);
    if (active.length === 0) continue;

    if (active.length === 1) {
      rawSlices.push({
        assignmentId: active[0].id, taskId: active[0].taskId,
        from: new Date(sliceStart), to: new Date(sliceEnd),
        position: 'full', isMasked: active[0].isMasked,
        sawtoothTop: false, sawtoothBottom: false,
      });
    } else {
      // Sort so masked tasks come first (left), then by start time
      const sorted = [...active].sort((x, y) =>
        x.isMasked === y.isMasked ? x.startMs - y.startMs : x.isMasked ? -1 : 1
      );
      for (let idx = 0; idx < sorted.length; idx++) {
        const a = sorted[idx];
        rawSlices.push({
          assignmentId: a.id, taskId: a.taskId,
          from: new Date(sliceStart), to: new Date(sliceEnd),
          position: idx === 0 ? 'left' : 'right', isMasked: a.isMasked,
          sawtoothTop: false, sawtoothBottom: false,
        });
      }
    }
  }

  // Merge adjacent slices with same assignment + position
  rawSlices = mergeAdjacentSlices(rawSlices);

  // ── Pass 2: Gap segmentation ──
  // For each slice, split it at operator unavailability gaps
  const finalSlices: TileSlice[] = [];

  for (const slice of rawSlices) {
    const gaps = findOperatorGaps(operator, slice.from, slice.to);
    // Keep gaps that split the slice: gap start must be inside the slice
    const splittingGaps = gaps.filter(g => {
      const gs = g.gapStart.getTime();
      const ss = slice.from.getTime();
      const se = slice.to.getTime();
      // Gap must start strictly after slice start and before slice end
      return gs > ss + 30000 && gs < se - 30000;
    });

    if (splittingGaps.length === 0) {
      finalSlices.push(slice);
      continue;
    }

    // Split at gap boundaries
    const segments: Array<{ start: Date; end: Date }> = [];
    let segStart = slice.from;
    for (const gap of splittingGaps) {
      if (gap.gapStart.getTime() > segStart.getTime() + 30000) {
        segments.push({ start: segStart, end: gap.gapStart });
      }
      segStart = gap.gapEnd;
    }
    if (slice.to.getTime() > segStart.getTime() + 30000) {
      segments.push({ start: segStart, end: slice.to });
    }
    if (segments.length === 0) {
      // All segments were too small — skip
      continue;
    }

    for (let i = 0; i < segments.length; i++) {
      const isFirst = i === 0;
      const isLast = i === segments.length - 1;
      const sawBottom = !isLast;
      const sawTop = !isFirst;

      // Relay labels
      let relayBottom: string | undefined;
      let relayTop: string | undefined;

      if (sawBottom) {
        const gap = splittingGaps[i];
        const otherOp = slice.isMasked ? undefined : findRelayOperator(entries, slice.assignmentId, operator, gap, allOperators);
        relayBottom = otherOp ?? '→ pause';
      }
      if (sawTop) {
        const gap = splittingGaps[i - 1];
        const otherOp = slice.isMasked ? undefined : findRelayOperator(entries, slice.assignmentId, operator, gap, allOperators);
        relayTop = otherOp ? otherOp.replace('→ ', '') + ' →' : 'reprise →';
      }

      finalSlices.push({
        ...slice,
        from: segments[i].start,
        to: segments[i].end,
        sawtoothTop: sawTop,
        sawtoothBottom: sawBottom,
        relayLabelBottom: relayBottom,
        relayLabelTop: relayTop,
      });
    }
  }

  return finalSlices;
}

function findRelayOperator(
  entries: Array<{ id: string; assignment: TaskAssignment }>,
  assignmentId: string,
  currentOp: Operator,
  gap: { gapStart: Date; gapEnd: Date },
  allOperators: Operator[],
): string | undefined {
  const entry = entries.find(e => e.id === assignmentId);
  if (!entry) return undefined;
  const otherOp = entry.assignment.operators?.find(o => {
    if (o.operatorId === currentOp.id) return false;
    if (!o.from || !o.to) return false;
    const opFrom = new Date(o.from).getTime();
    const opTo = new Date(o.to).getTime();
    return opFrom <= gap.gapEnd.getTime() && opTo >= gap.gapStart.getTime();
  });
  if (otherOp) {
    const op = allOperators.find(o => o.id === otherOp.operatorId);
    return op ? `→ ${op.firstName} ${op.lastName}` : undefined;
  }
  return undefined;
}

function mergeAdjacentSlices(slices: TileSlice[]): TileSlice[] {
  const merged: TileSlice[] = [];
  for (const s of slices) {
    const prev = merged.length > 0 ? merged[merged.length - 1] : null;
    if (prev
      && prev.assignmentId === s.assignmentId
      && prev.position === s.position
      && prev.to.getTime() === s.from.getTime()
    ) {
      prev.to = s.to;
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

// ============================================================================
// OperatorColumn sub-component
// ============================================================================

interface OperatorColumnProps {
  operator: Operator;
  slices: TileSlice[];
  totalHeight: number;
  pixelsPerHour: number;
  gridStartDate: Date;
  visibleDayRange: { start: number; end: number };
  renderSlice: (slice: TileSlice, operatorId: string) => React.ReactNode;
  onDeselect: () => void;
}

/**
 * A single operator column: unavailability overlays + hour grid lines + tiles.
 * Styled like StationColumn (same width, hatched overlay via UnavailabilityOverlay + bg-stripes-dark).
 */
function OperatorColumn({
  operator,
  slices,
  totalHeight,
  pixelsPerHour,
  gridStartDate,
  visibleDayRange,
  renderSlice,
  onDeselect,
}: OperatorColumnProps) {
  const numberOfDays = Math.ceil(totalHeight / (24 * pixelsPerHour));

  // Hour grid lines (only visible range)
  const gridLines = useMemo(() => {
    const lines: number[] = [];
    const startDay = visibleDayRange.start;
    const endDay = visibleDayRange.end;
    for (let dayIndex = startDay; dayIndex <= endDay; dayIndex++) {
      for (let h = 0; h < 24; h++) {
        lines.push((dayIndex * 24 + h) * pixelsPerHour);
      }
    }
    return lines;
  }, [visibleDayRange, pixelsPerHour]);

  // Unavailability overlays (only visible range)
  const overlays = useMemo(() => {
    const startDay = visibleDayRange.start;
    const endDay = visibleDayRange.end;
    const elements: React.ReactNode[] = [];

    for (let dayIndex = startDay; dayIndex <= endDay; dayIndex++) {
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
  }, [operator, gridStartDate, pixelsPerHour, visibleDayRange]);

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

      {/* Tiles (rendered from slices) */}
      {slices.map(s => renderSlice(s, operator.id))}
    </div>
  );
}
