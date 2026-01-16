import { useEffect, useRef, useState, useMemo } from 'react';
import { DateCell } from './DateCell';
import { useVirtualScroll, getVisibleDates, calculateVisibleRange } from '../../hooks';
import type { TaskMarker } from './TaskMarkers';

/** Task marker data for a specific day */
export interface DayTaskMarkers {
  /** Date key in YYYY-MM-DD format */
  dateKey: string;
  /** Task markers for this day */
  markers: TaskMarker[];
}

export interface DateStripProps {
  /** Start date for the range */
  startDate: Date;
  /** Number of days to display (REQ-09.1: default 365 for "infinite" scroll) */
  dayCount?: number;
  /** Callback when a date is clicked */
  onDateClick?: (date: Date) => void;
  /** Departure date for selected job (REQ-15) */
  departureDate?: Date | null;
  /** Set of dates with scheduled tasks for selected job (REQ-16) */
  scheduledDays?: Set<string>;
  /** Currently focused date in the grid (REQ-09.2) */
  focusedDate?: Date | null;
  /** v0.3.46: Number of buffer days to render around focused day (default: 10 for DateStrip) */
  bufferDays?: number;
  /** v0.3.47: Task markers per day (Map from dateKey to markers) */
  taskMarkersPerDay?: Map<string, TaskMarker[]>;
  /** v0.3.47: Earliest task date for timeline */
  earliestTaskDate?: Date | null;
}

/**
 * Check if two dates are the same day.
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Format date as YYYY-MM-DD for Set lookup.
 */
function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** Height of each date cell in pixels */
const CELL_HEIGHT = 48; // h-12 = 3rem = 48px

/**
 * DateStrip - Day navigation column.
 * Displays a vertical list of days with click-to-jump functionality.
 * REQ-09.1: Extended to 365 days for "infinite" scroll effect.
 * REQ-09.2: Auto-scrolls to center the focused date.
 * v0.3.46: Virtual scrolling - only renders visible date cells.
 * Supports departure date highlighting (REQ-15) and scheduled days indicator (REQ-16).
 */
