import { DateCell } from './DateCell';

export interface DateStripProps {
  /** Start date for the range */
  startDate: Date;
  /** Number of days to display */
  dayCount?: number;
  /** Callback when a date is clicked */
  onDateClick?: (date: Date) => void;
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
 * DateStrip - Day navigation column.
 * Displays a vertical list of days with click-to-jump functionality.
 */
export function DateStrip({
  startDate,
  dayCount = 21,
  onDateClick,
}: DateStripProps) {
  const today = new Date();
  const dates = generateDateRange(startDate, dayCount);

  return (
    <div className="w-12 shrink-0 bg-zinc-950 overflow-y-auto border-r border-white/5">
      <div className="flex flex-col">
        {dates.map((date) => (
          <DateCell
            key={date.toISOString()}
            date={date}
            isToday={isSameDay(date, today)}
            onClick={() => onDateClick?.(date)}
          />
        ))}
      </div>
    </div>
  );
}
