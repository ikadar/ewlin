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
import { useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { JobModificationContainer } from '@/components/JcfModificationModal/JobModificationContainer';
import {
  useGetSnapshotQuery,
  useGetProdSnapshotQuery,
  useComputeScheduleMutation,
  scheduleApi,
  useToggleCompletionMutation,
  useTogglePinMutation,
  useUpdateOutsourcingDatesMutation,
  useUnassignTaskMutation,
  useSplitTaskMutation,
  useFuseTaskMutation,
  useClearJobAssignmentsMutation,
  useBatchSetPinMutation,
  useGetPaperLeadTimeQuery,
  useGetFormeLeadTimeQuery,
  useGetPlateLeadTimeQuery,
} from '../store';
import type { ComputeScheduleResult } from '../store';
import { useAppDispatch, useUpdateSTStatusMutation, setFocusedDate as setFocusedDateRedux } from '../store';
import { useSaisieModal } from '../contexts/SaisieModalContext';
import { SetStartTimeDialog } from '../components/SetStartTimeDialog/SetStartTimeDialog';
import { TileContextMenu } from '../components/Tile';
import { isAltLetter, isCtrlAltLetter } from '../utils/keyboardLayout';
import { useScenarioMode } from '../contexts/ScenarioContext';
import { useNow } from '../contexts/NowContext';
import { getNow } from '../utils/getNow';
import { getTasksForJob } from '../utils';
import { getProduitLabel } from '../utils/tileLabelResolver';
import { getErrorMessage } from '../store/api/errorNormalization';
import { ZOOM_LEVELS } from '../utils/zoom';
import {
  computeTileSlices,
  getOperatorDaySchedule,
  getOperatorOvertimePeriodsForDay,
  type TileSlice,
} from '../utils/operatorTileSlices';
import { computeCollapses } from '../utils/computeCollapses';
import type { Collapse } from '../components/SchedulingGrid/collapseConfig';
import { CollapseBand } from '../components/SchedulingGrid/CollapseBand';
import { yPositionToTime } from '../components/DragPreview/snapUtils';
import { isInternalTask } from '@flux/types';
import { TimelineLens, useTimelineLens, LENS_PIXELS_PER_HOUR } from '../components/TimelineLens';
import {
  computeOperatorUnavailabilitySegments,
  computeOperatorOvertimeSegments,
} from '../components/TimelineLens/unavailability';
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
import { isCompletedEffective } from '../components/Tile/colorUtils';
import { JobDetailsPanel } from '../components/JobDetailsPanel/JobDetailsPanel';
import { UnavailabilityOverlay } from '../components/StationColumns/UnavailabilityOverlay';
import { OvertimeOverlay } from '../components/StationColumns/OvertimeOverlay';
import { TileSegment } from '../components/Tile/TileSegment';
import { computeChunkProgress } from '../components/Tile/saisieMath';
import { SafetyBand } from '../components/SafetyBand';
import { buildSequenceIndexLookup, isInSafetyZone, makeSafetyKey } from '../utils/safetyZone';
import { useSetSafetyOverrideMutation } from '../store';
import { OperatorHeader } from '../components/OperatorHeaders';
import { LoadingSpinner } from '../components/LoadingSpinner/LoadingSpinner';
import { ErrorState } from '../components/ErrorState';
import { useVirtualScroll, isAssignmentVisible, useMassUnschedule } from '../hooks';
import { useToast } from '../hooks/useToast';
import { useLiftAndRecompute } from '../hooks/useLiftAndRecompute';
import { MassUnscheduleDialog } from '../components/MassUnscheduleDialog';
import { RazFab } from '../components/RazFab/RazFab';
import { ComputeModal } from '../components/ComputeModal/ComputeModal';
import { useAutoRecomputeCtx } from '../contexts/AutoRecomputeContext';
import { runBackgroundLns } from '../hooks/autoRecomputeRuntime';
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
  // V1 versioning: in prod we read the frozen plan blob (merged with the
  // live completion overlay) from /scenarios/prod/snapshot. In préprod we
  // keep the regular live /schedule/snapshot. The two queries are gated
  // via `skip` so only one fires at a time, and the consumer below picks
  // whichever has data.
  const { mode: scenarioModeForSnapshot } = useScenarioMode();
  const preprodSnapshot = useGetSnapshotQuery(undefined, {
    skip: scenarioModeForSnapshot === 'prod',
  });
  const prodSnapshot = useGetProdSnapshotQuery(undefined, {
    skip: scenarioModeForSnapshot !== 'prod',
  });
  const snapshotData = scenarioModeForSnapshot === 'prod' ? prodSnapshot.data : preprodSnapshot.data;
  const isLoading = scenarioModeForSnapshot === 'prod' ? prodSnapshot.isLoading : preprodSnapshot.isLoading;
  const isError = scenarioModeForSnapshot === 'prod' ? prodSnapshot.isError : preprodSnapshot.isError;
  const error = scenarioModeForSnapshot === 'prod' ? prodSnapshot.error : preprodSnapshot.error;

  // Paper lead-time (shop-wide). Threaded into JobDetailsPanel so the
  // gate pill tooltip displays the configured delay.
  const { data: paperLeadTime } = useGetPaperLeadTimeQuery();
  const { data: formeLeadTime } = useGetFormeLeadTimeQuery();
  const { data: plateLeadTime } = useGetPlateLeadTimeQuery();
  const refetch = scenarioModeForSnapshot === 'prod' ? prodSnapshot.refetch : preprodSnapshot.refetch;

  const [computeSchedule, { isLoading: isComputingSchedule }] = useComputeScheduleMutation();
  const [toggleCompletion] = useToggleCompletionMutation();
  const [togglePin] = useTogglePinMutation();
  const [updateOutsourcingDates] = useUpdateOutsourcingDatesMutation();
  const [unassignTask] = useUnassignTaskMutation();
  const [updateSTStatus] = useUpdateSTStatusMutation();
  const [splitTask] = useSplitTaskMutation();
  const [fuseTask] = useFuseTaskMutation();
  const [clearJobAssignments] = useClearJobAssignmentsMutation();
  const [batchSetPin] = useBatchSetPinMutation();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const invalidateSnapshot = useCallback(() => {
    dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
  }, [dispatch]);
  const { showToast } = useToast();
  const autoRecompute = useAutoRecomputeCtx();
  const liftAndRecompute = useLiftAndRecompute();

  const [computeModalMode, setComputeModalMode] = useState<'full' | 'selective' | 'incremental' | null>(null);
  const [computeModalJobId, setComputeModalJobId] = useState<string | undefined>(undefined);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [editingJobInternalId, setEditingJobInternalId] = useState<string | null>(null);
  const massUnschedule = useMassUnschedule(snapshotData);
  const [pixelsPerHour, setPixelsPerHour] = useState(DEFAULT_PIXELS_PER_HOUR);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isSmartCompactOpen, setIsSmartCompactOpen] = useState(false);
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Callback-ref state: the scroll container JSX is rendered below an
  // `if (isLoading) return <LoadingSpinner/>` gate, so the container mounts
  // *after* the effects below first run. Tracking it as state re-runs the
  // effects once the container actually exists, so listeners + ResizeObserver
  // attach instead of silently no-op'ing forever.
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const setScrollContainerRef = useCallback((el: HTMLDivElement | null) => {
    scrollContainerRef.current = el;
    setScrollContainer(el);
  }, []);

  const snapshot = useMemo(() => snapshotData ?? defaultSnapshot, [snapshotData]);
  const operators = snapshot.operators ?? [];

  const lookbackDays = snapshot.lookbackDays ?? 6;
  const gridStartDate = useMemo(() => {
    const d = getNow();
    d.setDate(d.getDate() - lookbackDays);
    d.setHours(START_HOUR, 0, 0, 0);
    return d;
  }, [lookbackDays]);

  // ---- Virtual scrolling (same as SchedulingGrid) ----
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const dayHeightPx = 24 * pixelsPerHour;

  // ---- Collapse empty periods ----
  // Compute collapses across the full grid range (gridStartDate → +DAY_COUNT days).
  const gridEndDate = useMemo(
    () => new Date(gridStartDate.getTime() + DAY_COUNT * 24 * 60 * 60 * 1000),
    [gridStartDate],
  );
  const effectiveCollapses = useMemo<readonly Collapse[]>(
    () => computeCollapses(operators, gridStartDate, gridEndDate),
    [operators, gridStartDate, gridEndDate],
  );

  // Virtual scroll thinks linearly (`start = floor(scrollTop / dayHeightPx)`).
  // After collapse, scrollTop is collapse-aware (smaller than linear), so feeding
  // it raw produces wrong day indices → tiles, gridLines, overlays disappear.
  // Convert via yPositionToTime → linear equivalent before handing to the hook.
  const linearScrollTop = useMemo(() => {
    if (effectiveCollapses.length === 0) return scrollTop;
    const t = yPositionToTime(scrollTop, START_HOUR, gridStartDate, pixelsPerHour, effectiveCollapses);
    return ((t.getTime() - gridStartDate.getTime()) / 3_600_000) * pixelsPerHour;
  }, [scrollTop, effectiveCollapses, gridStartDate, pixelsPerHour]);

  const virtualScroll = useVirtualScroll({
    totalDays: DAY_COUNT,
    bufferDays: 3,
    dayHeightPx,
    scrollTop: linearScrollTop,
    viewportHeight,
  });

  // Collapse-aware total height: each band trades real height for its heightPx.
  const totalHeight = useMemo(() => {
    let h = virtualScroll.totalHeight;
    for (const c of effectiveCollapses) {
      h -= (c.durationHours * pixelsPerHour - c.heightPx);
    }
    return h;
  }, [virtualScroll.totalHeight, effectiveCollapses, pixelsPerHour]);

  // Track scroll position for virtual scrolling + DateStrip sync
  const [focusedDate, setFocusedDate] = useState<Date | null>(new Date());
  const [viewportStartHour, setViewportStartHour] = useState<number>(0);
  const [viewportEndHour, setViewportEndHour] = useState<number>(8);

  useEffect(() => {
    if (!scrollContainer) return;
    const container = scrollContainer;

    const handleScroll = () => {
      const newScrollTop = container.scrollTop;
      setScrollTop(newScrollTop);

      // Sync focused date for DateStrip — use center of viewport.
      // Collapse-aware: yPositionToTime resolves piecewise so the focused date
      // stays correct when bands consume part of the visible Y range.
      const viewportH = container.clientHeight;
      const centerY = newScrollTop + viewportH / 2;
      const fd = yPositionToTime(centerY, START_HOUR, gridStartDate, pixelsPerHour, effectiveCollapses);
      setFocusedDate(fd);
      dispatch(setFocusedDateRedux(fd.toISOString()));

      // Viewport hour range — collapse-aware. With collapses, the visible Y span
      // covers MORE wall-clock time than `viewportH / pxPerHour` linearly suggests
      // (a 60-px band hides up to dozens of hours), so the DateStrip indicator
      // must be derived from the actual top/bottom times.
      const topTime = yPositionToTime(newScrollTop, START_HOUR, gridStartDate, pixelsPerHour, effectiveCollapses);
      const bottomTime = yPositionToTime(newScrollTop + viewportH, START_HOUR, gridStartDate, pixelsPerHour, effectiveCollapses);
      const startH = (topTime.getTime() - gridStartDate.getTime()) / 3_600_000;
      const endH = (bottomTime.getTime() - gridStartDate.getTime()) / 3_600_000;
      setViewportStartHour(startH);
      setViewportEndHour(endH);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    requestAnimationFrame(() => handleScroll()); // initial sync after layout

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [scrollContainer, pixelsPerHour, gridStartDate, effectiveCollapses]);

  // Keep viewportHeight in sync with the container via ResizeObserver, so panel
  // toggles (JobDetailsPanel, sidebar, SmartCompact, Evaluation) that change
  // layout without a window resize don't leave it stale — a stale viewport
  // combined with scrollTop races can collapse the virtual range and hide
  // hachures + arrière-plan.
  useEffect(() => {
    if (!scrollContainer) return;
    const container = scrollContainer;

    const syncViewportHeight = () => {
      const h = container.clientHeight;
      if (h > 0) setViewportHeight(h);
    };

    syncViewportHeight();
    const resizeObserver = new ResizeObserver(syncViewportHeight);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [scrollContainer]);

  // Scroll to current time on mount — or to the date passed via navigation state
  // (planning view toggle preserves calendar position when switching views)
  const navFocusedDate = (location.state as { focusedDate?: string } | null)?.focusedDate;
  useEffect(() => {
    if (!scrollContainer) return;
    const container = scrollContainer;
    requestAnimationFrame(() => {
      const target = navFocusedDate ? new Date(navFocusedDate) : new Date();
      const y = timeToYPosition(target, START_HOUR, pixelsPerHour, gridStartDate, effectiveCollapses);
      const vh = container.clientHeight;
      container.scrollTop = Math.max(0, y - vh / 2);
    });
  }, [scrollContainer, pixelsPerHour, gridStartDate, effectiveCollapses]);

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

  // Per-job element count — drives whether the produit label includes the
  // element name (multi-element only, mirrors getProduitLabel convention).
  const elementCountByJobId = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of snapshot.elements) m.set(e.jobId, (m.get(e.jobId) ?? 0) + 1);
    return m;
  }, [snapshot.elements]);

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

  // Safety zone derivations — mirror App.tsx so the operator view
  // surfaces the same Sky snowflake widget on in-zone tiles.
  const sequenceIndexByTaskId = useMemo(
    () => buildSequenceIndexLookup(snapshot),
    [snapshot.jobs, snapshot.elements, snapshot.tasks],
  );
  const safetyOverrideLookup = useMemo(() => {
    const m = new Map<string, boolean>();
    (snapshot.safetyOverrides ?? []).forEach((o) => {
      if (o.isOverridden) m.set(makeSafetyKey(o.jobId, o.sequenceIndex, o.stationId), true);
    });
    return m;
  }, [snapshot.safetyOverrides]);
  const [setSafetyOverride] = useSetSafetyOverrideMutation();
  const handleToggleFrozenOverride = useCallback(
    async (jobId: string, sequenceIndex: number, stationId: string) => {
      const existing = (snapshot.safetyOverrides ?? []).find(
        (o) =>
          o.jobId === jobId && o.sequenceIndex === sequenceIndex && o.stationId === stationId,
      );
      const next = existing ? !existing.isOverridden : true;
      try {
        await setSafetyOverride({
          jobId,
          body: { sequenceIndex, stationId, isOverridden: next },
        }).unwrap();
      } catch (err) {
        console.error('Failed to toggle safety override (operator view)', err);
      }
    },
    [snapshot.safetyOverrides, setSafetyOverride],
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
    const y = timeToYPosition(date, START_HOUR, pixelsPerHour, gridStartDate, effectiveCollapses);
    scrollContainerRef.current.scrollTo({ top: y, behavior: 'smooth' });
  }, [pixelsPerHour, gridStartDate, effectiveCollapses]);

  // ---- Scroll grid to a specific operator slice (operatorId + from time) ----
  // Used by JobCard click (1st non-completed tile of job) and mini-row click in JobDetailsPanel.
  // Y: ~20% from top (matches App.tsx:1289). X: operator column centered horizontally.
  const scrollToOperatorSlice = useCallback((operatorId: string, from: Date) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const operatorIndex = operators.findIndex((op) => op.id === operatorId);
    if (operatorIndex < 0) return;

    const y = timeToYPosition(from, START_HOUR, pixelsPerHour, gridStartDate, effectiveCollapses);
    const top = Math.max(0, y - container.clientHeight * 0.2);

    // Timeline (48px sticky) + px-3 (12px) + index * (column + gap-3 (12px))
    const columnX = 48 + 12 + operatorIndex * (OPERATOR_COLUMN_WIDTH + 12);
    const left = Math.max(0, columnX - container.clientWidth / 2 + OPERATOR_COLUMN_WIDTH / 2);

    container.scrollTo({ top, left, behavior: 'smooth' });
  }, [operators, pixelsPerHour, gridStartDate, effectiveCollapses]);

  // ---- JDP tile click: scroll to the earliest operator slice for that task ----
  // Operator view has no "tile" per se — the nearest analogue is the first
  // operator slice. Mirrors handleSelectJob's earliest-op selection.
  const handleJumpToTask = useCallback((assignment: TaskAssignment) => {
    if (!assignment.operators || assignment.operators.length === 0) return;
    let earliestOp: { operatorId: string; from?: string } | null = null;
    for (const op of assignment.operators) {
      if (!op.from) continue;
      if (!earliestOp || !earliestOp.from || new Date(op.from) < new Date(earliestOp.from)) {
        earliestOp = op;
      }
    }
    if (!earliestOp?.from) return;
    scrollToOperatorSlice(earliestOp.operatorId, new Date(earliestOp.from));
  }, [scrollToOperatorSlice]);

  // ---- JobCard click: select + center grid on 1st non-completed tile of the job ----
  const handleSelectJob = useCallback((jobId: string | null) => {
    // Toggle: if re-clicking the selected card, deselect (no scroll)
    if (jobId === null || jobId === selectedJobId) {
      setSelectedJobId(null);
      return;
    }
    setSelectedJobId(jobId);

    // Find tasks of this job (via elementMap)
    const jobTaskIds = new Set<string>();
    for (const t of snapshot.tasks) {
      const el = elementMap.get(t.elementId);
      if (el?.jobId === jobId) jobTaskIds.add(t.id);
    }
    if (jobTaskIds.size === 0) return;

    // 1st non-completed assignment, sorted by scheduledStart
    let firstAssignment: TaskAssignment | null = null;
    for (const a of snapshot.assignments) {
      if (!jobTaskIds.has(a.taskId) || a.isCompleted) continue;
      if (!a.operators || a.operators.length === 0) continue;
      if (!firstAssignment || new Date(a.scheduledStart) < new Date(firstAssignment.scheduledStart)) {
        firstAssignment = a;
      }
    }
    if (!firstAssignment || !firstAssignment.operators) return;

    // Pick the opRef that starts earliest (smallest from)
    let earliestOp: { operatorId: string; from?: string } | null = null;
    for (const op of firstAssignment.operators) {
      if (!op.from) continue;
      if (!earliestOp || !earliestOp.from || new Date(op.from) < new Date(earliestOp.from)) {
        earliestOp = op;
      }
    }
    if (!earliestOp?.from) return;

    scrollToOperatorSlice(earliestOp.operatorId, new Date(earliestOp.from));
  }, [selectedJobId, snapshot.tasks, snapshot.assignments, elementMap, scrollToOperatorSlice]);

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

  const handleEditJob = useCallback(() => {
    if (!selectedJobId) return;
    setEditingJobInternalId(selectedJobId);
  }, [selectedJobId]);

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
  // V1 versioning: in prod every planning mutation must be blocked.
  // The current scenario mode gates the mutating keyboard shortcuts
  // below (compute, selective compute, pin-all, lift+replan, etc.).
  const { mode: scenarioMode } = useScenarioMode();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ---- Escape: close selected job ----
      // Skip when the Escape is being consumed by a modal (compute modal,
      // JCF, etc.) — otherwise the selection clears behind the modal and
      // the next Alt+P becomes a silent no-op.
      if (e.key === 'Escape' && selectedJobId) {
        const target = e.target as HTMLElement | null;
        const insideModal = !!target?.closest?.('[role="dialog"], .fixed.inset-0.z-50');
        if (!insideModal) {
          e.preventDefault();
          setSelectedJobId(null);
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }
        return;
      }

      // ---- Home: jump to today ----
      if (e.key === 'Home' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const container = scrollContainerRef.current;
        if (container) {
          const now = new Date();
          const y = timeToYPosition(now, START_HOUR, pixelsPerHour, gridStartDate, effectiveCollapses);
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
          const y = timeToYPosition(departureDate, START_HOUR, pixelsPerHour, gridStartDate, effectiveCollapses);
          const vh = scrollContainerRef.current.clientHeight;
          scrollContainerRef.current.scrollTo({ top: Math.max(0, y - vh + 100), behavior: 'smooth' });
        }
        return;
      }

      // ---- Ctrl+Alt+C: smart compaction ----
      if (isCtrlAltLetter(e, 'c')) {
        e.preventDefault();
        if (scenarioMode === 'prod') return;
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

      // ---- Ctrl+Alt+P: lift + re-plan ----
      // Lift every non-pinned, non-frozen placed tile, then kick an
      // incremental compute. Phase-1 FBI surfaces via ComputeReportToast;
      // Phase-2 LNS runs in the background through the shared runtime.
      if (isCtrlAltLetter(e, 'p')) {
        e.preventDefault();
        if (scenarioMode === 'prod') return;
        void liftAndRecompute({
          snapshot,
          onDone: (result) => {
            invalidateSnapshot();
            runBackgroundLns(result, 'ctrl+alt+p lift-then-compute');
          },
        });
        return;
      }

      // ---- Alt+P: selective compute (selected job) ----
      if (isAltLetter(e, 'p')) {
        e.preventDefault();
        if (scenarioMode === 'prod') return;
        if (selectedJobId) {
          handleComputeJob(selectedJobId);
        }
        return;
      }

      // ---- Alt+F: pin/unpin all tiles for selected job ----
      if (isAltLetter(e, 'f') && selectedJobId) {
        if (scenarioMode === 'prod') { e.preventDefault(); return; }
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
    autoRecompute, liftAndRecompute, snapshot, invalidateSnapshot,
    scenarioMode,
  ]);

  // ---- Now line ----
  // Sourced from NowContext: a single 60 s ticker shared across the
  // whole app, instantly updated when the now-override toggles.
  const now = useNow();
  const nowPosition = timeToYPosition(now, START_HOUR, pixelsPerHour, gridStartDate, effectiveCollapses);

  // Precompute tile slices for all operators (must be before early returns — hooks rule)
  const allTileSlices = useMemo(() => {
    const map = new Map<string, TileSlice[]>();
    for (const op of operators) {
      const opAssignments = assignmentsByOperator.get(op.id) ?? [];
      map.set(op.id, computeTileSlices(opAssignments, op, operators));
    }
    return map;
  }, [operators, assignmentsByOperator]);

  // Map assignments by id — saisie + lens renderSlice paths need O(1) lookup.
  const lensAssignmentMap = useMemo(() => {
    const map = new Map<string, TaskAssignment>();
    for (const a of snapshot.assignments) map.set(a.id, a);
    return map;
  }, [snapshot.assignments]);

  const saisieModal = useSaisieModal();

  // Right-click opens TileContextMenu. "Saisir l'avancement" shows only
  // on past-started tasks (the indicator's gate) ; "Définir heure de
  // début…" shows only on future-start tasks. Mutually exclusive.
  const [contextMenuState, setContextMenuState] = useState<{
    x: number;
    y: number;
    assignmentId: string;
    taskId: string;
    jobId: string;
    job: { reference: string; client: string };
    currentScheduledStart: string;
    isPinned: boolean;
    isCompleted: boolean;
    openSaisie?: () => void;
  } | null>(null);
  const [pinDialogState, setPinDialogState] = useState<{
    taskId: string;
    job: { reference: string; client: string };
    currentScheduledStart: string;
  } | null>(null);

  // ── Timeline magnifying lens ─────────────────────────────────────────────
  const lens = useTimelineLens();
  const lastHoveredSegmentKeyRef = useRef<string | null>(null);

  // segmentKey → operatorId, so the onMouseOver delegation handler can
  // resolve a TileSegment DOM element back to its column.
  const lensSegmentOwner = useMemo(() => {
    const index = new Map<string, string>();
    for (const op of operators) {
      for (const slice of allTileSlices.get(op.id) ?? []) {
        index.set(`${slice.assignmentId}-${slice.from.getTime()}`, op.id);
      }
    }
    return index;
  }, [operators, allTileSlices]);

  const lensActiveSlices = lens.state.activeColumnId
    ? allTileSlices.get(lens.state.activeColumnId) ?? []
    : [];

  const lensRange = useMemo(() => {
    if (lensActiveSlices.length === 0) return { gridStartMs: 0, gridEndMs: 0 };
    let min = Infinity;
    let max = -Infinity;
    for (const s of lensActiveSlices) {
      const ss = s.from.getTime();
      const ee = s.to.getTime();
      if (ss < min) min = ss;
      if (ee > max) max = ee;
    }
    const PAD_MS = 60 * 60_000;
    return { gridStartMs: min - PAD_MS, gridEndMs: max + PAD_MS };
  }, [lensActiveSlices]);

  const lensUnavailabilitySegments = useMemo(() => {
    if (!lens.state.activeColumnId) return [];
    const op = operators.find(o => o.id === lens.state.activeColumnId);
    if (!op) return [];
    return computeOperatorUnavailabilitySegments(
      op, lensRange.gridStartMs, lensRange.gridEndMs,
    );
  }, [lens.state.activeColumnId, operators, lensRange.gridStartMs, lensRange.gridEndMs]);

  const lensOvertimeSegments = useMemo(() => {
    if (!lens.state.activeColumnId) return [];
    const op = operators.find(o => o.id === lens.state.activeColumnId);
    if (!op) return [];
    return computeOperatorOvertimeSegments(
      op, lensRange.gridStartMs, lensRange.gridEndMs,
    );
  }, [lens.state.activeColumnId, operators, lensRange.gridStartMs, lensRange.gridEndMs]);

  // Pre-render the actual <TileSegment> components at LENS_PIXELS_PER_HOUR,
  // using the same logic as `renderSlice` — identical visuals, just a
  // magnified time/pixel ratio. Built inside the memo so re-renders of the
  // page don't recompute unless the active column or its slice set changes.
  const lensTileContent = useMemo(() => {
    if (!lens.state.activeColumnId) return null;
    const slices = lensActiveSlices;
    if (slices.length === 0) return null;

    // Lens inner tile area: LENS_WIDTH (300) - LENS_LEFT_GUTTER (40) - right-pad (4).
    const LENS_COL_WIDTH = 256;
    const noop = () => { /* interactions disabled inside the lens */ };
    const originMs = lensRange.gridStartMs;

    return slices.map((slice) => {
      const task = taskMap.get(slice.taskId);
      if (!task || !isInternalTask(task)) return null;
      const element = elementMap.get(task.elementId);
      const jobId = element?.jobId;
      const job = jobId ? jobMap.get(jobId) : undefined;
      if (!job) return null;
      const station = stationMap.get(task.stationId);
      const stationName = station?.name;
      const assignment = lensAssignmentMap.get(slice.assignmentId);

      // No-news = good-news on past tiles (cf. progress-capture-design § 6).
      const isCompletedNow = assignment
        ? isCompletedEffective(assignment.isCompleted, assignment.scheduledEnd, now.getTime())
        : slice.to.getTime() < now.getTime();
      const isLate = !isCompletedNow && lateJobIds.has(job.id);
      const tileState = computeTileState(false, isLate, false, false, isCompletedNow);

      // Direct time-diff from the lens origin — NOT `timeToYPosition`, which
      // treats the `startDate` arg as midnight and positions by hour-of-day.
      // Our origin is `earliestSliceStart - 1 h` (arbitrary wall-clock hour),
      // so timeToYPosition would push tops by `hour_of_day * lpx` and send
      // tiles clean off the inner wrapper whenever the origin isn't 00:00.
      const segTop =
        ((slice.from.getTime() - originMs) / 3_600_000) * LENS_PIXELS_PER_HOUR;
      const segBottom =
        ((slice.to.getTime() - originMs) / 3_600_000) * LENS_PIXELS_PER_HOUR;
      const segHeight = Math.max(segBottom - segTop, 8);

      // Mirror `renderSlice`'s left/right split so two MT tasks running in
      // parallel on the same operator render side-by-side inside the lens.
      // The 40px gutter hosts the hour labels, so the split is applied to the
      // post-gutter area `(100% - 44px)` instead of the whole lens width.
      const colWidth = LENS_COL_WIDTH - 8;
      const positionProps = slice.position === 'left'
        ? { overrideLeft: '40px', overrideWidth: 'calc((100% - 44px) * 0.49)' }
        : slice.position === 'right'
          ? { overrideLeft: 'calc(40px + (100% - 44px) * 0.51)', overrideWidth: 'calc((100% - 44px) * 0.49)' }
          : { overrideLeft: '40px', overrideWidth: 'calc(100% - 44px)' };
      const svgWidth = slice.position === 'full' ? colWidth : Math.floor(colWidth * 0.48);

      const label = getProduitLabel(job, element, elementCountByJobId.get(job.id) ?? 1);
      const setupMinutes = task.duration?.setupMinutes ?? 0;
      const taskStart = assignment ? new Date(assignment.scheduledStart) : null;
      const setupWindow = setupMinutes > 0 && taskStart && !assignment?.setupInherited
        ? { start: taskStart, end: new Date(taskStart.getTime() + setupMinutes * 60_000) }
        : undefined;

      const progressFill = (assignment && task && isInternalTask(task))
        ? (isCompletedNow
            ? { pct: 100, isLate: false }
            : computeChunkProgress(
                slice.from.toISOString(),
                slice.to.toISOString(),
                now.getTime(),
              ))
        : undefined;

      return (
        <TileSegment
          key={`lens-${slice.assignmentId}-${slice.from.getTime()}-${slice.position}`}
          segmentKey={`lens-${slice.assignmentId}-${slice.from.getTime()}`}
          label={label}
          stationName={stationName}
          top={segTop}
          height={segHeight}
          width={svgWidth}
          sawtoothTop={slice.sawtoothTop}
          sawtoothBottom={slice.sawtoothBottom}
          tileState={tileState}
          isMaskedTime={slice.isMasked}
          onClick={noop}
          segFrom={slice.from}
          segTo={slice.to}
          setupWindow={setupWindow}
          recalages={assignment?.recalages}
          jobId={job.id}
          taskId={task.id}
          assignmentId={assignment?.id}
          isPinned={assignment?.isPinned ?? false}
          onTogglePin={scenarioMode !== 'prod' ? handleTogglePin : undefined}
          isSelected={selectedJobId === job.id}
          progressFill={progressFill}
          {...positionProps}
        />
      );
    });
  }, [
    lens.state.activeColumnId, lensActiveSlices, lensRange.gridStartMs, selectedJobId,
    taskMap, elementMap, jobMap, stationMap, lensAssignmentMap, lateJobIds, now,
    elementCountByJobId, scenarioMode, handleTogglePin,
  ]);

  const handleOperatorsMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const segmentEl = target.closest('[data-testid^="tile-segment-"]') as HTMLElement | null;

    if (!segmentEl) {
      // Dead zone (hatched overlay, hour grid line, column bg) — arm auto-close.
      if (lastHoveredSegmentKeyRef.current !== '__deadzone__') {
        lastHoveredSegmentKeyRef.current = '__deadzone__';
        lens.handlers.handleDeadZoneEnter();
      }
      return;
    }

    const testId = segmentEl.getAttribute('data-testid');
    const segmentKey = testId ? testId.slice('tile-segment-'.length) : null;
    if (!segmentKey || segmentKey === lastHoveredSegmentKeyRef.current) return;
    lastHoveredSegmentKeyRef.current = segmentKey;

    const operatorId = lensSegmentOwner.get(segmentKey);
    if (!operatorId) return;

    // segmentKey = "<assignmentId>-<fromMs>" → find the slice to get mid-time.
    const sepIdx = segmentKey.lastIndexOf('-');
    const assignmentId = segmentKey.slice(0, sepIdx);
    const fromMs = Number(segmentKey.slice(sepIdx + 1));
    const slices = allTileSlices.get(operatorId) ?? [];
    const slice = slices.find(
      (s) => s.assignmentId === assignmentId && s.from.getTime() === fromMs,
    );
    if (!slice) return;

    const colEl = segmentEl.closest('[data-testid^="operator-column-"]') as HTMLElement | null;
    if (!colEl) return;

    const colRect = colEl.getBoundingClientRect();
    const tileRect = segmentEl.getBoundingClientRect();

    lens.handlers.handleTileEnter({
      columnId: operatorId,
      tileMidTimeMs: (slice.from.getTime() + slice.to.getTime()) / 2,
      tileHeightPx: tileRect.height,
      anchor: {
        columnLeft: colRect.left,
        columnRight: colRect.right,
        tileCenterY: tileRect.top + tileRect.height / 2,
      },
    });
  };

  const handleOperatorsMouseLeave = () => {
    lastHoveredSegmentKeyRef.current = null;
    lens.handlers.handleStationLeave();
  };

  // Follow-cursor within the same operator column — see SchedulingGrid
  // for the rationale (initial open = snap-to-tile, subsequent moves = glide).
  const handleOperatorsMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!lens.state.visible) return;
    const target = e.target as HTMLElement;
    const colEl = target.closest('[data-testid^="operator-column-"]') as HTMLElement | null;
    if (!colEl) return;
    const testId = colEl.getAttribute('data-testid');
    const operatorId = testId ? testId.slice('operator-column-'.length) : null;
    if (!operatorId || operatorId !== lens.state.activeColumnId) return;

    const colRect = colEl.getBoundingClientRect();
    const relativeY = e.clientY - colRect.top;
    // Collapse-aware reverse mapping; bail if the cursor lands in a band.
    const cursorTime = yPositionToTime(relativeY, START_HOUR, gridStartDate, pixelsPerHour, effectiveCollapses);
    const cursorMs = cursorTime.getTime();
    const inBand = effectiveCollapses.some(c => cursorMs >= c.from.getTime() && cursorMs < c.to.getTime());
    if (inBand) return;

    lens.handlers.handleColumnMouseMove({
      columnId: operatorId,
      centerTimeMs: cursorMs,
      anchor: {
        columnLeft: colRect.left,
        columnRight: colRect.right,
        tileCenterY: e.clientY,
      },
    });
  };

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

    const assignment = snapshot.assignments.find(a => a.id === slice.assignmentId);

    // No-news = good-news on past tiles (cf. progress-capture-design § 6).
    const isCompletedNow = assignment
      ? isCompletedEffective(assignment.isCompleted, assignment.scheduledEnd, now.getTime())
      : new Date(slice.to).getTime() < now.getTime();
    const isLate = !isCompletedNow && lateJobIds.has(job.id);
    const tileState = computeTileState(false, isLate, false, false, isCompletedNow);

    const segTop = timeToYPosition(slice.from, START_HOUR, pixelsPerHour, gridStartDate, effectiveCollapses);
    const segBottom = timeToYPosition(slice.to, START_HOUR, pixelsPerHour, gridStartDate, effectiveCollapses);
    const segHeight = Math.max(segBottom - segTop, 8);

    const colWidth = OPERATOR_COLUMN_WIDTH - 8; // column minus padding
    const positionProps = slice.position === 'left'
      ? { overrideLeft: '0', overrideWidth: '49%' }
      : slice.position === 'right'
        ? { overrideLeft: '51%', overrideWidth: '49%' }
        : {};

    // SVG width must match the actual rendered width
    const svgWidth = slice.position === 'full' ? colWidth : Math.floor(colWidth * 0.48);

    const label = getProduitLabel(job, element, elementCountByJobId.get(job.id) ?? 1);

    // Build the setup window (wall-clock start of the task's first tile
    // + setupMinutes). The engine's scheduled_start is the task's global
    // start, so the setup window is `[scheduledStart, scheduledStart + setupMinutes]`.
    const setupMinutes = task.duration?.setupMinutes ?? 0;
    const taskStart = assignment ? new Date(assignment.scheduledStart) : null;
    const setupWindow = setupMinutes > 0 && taskStart && !assignment?.setupInherited
      ? { start: taskStart, end: new Date(taskStart.getTime() + setupMinutes * 60_000) }
      : undefined;

    // Safety zone per-tile state.
    const frozenUntil = snapshot.safetyZoneFrozenUntil ?? null;
    const inZone = frozenUntil && assignment
      ? isInSafetyZone(assignment.scheduledStart, frozenUntil, new Date())
      : false;
    const seqIdx = task ? sequenceIndexByTaskId.get(task.id) : undefined;
    const stationIdForTile = task && isInternalTask(task) ? task.stationId : undefined;
    const isOverridden = inZone && seqIdx !== undefined && stationIdForTile
      ? safetyOverrideLookup.get(makeSafetyKey(job.id, seqIdx, stationIdForTile)) === true
      : false;

    const hasStarted = assignment
      ? new Date(assignment.scheduledStart).getTime() <= now.getTime()
      : false;

    // Per-slice wallclock fond-vert : each segment computes its own
    // progress from its slice.from..slice.to window. Past slices clamp
    // to 100, future slices to 0, the active slice fills linearly.
    // Mirrors `FocusOperatorColumn` and the JDP per-stint model — the
    // earlier task-level `computeOptimisticProgress` against the envelope
    // made every chunk show the same fractional fill, contradicting
    // "stint 1 done, stint 2 not started".
    const progressFill = (assignment && task && isInternalTask(task))
      ? (isCompletedNow
          ? { pct: 100, isLate: false }
          : computeChunkProgress(
              slice.from.toISOString(),
              slice.to.toISOString(),
              now.getTime(),
            ))
      : undefined;

    const op = operators.find((o) => o.id === operatorId);
    const handleOpenSaisie = assignment
      ? () =>
          saisieModal.open({
            assignment,
            taskDuration: task.duration,
            jobId: job.id,
            job: { reference: job.reference, client: job.client },
            machineName: stationName ?? task.stationId,
            operatorName: op ? `${op.firstName} ${op.lastName}`.trim() : '—',
            operatorId: operatorId,
            stationId: task.stationId,
            now,
            slotVolumePct: (assignment as Record<string, unknown>).slotVolumePct as number | undefined,
          })
      : undefined;

    const handleContextMenu = (e: React.MouseEvent) => {
      if (!assignment) return;
      e.preventDefault();
      e.stopPropagation();
      setContextMenuState({
        x: e.clientX,
        y: e.clientY,
        assignmentId: assignment.id,
        taskId: task.id,
        jobId: job.id,
        job: { reference: job.reference, client: job.client },
        currentScheduledStart: assignment.scheduledStart,
        isPinned: assignment.isPinned ?? false,
        isCompleted: assignment.isCompleted ?? false,
        openSaisie: handleOpenSaisie,
      });
    };

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
        tileState={tileState}
        isMaskedTime={slice.isMasked}
        onClick={() => setSelectedJobId(job.id)}
        segFrom={slice.from}
        segTo={slice.to}
        setupWindow={setupWindow}
        recalages={assignment?.recalages}
        jobId={job.id}
        assignmentId={assignment?.id}
        isPinned={assignment?.isPinned ?? false}
        onTogglePin={handleTogglePin}
        taskId={task?.id}
        stationId={stationIdForTile}
        sequenceIndex={seqIdx}
        inSafetyZone={inZone}
        isFrozenOverridden={isOverridden}
        onToggleFrozenOverride={handleToggleFrozenOverride}
        isSelected={selectedJobId === job.id}
        onContextMenu={handleContextMenu}
        progressFill={progressFill}
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
          onSelectJob={handleSelectJob}
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
            paperLeadTime={paperLeadTime}
            formeLeadTime={formeLeadTime}
            plateLeadTime={plateLeadTime}
            onClose={() => setSelectedJobId(null)}
            onRecallTask={handleRecallAssignment}
            onToggleComplete={handleToggleComplete}
            onToggleOutsourcedDone={handleToggleOutsourcedDone}
            onTogglePin={handleTogglePin}
            onDepartureChange={handleOutsourcingDepartureChange}
            onReturnChange={handleOutsourcingReturnChange}
            onSplitTask={handleSplitTask}
            onFuseTask={handleFuseTask}
            onEditJob={handleEditJob}
            lateJobIds={lateJobIds}
            allJobs={snapshot.jobs}
            onSelectJob={setSelectedJobId}
            snapshotOperators={snapshot.operators}
            onJumpToOperatorSlice={scrollToOperatorSlice}
            onJumpToTask={handleJumpToTask}
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
          <div className="flex-1 overflow-auto min-w-0" ref={setScrollContainerRef} data-testid="operator-scheduling-grid">
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
                    gridStartDate={gridStartDate}
                    collapses={effectiveCollapses}
                  />
                </div>

                {/* Operator columns */}
                <div
                  className="flex gap-3 px-3 bg-zinc-950 relative"
                  onMouseOver={handleOperatorsMouseOver}
                  onMouseMove={handleOperatorsMouseMove}
                  onMouseLeave={handleOperatorsMouseLeave}
                >
                  {/* Safety zone band (Sky tint-horizontal). Bottom Y is
                      mapped from the server boundary so the band aligns
                      with where the engine actually freezes. */}
                  {snapshot.safetyZoneFrozenUntil && (
                    <SafetyBand
                      nowPx={nowPosition}
                      zoneHeightPx={Math.max(
                        0,
                        timeToYPosition(
                          new Date(snapshot.safetyZoneFrozenUntil),
                          START_HOUR,
                          pixelsPerHour,
                          gridStartDate,
                          effectiveCollapses,
                        ) - nowPosition,
                      )}
                      boundaryLabel={`+${snapshot.safetyZoneHours ?? 0} h`}
                    />
                  )}

                  {/* Now line spanning all columns */}
                  <div
                    className="absolute left-0 right-0 h-0.5 bg-red-500 z-10 pointer-events-none"
                    style={{ top: `${nowPosition}px` }}
                    data-testid="now-line"
                  />

                  {/* Collapse bands — full-width across all operator columns */}
                  {effectiveCollapses.map((c) => (
                    <CollapseBand
                      key={c.id}
                      collapse={c}
                      topPx={timeToYPosition(c.from, START_HOUR, pixelsPerHour, gridStartDate, effectiveCollapses)}
                    />
                  ))}

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
                        collapses={effectiveCollapses}
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

      {/* ---- RAZ FAB — entry point for the mass-unschedule flow.
              Hidden in prod scenario mode (matches the Ctrl+Alt+Z guard). ---- */}
      {scenarioMode !== 'prod' && (
        <RazFab onClick={massUnschedule.trigger} />
      )}

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

      {/* ---- Timeline magnifying lens ---- */}
      <TimelineLens
        visible={lens.state.visible}
        activeColumnId={lens.state.activeColumnId}
        anchor={lens.state.anchor}
        tileContent={lensTileContent}
        unavailabilitySegments={lensUnavailabilitySegments}
        overtimeSegments={lensOvertimeSegments}
        gridStartMs={lensRange.gridStartMs}
        gridEndMs={lensRange.gridEndMs}
        centerTimeMs={lens.state.centerTimeMs}
        onMouseEnter={lens.handlers.handleLensEnter}
        onMouseLeave={lens.handlers.handleLensLeave}
      />
    </div>

      {/* ---- Shortcut footer ---- */}
      <ShortcutFooter mode={selectedJobId ? 'operatorJobSelected' : 'operatorDefault'} />

      {/* Right-click context menu — mode-gated full set. Prod = Voir / Saisir
          (past) / Marquer terminé. Préprod = Voir / Pin / Définir (future) /
          Rappeler / Diviser / Fusionner. */}
      {contextMenuState && (() => {
        const startMs = new Date(contextMenuState.currentScheduledStart).getTime();
        const hasStarted = startMs <= now.getTime();
        const ctxTask = snapshot.tasks.find((t) => t.id === contextMenuState.taskId);
        const isSplit = ctxTask?.type === 'Internal' && !!(ctxTask as InternalTask).splitGroupId;
        return (
          <TileContextMenu
            x={contextMenuState.x}
            y={contextMenuState.y}
            isPinned={contextMenuState.isPinned}
            isCompleted={contextMenuState.isCompleted}
            scenarioMode={scenarioMode}
            isSplit={isSplit}
            onTogglePin={() => {
              void handleTogglePin(contextMenuState.assignmentId);
              setContextMenuState(null);
            }}
            onViewDetails={() => {
              setSelectedJobId(contextMenuState.jobId);
              setContextMenuState(null);
            }}
            onToggleComplete={() => {
              void handleToggleComplete(contextMenuState.assignmentId);
              setContextMenuState(null);
            }}
            onRecall={() => {
              void handleRecallAssignment(contextMenuState.taskId);
              setContextMenuState(null);
            }}
            onSplit={() => {
              void handleSplitTask(contextMenuState.taskId);
              setContextMenuState(null);
            }}
            onFuse={() => {
              void handleFuseTask(contextMenuState.taskId);
              setContextMenuState(null);
            }}
            onSaisirAvancement={contextMenuState.openSaisie
              ? () => {
                  contextMenuState.openSaisie!();
                  setContextMenuState(null);
                }
              : undefined}
            onDefinirDebut={!hasStarted
              ? () => {
                  setPinDialogState({
                    taskId: contextMenuState.taskId,
                    job: contextMenuState.job,
                    currentScheduledStart: contextMenuState.currentScheduledStart,
                  });
                  setContextMenuState(null);
                }
              : undefined}
            onClose={() => setContextMenuState(null)}
          />
        );
      })()}

      {/* V2 set-start-time dialog — opened from the menu's "Définir heure de
          début…" item. The dialog fires the pin mutation ;
          autoRecomputeMiddleware handles the replan. */}
      {pinDialogState && (
        <SetStartTimeDialog
          isOpen={true}
          onClose={() => setPinDialogState(null)}
          taskId={pinDialogState.taskId}
          job={pinDialogState.job}
          currentScheduledStart={pinDialogState.currentScheduledStart}
        />
      )}

      {editingJobInternalId && (
        <JobModificationContainer
          jobInternalId={editingJobInternalId}
          onClose={() => setEditingJobInternalId(null)}
        />
      )}
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
  collapses?: readonly Collapse[];
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
  collapses,
}: OperatorColumnProps) {
  const effectiveCollapses = collapses ?? [];

  // Hour grid lines (only visible range). Collapse-aware: skip lines whose Y
  // resolves inside a band (the band cover hides them).
  const gridLines = useMemo(() => {
    const lines: number[] = [];
    const startDay = visibleDayRange.start;
    const endDay = visibleDayRange.end;
    const useCollapse = effectiveCollapses.length > 0;

    for (let dayIndex = startDay; dayIndex <= endDay; dayIndex++) {
      for (let h = 0; h < 24; h++) {
        if (!useCollapse) {
          lines.push((dayIndex * 24 + h) * pixelsPerHour);
          continue;
        }
        const hourDate = new Date(gridStartDate.getTime() + (dayIndex * 24 + h) * 3_600_000);
        const ms = hourDate.getTime();
        const inside = effectiveCollapses.some(c => ms > c.from.getTime() && ms < c.to.getTime());
        if (inside) continue;
        lines.push(timeToYPosition(hourDate, 0, pixelsPerHour, gridStartDate, effectiveCollapses));
      }
    }
    return lines;
  }, [visibleDayRange, pixelsPerHour, effectiveCollapses, gridStartDate]);

  // Unavailability + overtime overlays (only visible range).
  // Overtime overlays are rendered FIRST so DOM order puts: overtime cross-grid →
  // unavailability hachures → tiles on top. The intended visual reading is
  // "gray cross grid = exceptional availability, tiles sit on top normally".
  const overlays = useMemo(() => {
    const startDay = visibleDayRange.start;
    const endDay = visibleDayRange.end;
    const elements: React.ReactNode[] = [];

    for (let dayIndex = startDay; dayIndex <= endDay; dayIndex++) {
      const currentDate = new Date(gridStartDate.getTime() + dayIndex * 24 * 60 * 60 * 1000);
      const daySchedule = getOperatorDaySchedule(operator, currentDate);
      const overtimePeriods = getOperatorOvertimePeriodsForDay(operator, currentDate);
      const dayYOffset = effectiveCollapses.length === 0
        ? dayIndex * 24 * pixelsPerHour
        : timeToYPosition(currentDate, 0, pixelsPerHour, gridStartDate, effectiveCollapses);

      if (overtimePeriods.length > 0) {
        elements.push(
          <OvertimeOverlay
            key={`ot-overlay-day-${dayIndex}`}
            periods={overtimePeriods}
            startHour={0}
            hoursToDisplay={24}
            pixelsPerHour={pixelsPerHour}
            yOffset={dayYOffset}
            collapses={effectiveCollapses}
            dayDate={currentDate}
            gridStartDate={gridStartDate}
          />,
        );
      }

      elements.push(
        <UnavailabilityOverlay
          key={`overlay-day-${dayIndex}`}
          daySchedule={daySchedule}
          startHour={0}
          hoursToDisplay={24}
          pixelsPerHour={pixelsPerHour}
          yOffset={dayYOffset}
          collapses={effectiveCollapses}
          dayDate={currentDate}
          gridStartDate={gridStartDate}
        />,
      );
    }
    return elements;
  }, [operator, gridStartDate, pixelsPerHour, visibleDayRange, effectiveCollapses]);

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
