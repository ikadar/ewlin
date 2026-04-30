import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGetSnapshotQuery } from '../store';
import { TimelineColumn } from '../components/TimelineColumn';
import { timeToYPosition } from '../components/TimelineColumn/utils';
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

const START_HOUR = 0;
const DAY_COUNT = 365;
const PIXELS_PER_HOUR = 80;

export interface FocusPageProps {
  mode: FocusKind;
}

export default function FocusPage({ mode }: FocusPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: snapshot, isLoading, isError, refetch } = useGetSnapshotQuery();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Callback-ref state: the scroll container mounts only after the
  // `if (isLoading) return <LoadingSpinner/>` gate below, which is after these
  // effects first run. Tracking it as state re-runs the effects when the
  // container actually exists, so listeners + ResizeObserver actually attach.
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const setScrollRef = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el;
    setScrollEl(el);
  }, []);

  const gridStartDate = useMemo(() => {
    const d = new Date();
    d.setHours(START_HOUR, 0, 0, 0);
    return d;
  }, []);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const dayHeightPx = 24 * PIXELS_PER_HOUR;

  const virtualScroll = useVirtualScroll({
    totalDays: DAY_COUNT,
    bufferDays: 3,
    dayHeightPx,
    scrollTop,
    viewportHeight,
  });

  const totalHeight = virtualScroll.totalHeight;

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
      const centerY = newScrollTop + vh / 2;
      const hoursFromStart = centerY / PIXELS_PER_HOUR;
      const fd = new Date(gridStartDate);
      fd.setTime(gridStartDate.getTime() + hoursFromStart * 60 * 60 * 1000);
      setFocusedDate(fd);
      setViewportStartHour(newScrollTop / PIXELS_PER_HOUR);
      setViewportEndHour((newScrollTop + vh) / PIXELS_PER_HOUR);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [scrollEl, gridStartDate]);

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
    const y = timeToYPosition(new Date(), START_HOUR, PIXELS_PER_HOUR, gridStartDate, []);
    container.scrollTo({ top: Math.max(0, y - container.clientHeight / 2), behavior: 'smooth' });
  }, [gridStartDate]);

  // Scroll to NOW on mount and on entity change (no animation, immediate).
  //
  // The dependency intentionally watches `!!snapshot` rather than the
  // snapshot object reference: we only need to know when the data first
  // arrives (so the scroll target's height has been computed). Watching
  // the reference itself caused every refetch — including the one fired
  // by ticking a CompletionToggleIcon — to re-anchor the scroll on NOW,
  // jumping the operator back to the current time mid-task. The toggle
  // mutation invalidates the Snapshot tag, which produces a new snapshot
  // reference even when the visible layout is unchanged.
  const hasSnapshot = !!snapshot;
  useEffect(() => {
    if (!scrollEl) return;
    const container = scrollEl;
    requestAnimationFrame(() => {
      const y = timeToYPosition(new Date(), START_HOUR, PIXELS_PER_HOUR, gridStartDate, []);
      container.scrollTop = Math.max(0, y - container.clientHeight / 2);
    });
  }, [scrollEl, gridStartDate, mode, id, hasSnapshot]);

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
      const msFromGridStart = date.getTime() - gridStartDate.getTime();
      const hoursFromStart = msFromGridStart / (1000 * 60 * 60);
      const y = hoursFromStart * PIXELS_PER_HOUR;
      container.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    },
    [gridStartDate],
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
      navigate(`/focus/${kind}/${newId}`);
    },
    [navigate],
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

  const nowY = timeToYPosition(now, START_HOUR, PIXELS_PER_HOUR, gridStartDate, []);

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
              />
            </div>
            <div className="relative flex-1 min-w-0" style={{ maxWidth: '500px' }}>
              <div
                className="absolute left-0 right-0 h-0.5 bg-red-500 z-10 pointer-events-none"
                style={{ top: `${nowY}px` }}
                data-testid="focus-now-line"
              />
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
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
