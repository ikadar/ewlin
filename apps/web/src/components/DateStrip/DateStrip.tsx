import { useEffect, useRef } from 'react';
import { DateCell } from './DateCell';

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
 * Generate an array of dates starting from startDate.
 */
function generateDateRange(startDate: Date, dayCount: number): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < dayCount; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date);
  }
  return dates;
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
 * Supports departure date highlighting (REQ-15) and scheduled days indicator (REQ-16).
 */
export function DateStrip({
  startDate,
  dayCount = 365,
  onDateClick,
  departureDate,
  scheduledDays,
  focusedDate,
}: DateStripProps) {
  const today = new Date();
  const dates = generateDateRange(startDate, dayCount);
  const containerRef = useRef<HTMLDivElement>(null);

  // REQ-09.2: Auto-scroll to center the focused date
  useEffect(() => {
    if (focusedDate && containerRef.current) {
      const dateIndex = dates.findIndex((d) => isSameDay(d, focusedDate));
      if (dateIndex >= 0) {
        const containerHeight = containerRef.current.clientHeight;
        const targetScroll =
          dateIndex * CELL_HEIGHT - containerHeight / 2 + CELL_HEIGHT / 2;
        containerRef.current.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: 'smooth',
        });
      }
    }
  }, [focusedDate, dates]);

  return (
    <div
      ref={containerRef}
      className="w-12 shrink-0 bg-zinc-950 overflow-y-auto border-r border-white/5"
      data-testid="datestrip-container"
    >
      <div className="flex flex-col">
        {dates.map((date) => {
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
  );
}
