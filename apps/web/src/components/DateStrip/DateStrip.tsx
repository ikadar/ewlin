import { useEffect, useRef, useState, useMemo } from 'react';
import { DateCell } from './DateCell';
import { useVirtualScroll, getVisibleDates } from '../../hooks';

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
      className="w-12 shrink-0 bg-zinc-950 overflow-y-auto border-r border-white/5"
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
          {visibleDates.map((date) => {
            const dateKey = formatDateKey(date);
            const isDepartureDate = departureDate ? isSameDay(date, departureDate) : false;
            const hasScheduledTasks = scheduledDays?.has(dateKey) ?? false;
            const isFocused = focusedDate ? isSameDay(date, focusedDate) : false;

            return (
              <DateCell
                key={date.toISOString()}
                date={date}
                isToday={isSameDay(date, today)}
                isFocused={isFocused}
                isDepartureDate={isDepartureDate}
                hasScheduledTasks={hasScheduledTasks}
                onClick={() => onDateClick?.(date)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