export function DateStrip({
  startDate,
  dayCount = 365,
  onDateClick,
  departureDate,
  scheduledDays,
  focusedDate,
  bufferDays = 10, // More buffer for DateStrip since cells are small
  taskMarkersPerDay,
  earliestTaskDate,
}: DateStripProps) {
  const today = new Date();
  const containerRef = useRef<HTMLDivElement>(null);

  // v0.3.64: Use ref for scrollTop to avoid re-renders on every scroll pixel
  const scrollTopRef = useRef(0);
  const [viewportHeight, setViewportHeight] = useState(400);

  // v0.3.64: Only store visibleRange in state - updates only when buffer changes
  const [visibleRange, setVisibleRange] = useState(() =>
    calculateVisibleRange(0, 400, CELL_HEIGHT, bufferDays, dayCount)
  );

  // v0.3.64: Virtual scroll calculation now uses visibleRange directly
  const virtualScroll = useVirtualScroll({
    totalDays: dayCount,
    dayHeightPx: CELL_HEIGHT,
    visibleRange,
  });

  // v0.3.46: Get only the visible dates
  const visibleDates = useMemo(() => {
    return getVisibleDates(startDate, virtualScroll.visibleRange);
  }, [startDate, virtualScroll.visibleRange]);

  // v0.3.65: Calculate today's index and check if it's in visible range
  const todayIndex = useMemo(() => {
    const todayTime = today.getTime();
    const startTime = startDate.getTime();
    const msPerDay = 24 * 60 * 60 * 1000;
    const index = Math.floor((todayTime - startTime) / msPerDay);
    // Return index only if within valid day range
    return index >= 0 && index < dayCount ? index : null;
  }, [today, startDate, dayCount]);

  // v0.3.65: Check if today is outside visible range (needs separate rendering)
  const isTodayOutsideVisibleRange = useMemo(() => {
    if (todayIndex === null) return false;
    return todayIndex < virtualScroll.visibleRange.start || todayIndex >= virtualScroll.visibleRange.end;
  }, [todayIndex, virtualScroll.visibleRange]);

  // v0.3.64: Optimized scroll handling - only re-render when visible range changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const currentViewportHeight = container.clientHeight;
    setViewportHeight(currentViewportHeight);

    const handleScroll = () => {
      const newScrollTop = container.scrollTop;
      scrollTopRef.current = newScrollTop;

      // Calculate new visible range
      const newRange = calculateVisibleRange(
        newScrollTop,
        currentViewportHeight,
        CELL_HEIGHT,
        bufferDays,
        dayCount
      );

      // Only update state if range actually changed
      setVisibleRange(prevRange => {
        if (prevRange.start !== newRange.start || prevRange.end !== newRange.end) {
          return newRange;
        }
        return prevRange;
      });
    };

    const handleResize = () => {
      const newViewportHeight = container.clientHeight;
      setViewportHeight(newViewportHeight);
      // Recalculate range on resize
      const newRange = calculateVisibleRange(
        scrollTopRef.current,
        newViewportHeight,
        CELL_HEIGHT,
        bufferDays,
        dayCount
      );
      setVisibleRange(newRange);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [bufferDays, dayCount]);

  // REQ-09.2: Auto-scroll to center the focused date
  useEffect(() => {
    if (focusedDate && containerRef.current) {
      // Calculate the day index for the focused date
      const focusedTime = focusedDate.getTime();
      const startTime = startDate.getTime();
      const msPerDay = 24 * 60 * 60 * 1000;
      const dateIndex = Math.floor((focusedTime - startTime) / msPerDay);

      if (dateIndex >= 0 && dateIndex < dayCount) {
        const containerHeight = containerRef.current.clientHeight;
        const targetScroll =
          dateIndex * CELL_HEIGHT - containerHeight / 2 + CELL_HEIGHT / 2;
        containerRef.current.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: 'smooth',
        });
      }
    }
  }, [focusedDate, startDate, dayCount]);

  return (
    <div
      ref={containerRef}
      className="w-14 h-full shrink-0 bg-zinc-950 overflow-y-auto border-r border-white/5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      data-testid="datestrip-container"
    >
      {/* v0.3.46: Virtual scroll container with full height */}
      <div
        className="relative"
        style={{ height: `${virtualScroll.totalHeight}px` }}
      >
        {/* v0.3.46: Positioned container for visible cells */}
        <div
          className="absolute left-0 right-0 flex flex-col"
          style={{ top: `${virtualScroll.offsetY}px` }}
        >
          {visibleDates.map((date, index) => {
            // Calculate day index from grid start (for viewport indicator positioning)
            const dayIndex = virtualScroll.visibleRange.start + index;

            const dateKey = formatDateKey(date);
            const isDateDepartureDate = departureDate ? isSameDay(date, departureDate) : false;
            const hasScheduledTasks = scheduledDays?.has(dateKey) ?? false;
            const isFocused = focusedDate ? isSameDay(date, focusedDate) : false;
            const isToday = isSameDay(date, today);

            // v0.3.47: Get task markers for this day
            const taskMarkers = taskMarkersPerDay?.get(dateKey) ?? [];

            // v0.3.47: Check if this day is on the timeline (between earliest task and departure)
            // Compare dates only (ignoring time), so normalize to start of day
            const isOnTimeline = (() => {
              if (!earliestTaskDate || !departureDate) return false;
              const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
              const earliestDateOnly = new Date(earliestTaskDate.getFullYear(), earliestTaskDate.getMonth(), earliestTaskDate.getDate()).getTime();
              const departureDateOnly = new Date(departureDate.getFullYear(), departureDate.getMonth(), departureDate.getDate()).getTime();
              return dateOnly >= earliestDateOnly && dateOnly <= departureDateOnly;
            })();

            // v0.3.47: Calculate current hour for "now" line
            const currentHour = isToday
              ? today.getHours() + today.getMinutes() / 60
              : undefined;

            return (
              <DateCell
                key={date.toISOString()}
                date={date}
                dayIndex={dayIndex}
                isToday={isToday}
                isFocused={isFocused}
                isDepartureDate={isDateDepartureDate}
                hasScheduledTasks={hasScheduledTasks}
                onClick={() => onDateClick?.(date)}
                currentHour={currentHour}
                taskMarkers={taskMarkers}
                isOnTimeline={isOnTimeline}
              />
            );
          })}
        </div>

        {/* v0.3.65: Always render today cell even when outside visible range */}
        {isTodayOutsideVisibleRange && todayIndex !== null && (() => {
          const todayDate = new Date(startDate);
          todayDate.setDate(todayDate.getDate() + todayIndex);
          const dateKey = formatDateKey(todayDate);
          const isDateDepartureDate = departureDate ? isSameDay(todayDate, departureDate) : false;
          const hasScheduledTasks = scheduledDays?.has(dateKey) ?? false;
          const isFocused = focusedDate ? isSameDay(todayDate, focusedDate) : false;
          const taskMarkers = taskMarkersPerDay?.get(dateKey) ?? [];
          const currentHour = today.getHours() + today.getMinutes() / 60;

          // Check if on timeline
          const isOnTimeline = (() => {
            if (!earliestTaskDate || !departureDate) return false;
            const dateOnly = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate()).getTime();
            const earliestDateOnly = new Date(earliestTaskDate.getFullYear(), earliestTaskDate.getMonth(), earliestTaskDate.getDate()).getTime();
            const departureDateOnly = new Date(departureDate.getFullYear(), departureDate.getMonth(), departureDate.getDate()).getTime();
            return dateOnly >= earliestDateOnly && dateOnly <= departureDateOnly;
          })();

          return (
            <div
              className="absolute left-0 right-0"
              style={{ top: `${todayIndex * CELL_HEIGHT}px` }}
            >
              <DateCell
                key={`today-${todayDate.toISOString()}`}
                date={todayDate}
                dayIndex={todayIndex}
                isToday={true}
                isFocused={isFocused}
                isDepartureDate={isDateDepartureDate}
                hasScheduledTasks={hasScheduledTasks}
                onClick={() => onDateClick?.(todayDate)}
                currentHour={currentHour}
                taskMarkers={taskMarkers}
                isOnTimeline={isOnTimeline}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
}
