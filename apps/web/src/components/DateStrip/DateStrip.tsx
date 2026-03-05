import { useEffect, useRef, useState, useMemo } from 'react';
import { DateCell } from './DateCell';
import { useVirtualScroll, getVisibleDates } from '../../hooks';
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
  /** v0.3.47: Viewport start hour (0-24) for viewport indicator */
  viewportStartHour?: number;
  /** v0.3.47: Viewport end hour (0-24) for viewport indicator */
  viewportEndHour?: number;
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
 * Uses local date (not UTC) to match visual calendar display.
 */
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Height of each date cell in pixels */
const CELL_HEIGHT = 40; // h-10 = 2.5rem = 40px

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
  viewportStartHour,
  viewportEndHour,
  taskMarkersPerDay,
  earliestTaskDate,
}: DateStripProps) {
  const today = new Date();
  const containerRef = useRef<HTMLDivElement>(null);

  // v0.3.46: Track scroll position and viewport for virtual scrolling
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400);

  // v0.3.46: Virtual scroll calculation
  const virtualScroll = useVirtualScroll({
    totalDays: dayCount,
    bufferDays,
    dayHeightPx: CELL_HEIGHT,
    scrollTop,
    viewportHeight,
  });

  // v0.3.46: Get only the visible dates
  const visibleDates = useMemo(() => {
    return getVisibleDates(startDate, virtualScroll.visibleRange);
  }, [startDate, virtualScroll.visibleRange]);

  // v0.3.46: Track scroll position
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setViewportHeight(container.clientHeight);

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    const handleResize = () => {
      setViewportHeight(container.clientHeight);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

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
      className="w-12 h-full shrink-0 bg-zinc-950 overflow-y-auto border-r border-white/5"
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
                viewportStartHour={viewportStartHour}
                viewportEndHour={viewportEndHour}
                currentHour={currentHour}
                taskMarkers={taskMarkers}
                isOnTimeline={isOnTimeline}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
