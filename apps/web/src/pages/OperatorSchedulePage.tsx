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
  useClearJobAssignmentsMutation,
  useBatchSetPinMutation,
} from '../store';
import type { ComputeScheduleResult } from '../store';
import { useAppDispatch, useUpdateSTStatusMutation } from '../store';
import { isAltLetter, isCtrlAltLetter } from '../utils/keyboardLayout';
import { getTasksForJob } from '../utils';
import { getErrorMessage } from '../store/api/errorNormalization';
import { ZOOM_LEVELS } from '../utils/zoom';
import { computeTileSlices, getOperatorDaySchedule, type TileSlice } from '../utils/operatorTileSlices';
import { isInternalTask } from '@flux/types';
import type {
  Operator,
  TaskAssignment,
  ScheduleSnapshot,
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
import { OperatorHeader } from '../components/OperatorHeaders';
import { LoadingSpinner } from '../components/LoadingSpinner/LoadingSpinner';
import { ErrorState } from '../components/ErrorState';
import { useVirtualScroll, isAssignmentVisible, useMassUnschedule, useToast } from '../hooks';
import { MassUnscheduleDialog } from '../components/MassUnscheduleDialog';
import { ComputeModal } from '../components/ComputeModal/ComputeModal';
import { SmartCompactModal } from '../components/SmartCompactModal';
import { ScheduleEvaluationModal } from '../components/ScheduleEvaluationModal';
import { ShortcutFooter } from '../components/ShortcutFooter/ShortcutFooter';

// ============================================================================
// Constants (matching App.tsx)
// ============================================================================

const START_HOUR = 0;
const DAY_COUNT = 365;
const OPERATOR_COLUMN_WIDTH = 240; // w-60 = 15rem = 240px (same as default station column)

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
  const [clearJobAssignments] = useClearJobAssignmentsMutation();
  const [batchSetPin] = useBatchSetPinMutation();
  const dispatch = useAppDispatch();
  const invalidateSnapshot = useCallback(() => {
    dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
  }, [dispatch]);
  const { showToast } = useToast();

  const [computeModalMode, setComputeModalMode] = useState<'full' | 'selective' | 'incremental' | null>(null);
  const [computeModalJobId, setComputeModalJobId] = useState<string | undefined>(undefined);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const massUnschedule = useMassUnschedule(snapshotData);
  const [pixelsPerHour, setPixelsPerHour] = useState(DEFAULT_PIXELS_PER_HOUR);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isSmartCompactOpen, setIsSmartCompactOpen] = useState(false);
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false);

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
          // Put this specific opRef first and drop the operator's other opRefs, so
          // computeTileSlices resolves the correct window per push. Other operators
          // remain visible to findRelayOperator.
          const otherOperators = a.operators.filter(o => o.operatorId !== opRef.operatorId);
          list.push({ ...a, operators: [opRef, ...otherOperators] });
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
  const handleComputeSchedule = useCallback(() => {
    setComputeModalJobId(undefined);
    setComputeModalMode('full');
  }, []);

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

  // Selective compute: place one job in the gaps
  const handleComputeJob = useCallback((jobId: string) => {
    setComputeModalJobId(jobId);
    setComputeModalMode('selective');
  }, []);

  // Incremental compute: place all unplaced jobs in the gaps
  const handleComputeIncremental = useCallback(() => {
    setComputeModalJobId(undefined);
    setComputeModalMode('incremental');
  }, []);

  // Clear all tiles for selected job (Alt+Z)
  const handleClearJobAssignments = useCallback(async () => {
    if (!selectedJobId) return;
    try {
      const result = await clearJobAssignments(selectedJobId).unwrap();
      showToast(`${result.unassignedCount} tuile(s) effacée(s)`, 'success');
    } catch (err) {
      showToast(getErrorMessage(err));
    }
  }, [selectedJobId, clearJobAssignments, showToast]);

  // Pin/unpin all placed tiles for selected job (Alt+F)
  const handlePinAllJobTiles = useCallback(async () => {
    if (!selectedJobId) return;
    const jobTaskIds = new Set(
      getTasksForJob(selectedJobId, snapshot.tasks, snapshot.elements).map((t) => t.id)
    );
    const jobAssignments = snapshot.assignments.filter((a) => jobTaskIds.has(a.taskId));
    if (jobAssignments.length === 0) return;

    const allPinned = jobAssignments.every((a) => a.isPinned);
    const targetPinned = !allPinned;
    const taskIds = jobAssignments
      .filter((a) => a.isPinned !== targetPinned)
      .map((a) => a.taskId);

    if (taskIds.length === 0) return;

    try {
      await batchSetPin({ taskIds, isPinned: targetPinned }).unwrap();
      showToast(
        targetPinned
          ? `${taskIds.length} tuile(s) épinglée(s)`
          : `${taskIds.length} tuile(s) désépinglée(s)`,
        'success'
      );
    } catch (err) {
      showToast(getErrorMessage(err));
    }
  }, [selectedJobId, snapshot.tasks, snapshot.elements, snapshot.assignments, batchSetPin, showToast]);

  // Smart compaction complete handler
  const handleSmartCompactComplete = useCallback(() => {
    invalidateSnapshot();
  }, [invalidateSnapshot]);

  // Zoom change handler — maintains scroll center position
  const handleZoomChange = useCallback((newPixelsPerHour: number) => {
    const container = scrollContainerRef.current;
    if (!container) {
      setPixelsPerHour(newPixelsPerHour);
      return;
    }
    const viewportH = container.clientHeight;
    const centerY = container.scrollTop + viewportH / 2;
    const centerHours = centerY / pixelsPerHour;
    setPixelsPerHour(newPixelsPerHour);
    requestAnimationFrame(() => {
      const newCenterY = centerHours * newPixelsPerHour;
      container.scrollTop = Math.max(0, newCenterY - viewportH / 2);
    });
  }, [pixelsPerHour]);

  // ---- Keyboard shortcuts (harmonized with station schedule) ----
  const orderedJobIds = useMemo(() => snapshot.jobs.map(j => j.id), [snapshot.jobs]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ---- Escape: close selected job ----
      if (e.key === 'Escape' && selectedJobId) {
        e.preventDefault();
        setSelectedJobId(null);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      // ---- Home: jump to today ----
      if (e.key === 'Home' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const container = scrollContainerRef.current;
        if (container) {
          const now = new Date();
          const y = timeToYPosition(now, START_HOUR, pixelsPerHour, gridStartDate);
          const vh = container.clientHeight;
          container.scrollTo({ top: Math.max(0, y - vh / 2), behavior: 'smooth' });
        }
        return;
      }

      // ---- PageUp / PageDown: scroll ±1 day ----
      if ((e.key === 'PageUp' || e.key === 'PageDown') && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const container = scrollContainerRef.current;
        if (container) {
          const oneDayPixels = 24 * pixelsPerHour;
          const direction = e.key === 'PageUp' ? -1 : 1;
          container.scrollBy({ top: direction * oneDayPixels, behavior: 'smooth' });
        }
        return;
      }

      // ---- Alt+D: jump to departure/deadline ----
      if (e.altKey && e.code === 'KeyD' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (selectedJob?.workshopExitDate && scrollContainerRef.current) {
          const departureDate = new Date(selectedJob.workshopExitDate);
          const y = timeToYPosition(departureDate, START_HOUR, pixelsPerHour, gridStartDate);
          const vh = scrollContainerRef.current.clientHeight;
          scrollContainerRef.current.scrollTo({ top: Math.max(0, y - vh + 100), behavior: 'smooth' });
        }
        return;
      }

      // ---- Ctrl+Alt+C: smart compaction ----
      if (isCtrlAltLetter(e, 'c')) {
        e.preventDefault();
        setIsSmartCompactOpen(true);
        return;
      }

      // ---- Ctrl+Alt+E: schedule evaluation ----
      if (isCtrlAltLetter(e, 'e')) {
        e.preventDefault();
        setIsEvaluationOpen(true);
        return;
      }

      // ---- Ctrl+Alt+Z: mass unschedule ----
      if (isCtrlAltLetter(e, 'z')) {
        e.preventDefault();
        massUnschedule.trigger();
        return;
      }

      // ---- Ctrl+Alt+P: incremental compute (all unplaced) ----
      if (isCtrlAltLetter(e, 'p')) {
        e.preventDefault();
        handleComputeIncremental();
        return;
      }

      // ---- Alt+P: selective compute (selected job) ----
      if (isAltLetter(e, 'p')) {
        e.preventDefault();
        if (selectedJobId) {
          handleComputeJob(selectedJobId);
        }
        return;
      }

      // ---- Alt+F: pin/unpin all tiles for selected job ----
      if (isAltLetter(e, 'f') && selectedJobId) {
        e.preventDefault();
        handlePinAllJobTiles();
        return;
      }

      // ---- Alt+Z: clear all tiles for selected job ----
      if (isAltLetter(e, 'z') && selectedJobId) {
        e.preventDefault();
        handleClearJobAssignments();
        return;
      }

      // ---- Alt+B: toggle sidebar ----
      if (isAltLetter(e, 'b')) {
        e.preventDefault();
        setIsSidebarVisible(prev => !prev);
        return;
      }

      // ---- Ctrl+Plus: zoom in ----
      if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        const idx = ZOOM_LEVELS.findIndex(z => z.pixelsPerHour === pixelsPerHour);
        if (idx < ZOOM_LEVELS.length - 1) {
          handleZoomChange(ZOOM_LEVELS[idx + 1].pixelsPerHour);
        }
        return;
      }

      // ---- Ctrl+Minus: zoom out ----
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        const idx = ZOOM_LEVELS.findIndex(z => z.pixelsPerHour === pixelsPerHour);
        if (idx > 0) {
          handleZoomChange(ZOOM_LEVELS[idx - 1].pixelsPerHour);
        }
        return;
      }

      // ---- Alt+Up/Down: navigate between jobs ----
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
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
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedJobId, selectedJob, orderedJobIds, pixelsPerHour, gridStartDate,
    massUnschedule, handleComputeIncremental, handleComputeJob,
    handleClearJobAssignments, handlePinAllJobTiles, handleZoomChange,
  ]);

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

    // Build the setup window (wall-clock start of the task's first tile
    // + setupMinutes). The engine's scheduled_start is the task's global
    // start, so the setup window is `[scheduledStart, scheduledStart + setupMinutes]`.
    const setupMinutes = task.duration?.setupMinutes ?? 0;
    const taskStart = assignment ? new Date(assignment.scheduledStart) : null;
    const setupWindow = setupMinutes > 0 && taskStart
      ? { start: taskStart, end: new Date(taskStart.getTime() + setupMinutes * 60_000) }
      : undefined;

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
        segFrom={slice.from}
        segTo={slice.to}
        setupWindow={setupWindow}
        recalages={assignment?.recalages}
        {...positionProps}
      />
    );
  }

  // minWidth so horizontal scroll works for many operators
  const gridMinWidth = 48 + OPERATOR_COLUMN_WIDTH * operators.length; // 48 = timeline w-12

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
    <div className="flex-1 flex overflow-hidden">
      {/* ---- Left sidebar: JobsList ---- */}
      {isSidebarVisible && (
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
      )}

      {/* ---- Job Details Panel (between sidebar and grid) ---- */}
      {isSidebarVisible && selectedJob && (
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
            onComputeJob={handleComputeJob}
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
                    <OperatorHeader key={op.id} operator={op} columnWidth={OPERATOR_COLUMN_WIDTH} />
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
        disabled={computeModalMode !== null}
        className="fixed bottom-24 right-6 z-40 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white shadow-lg transition-all flex items-center justify-center"
        aria-label="Calculer le planning"
        title="Calculer le planning (recalcul complet)"
        data-testid="compute-schedule-fab-operator"
      >
        <Cpu size={20} />
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

      {/* ---- Compute modal (real-time SSE) ---- */}
      <ComputeModal
        mode={computeModalMode}
        jobId={computeModalJobId}
        snapshot={snapshot}
        onDone={() => { /* snapshot will auto-refresh via invalidatesTags */ invalidateSnapshot(); }}
        onDismiss={() => setComputeModalMode(null)}
        onComputeIncremental={handleComputeIncremental}
        onComputeFull={handleComputeSchedule}
      />

      {/* ---- Smart compaction modal ---- */}
      <SmartCompactModal
        isOpen={isSmartCompactOpen}
        onClose={() => setIsSmartCompactOpen(false)}
        onComplete={handleSmartCompactComplete}
      />

      {/* ---- Schedule evaluation modal ---- */}
      <ScheduleEvaluationModal
        isOpen={isEvaluationOpen}
        onClose={() => setIsEvaluationOpen(false)}
      />
    </div>

      {/* ---- Shortcut footer ---- */}
      <ShortcutFooter mode={selectedJobId ? 'operatorJobSelected' : 'operatorDefault'} />
    </div>
  );
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
