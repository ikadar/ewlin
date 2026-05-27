import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useGetSnapshotQuery, useGetProdSnapshotQuery, useRecordProgressDirectMutation } from '../store';
import { useScenarioMode } from '../contexts/ScenarioContext';
import { TimelineColumn } from '../components/TimelineColumn';
import { timeToYPosition } from '../components/TimelineColumn/utils';
import { yPositionToTime } from '../components/DragPreview/snapUtils';
import { DateStrip } from '../components/DateStrip/DateStrip';
import {
  FocusTopBar,
  FocusOperatorColumn,
  FocusStationColumn,
} from '../components/FocusPage';
import type { FocusKind, FocusSelectorItem } from '../components/FocusSelector';
import { LoadingSpinner } from '../components/LoadingSpinner/LoadingSpinner';
import { ErrorState } from '../components/ErrorState';
import { useVirtualScroll } from '../hooks';
import { computeCollapses } from '../utils/computeCollapses';
import type { Collapse } from '../components/SchedulingGrid/collapseConfig';
import { SetStartTimeDialog } from '../components/SetStartTimeDialog/SetStartTimeDialog';
import { TileContextMenu } from '../components/Tile';
import { CollapseBand } from '../components/SchedulingGrid/CollapseBand';

const START_HOUR = 0;
const DAY_COUNT = 365;
const PIXELS_PER_HOUR = 80;

export interface FocusPageProps {
  mode: FocusKind;
}

