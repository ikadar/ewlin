import { DateCell } from './DateCell';

export interface DateStripProps {
  /** Start date for the range */
  startDate: Date;
  /** Number of days to display */
  dayCount?: number;
  /** Callback when a date is clicked */
  onDateClick?: (date: Date) => void;
  /** Departure date for selected job (REQ-15) */
  departureDate?: Date | null;
  /** Set of dates with scheduled tasks for selected job (REQ-16) */
  scheduledDays?: Set<string>;
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

/**
 * DateStrip - Day navigation column.
 * Displays a vertical list of days with click-to-jump functionality.
 * Supports departure date highlighting (REQ-15) and scheduled days indicator (REQ-16).
 */
export function DateStrip({
  startDate,
  dayCount = 21,
  onDateClick,
  departureDate,
  scheduledDays,
}: DateStripProps) {
  const today = new Date();
  const dates = generateDateRange(startDate, dayCount);

  return (
    <div className="w-12 shrink-0 bg-zinc-950 overflow-y-auto border-r border-white/5">
      <div className="flex flex-col">
        {dates.map((date) => {
          const dateKey = formatDateKey(date);
          const isDepartureDate = departureDate ? isSameDay(date, departureDate) : false;
          const hasScheduledTasks = scheduledDays?.has(dateKey) ?? false;

          return (
            <DateCell
              key={date.toISOString()}
              date={date}
              isToday={isSameDay(date, today)}
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