export default function FocusPage({ mode }: FocusPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Mirror OperatorSchedulePage: in prod, read the engaged Prod snapshot
  // (`/scenarios/prod/snapshot`). In préprod, read the live `/schedule/snapshot`.
  // Without this gating the focus view silently shows préprod data even when
  // the URL says `?env=prod` — the X-Flux-Scenario header is sent, but the
  // preprod endpoint does not redirect, so the consumer must pick the right
  // query.
  const { mode: scenarioMode } = useScenarioMode();
  const preprodSnapshot = useGetSnapshotQuery(undefined, { skip: scenarioMode === 'prod' });
  const prodSnapshot = useGetProdSnapshotQuery(undefined, { skip: scenarioMode !== 'prod' });
  const snapshot = scenarioMode === 'prod' ? prodSnapshot.data : preprodSnapshot.data;
  const isLoading = scenarioMode === 'prod' ? prodSnapshot.isLoading : preprodSnapshot.isLoading;
  const isError = scenarioMode === 'prod' ? prodSnapshot.isError : preprodSnapshot.isError;
  const refetch = scenarioMode === 'prod' ? prodSnapshot.refetch : preprodSnapshot.refetch;
  const scrollRef = useRef<HTMLDivElement>(null);
  // Callback-ref state: the scroll container mounts only after the
  // `if (isLoading) return <LoadingSpinner/>` gate below, which is after these
  // effects first run. Tracking it as state re-runs the effects when the
  // container actually exists, so listeners + ResizeObserver actually attach.
  const [recordProgressDirect] = useRecordProgressDirectMutation();
  const handleToggleCompletion = useCallback((taskId: string, completed: boolean) => {
    void recordProgressDirect({ taskId, progressPct: completed ? 100 : 0 });
  }, [recordProgressDirect]);

  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const setScrollRef = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el;
    setScrollEl(el);
  }, []);

  const focusEntityName = useMemo(() => {
    if (!snapshot || !id) return '';
    if (mode === 'operator') {
      const op = snapshot.operators.find((o) => o.id === id);
      return op ? `${op.firstName} ${op.lastName}` : '';
    }
    const st = snapshot.stations.find((s) => s.id === id);
    return st?.name ?? '';
  }, [snapshot, id, mode]);
  useDocumentTitle(focusEntityName || (mode === 'operator' ? 'Opérateur' : 'Station'), 'prod');

  const gridStartDate = useMemo(() => {
    const d = new Date();
    d.setHours(START_HOUR, 0, 0, 0);
    return d;
  }, []);

  const gridEndDate = useMemo(
    () => new Date(gridStartDate.getTime() + DAY_COUNT * 24 * 60 * 60 * 1000),
    [gridStartDate],
  );

  // Collapse bands — entity-scoped, NOT shop-wide.
  //
  // The main planning view intersects every operator's gaps (only folds when
  // ALL operators are off) because its columns share the same Y axis: a band
  // that holds for operator A but not B couldn't be drawn coherently across
  // the row. The focus view has a single column → that constraint disappears
  // → we can personalize bands to the entity actually displayed.
  //
  // - Operator focus: feed `[operator]`. The intersection over a 1-element
  //   list is just that operator's gaps, so a worker with Tuesdays off gets
  //   Tuesdays folded — even if other operators work them.
  //
  // - Station focus: feed the station's qualified operators (proficiency > 0).
  //   The fold then represents "no qualified operator can run this station",
  //   which mirrors `narrowDayScheduleByQualifiedOperators` — the same logic
  //   that already drives the unavailability hatching on this column. So the
  //   bands and the hachures speak the same truth: "this station is
  //   effectively closed".
  //   Per `feedback_no_station_schedule` (machine dispo = operator dispo) we
  //   intentionally don't mix in `Station.scheduleExceptions` here.
  //
  // Edge case: empty qualified-op list (a station nobody is trained on) →
  // `computeCollapses([])` returns []. Linear timeline + full-day hachures
  // signal "nobody can run this", which is what the user should see.
  const effectiveCollapses = useMemo<readonly Collapse[]>(() => {
    if (!snapshot || !id) return [];
    if (mode === 'operator') {
      const op = snapshot.operators.find((o) => o.id === id);
      return op ? computeCollapses([op], gridStartDate, gridEndDate) : [];
    }
    const station = snapshot.stations.find((s) => s.id === id);
    if (!station) return [];
    const qualifiedOps = snapshot.operators.filter((op) =>
      op.skills?.some((s) => s.stationId === station.id && (s.proficiency ?? 0) > 0),
    );
    return computeCollapses(qualifiedOps, gridStartDate, gridEndDate);
  }, [snapshot, mode, id, gridStartDate, gridEndDate]);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  // Right-click menu state — bubbled up from FocusOperatorColumn so a
  // single TileContextMenu mounts at page level. The menu's "Définir heure
  // de début…" item routes to the SetStartTimeDialog below ; "Saisir
  // l'avancement" calls the pre-bound openSaisie closure (only present
  // when the task has started).
  const [contextMenuState, setContextMenuState] = useState<{
    x: number;
    y: number;
    taskId: string;
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
  const dayHeightPx = 24 * PIXELS_PER_HOUR;

  // Virtual scroll thinks linearly (`start = floor(scrollTop / dayHeightPx)`).
  // After collapse, scrollTop is collapse-aware (smaller than linear), so feeding
  // it raw produces wrong day indices → tiles, gridLines, overlays disappear.
  // Convert via yPositionToTime → linear equivalent before handing to the hook.
  const linearScrollTop = useMemo(() => {
    if (effectiveCollapses.length === 0) return scrollTop;
    const t = yPositionToTime(scrollTop, START_HOUR, gridStartDate, PIXELS_PER_HOUR, effectiveCollapses);
    return ((t.getTime() - gridStartDate.getTime()) / 3_600_000) * PIXELS_PER_HOUR;
  }, [scrollTop, effectiveCollapses, gridStartDate]);

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
      h -= c.durationHours * PIXELS_PER_HOUR - c.heightPx;
    }
    return h;
  }, [virtualScroll.totalHeight, effectiveCollapses]);

  const [focusedDate, setFocusedDate] = useState<Date | null>(new Date());
  const [viewportStartHour, setViewportStartHour] = useState<number>(0);
  const [viewportEndHour, setViewportEndHour] = useState<number>(8);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Track scroll position for virtual scrolling + DateStrip sync
  useEffect(() => {
    if (!scrollEl) return;
    const container = scrollEl;

    const handleScroll = () => {
      const newScrollTop = container.scrollTop;
      setScrollTop(newScrollTop);
      const vh = container.clientHeight;

      // Collapse-aware: the visible Y span covers MORE wall-clock time than
      // a linear `Y / pixelsPerHour` suggests (a 60px band hides ~10h+).
      // yPositionToTime resolves piecewise so the focused-date and DateStrip
      // viewport indicator stay correct when bands consume rendered Y.
      const centerY = newScrollTop + vh / 2;
      const fd = yPositionToTime(centerY, START_HOUR, gridStartDate, PIXELS_PER_HOUR, effectiveCollapses);
      setFocusedDate(fd);

      const topTime = yPositionToTime(newScrollTop, START_HOUR, gridStartDate, PIXELS_PER_HOUR, effectiveCollapses);
      const bottomTime = yPositionToTime(newScrollTop + vh, START_HOUR, gridStartDate, PIXELS_PER_HOUR, effectiveCollapses);
      setViewportStartHour((topTime.getTime() - gridStartDate.getTime()) / 3_600_000);
      setViewportEndHour((bottomTime.getTime() - gridStartDate.getTime()) / 3_600_000);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [scrollEl, gridStartDate, effectiveCollapses]);

  // ResizeObserver keeps viewportHeight in sync when layout shifts without a
  // window resize — otherwise a stale viewport can collapse the virtual range.
  useEffect(() => {
    if (!scrollEl) return;
    const container = scrollEl;

    const syncViewportHeight = () => {
      const h = container.clientHeight;
      if (h > 0) setViewportHeight(h);
    };

    syncViewportHeight();
    const resizeObserver = new ResizeObserver(syncViewportHeight);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [scrollEl]);

  const scrollToNow = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const y = timeToYPosition(new Date(), START_HOUR, PIXELS_PER_HOUR, gridStartDate, effectiveCollapses);
    container.scrollTo({ top: Math.max(0, y - container.clientHeight / 2), behavior: 'smooth' });
  }, [gridStartDate, effectiveCollapses]);

  // Scroll to NOW on mount and on entity change (no animation, immediate).
  //
  // The dependency intentionally watches `!!snapshot` rather than the
  // snapshot object reference: we only need to know when the data first
  // arrives (so the scroll target's height has been computed). Watching
  // the reference itself caused every refetch (including snapshot
  // invalidations triggered by tile mutations) to re-anchor the scroll
  // on NOW, jumping the operator back to the current time mid-task.
  const hasSnapshot = !!snapshot;
  useEffect(() => {
    if (!scrollEl) return;
    const container = scrollEl;
    requestAnimationFrame(() => {
      const y = timeToYPosition(new Date(), START_HOUR, PIXELS_PER_HOUR, gridStartDate, effectiveCollapses);
      container.scrollTop = Math.max(0, y - container.clientHeight / 2);
    });
  }, [scrollEl, gridStartDate, mode, id, hasSnapshot, effectiveCollapses]);

  // Home key = scroll to now
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Home') {
        e.preventDefault();
        scrollToNow();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [scrollToNow]);

  const handleDateClick = useCallback(
    (date: Date) => {
      const container = scrollRef.current;
      if (!container) return;
      // Collapse-aware: a date inside (or after) a folded band must land on
      // the band's top, not at its raw linear hour offset — otherwise clicking
      // "Sat" on the DateStrip scrolls into a band that has zero rendered
      // Y span, leaving the user mid-Friday.
      const y = timeToYPosition(date, START_HOUR, PIXELS_PER_HOUR, gridStartDate, effectiveCollapses);
      container.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    },
    [gridStartDate, effectiveCollapses],
  );

  const operatorItems = useMemo<FocusSelectorItem[]>(() => {
    if (!snapshot) return [];
    return snapshot.operators.map((op) => ({
      id: op.id,
      name: `${op.firstName} ${op.lastName}`,
      subtitle: op.role,
    }));
  }, [snapshot]);

  const stationItems = useMemo<FocusSelectorItem[]>(() => {
    if (!snapshot) return [];
    const categoryNameById = new Map(snapshot.categories.map((c) => [c.id, c.name]));
    return snapshot.stations.map((st) => ({
      id: st.id,
      name: st.name,
      subtitle: categoryNameById.get(st.categoryId),
    }));
  }, [snapshot]);

  const handleSelect = useCallback(
    (kind: FocusKind, newId: string) => {
      navigate(`/focus/${kind}/${newId}${location.search}`);
    },
    [navigate, location.search],
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !snapshot) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <ErrorState onRetry={refetch} />
      </div>
    );
  }

  const selectedOperator =
    mode === 'operator' ? snapshot.operators.find((op) => op.id === id) : undefined;
  const selectedStation =
    mode === 'station' ? snapshot.stations.find((st) => st.id === id) : undefined;

  if (mode === 'operator' && !selectedOperator) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-400">
        Opérateur introuvable
      </div>
    );
  }
  if (mode === 'station' && !selectedStation) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-400">
        Station introuvable
      </div>
    );
  }

  const nowY = timeToYPosition(now, START_HOUR, PIXELS_PER_HOUR, gridStartDate, effectiveCollapses);

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <FocusTopBar
        operators={operatorItems}
        stations={stationItems}
        currentKind={mode}
        currentId={id ?? ''}
        onSelect={handleSelect}
      />
      <div className="flex-1 flex overflow-hidden">
        <DateStrip
          startDate={gridStartDate}
          dayCount={DAY_COUNT}
          onDateClick={handleDateClick}
          focusedDate={focusedDate}
          viewportStartHour={viewportStartHour}
          viewportEndHour={viewportEndHour}
        />
        <div ref={setScrollRef} className="flex-1 overflow-auto min-w-0">
          <div className="flex justify-start relative" style={{ height: `${totalHeight}px` }}>
            <div className="sticky left-0 z-20 shrink-0 bg-zinc-950">
              <TimelineColumn
                startHour={START_HOUR}
                hourCount={DAY_COUNT * 24}
                currentTime={now}
                showNowLine={false}
                pixelsPerHour={PIXELS_PER_HOUR}
                visibleDayRange={virtualScroll.visibleRange}
                gridStartDate={gridStartDate}
                collapses={effectiveCollapses}
              />
            </div>
            <div className="relative flex-1 min-w-0" style={{ maxWidth: '500px' }}>
              <div
                className="absolute left-0 right-0 h-0.5 bg-red-500 z-10 pointer-events-none"
                style={{ top: `${nowY}px` }}
                data-testid="focus-now-line"
              />
              {/* Collapse bands — full-width across the focus column. Rendered
                  before the now-line/tile layer so the chip sits behind the
                  red line if they ever overlap. */}
              {effectiveCollapses.map((c) => (
                <CollapseBand
                  key={c.id}
                  collapse={c}
                  topPx={timeToYPosition(c.from, START_HOUR, PIXELS_PER_HOUR, gridStartDate, effectiveCollapses)}
                />
              ))}
              {mode === 'operator' && selectedOperator && (
                <FocusOperatorColumn
                  operator={selectedOperator}
                  snapshot={snapshot}
                  pixelsPerHour={PIXELS_PER_HOUR}
                  gridStartDate={gridStartDate}
                  startHour={START_HOUR}
                  columnHeight={totalHeight}
                  now={now}
                  visibleDayRange={virtualScroll.visibleRange}
                  dayCount={DAY_COUNT}
                  collapses={effectiveCollapses}
                  onToggleCompletion={handleToggleCompletion}
                  onTileContextMenu={(p) => {
                    // Prod focus has a single legal tile action: saisie
                    // d'avancement on past-started tiles. Future-start tiles
                    // would only expose "Définir heure de début…", which is
                    // a préprod-only affordance — so we suppress the menu
                    // entirely rather than opening an empty shell.
                    setContextMenuState({
                      x: p.x,
                      y: p.y,
                      taskId: p.taskId,
                      job: p.job,
                      currentScheduledStart: p.currentScheduledStart,
                      isPinned: p.isPinned,
                      isCompleted: p.isCompleted,
                      openSaisie: p.openSaisie,
                    });
                  }}
                />
              )}
              {mode === 'station' && selectedStation && (
                <FocusStationColumn
                  station={selectedStation}
                  snapshot={snapshot}
                  pixelsPerHour={PIXELS_PER_HOUR}
                  gridStartDate={gridStartDate}
                  startHour={START_HOUR}
                  columnHeight={totalHeight}
                  now={now}
                  visibleDayRange={virtualScroll.visibleRange}
                  dayCount={DAY_COUNT}
                  collapses={effectiveCollapses}
                  onToggleCompletion={handleToggleCompletion}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right-click context menu — focus subset. "Saisir l'avancement"
          shows only on past-started tasks ; "Définir heure de début…"
          shows only on future-start tasks. Mutually exclusive in practice. */}
      {contextMenuState && (() => {
        const startMs = new Date(contextMenuState.currentScheduledStart).getTime();
        const hasStarted = startMs <= now.getTime();
        return (
          <TileContextMenu
            x={contextMenuState.x}
            y={contextMenuState.y}
            isPinned={contextMenuState.isPinned}
            isCompleted={contextMenuState.isCompleted}
            scenarioMode={scenarioMode}
            onSaisirAvancement={contextMenuState.openSaisie}
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

      {/* V2 set-start-time dialog — opened from the menu's "Définir heure
          de début…" item. */}
      {pinDialogState && (
        <SetStartTimeDialog
          isOpen={true}
          onClose={() => setPinDialogState(null)}
          taskId={pinDialogState.taskId}
          job={pinDialogState.job}
          currentScheduledStart={pinDialogState.currentScheduledStart}
        />
      )}
    </div>
  );
}
