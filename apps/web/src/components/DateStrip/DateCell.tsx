export interface DateCellProps {
  /** The date to display */
  date: Date;
  /** Whether this is today */
  isToday?: boolean;
  /** Whether this is the departure date for the selected job (REQ-15) */
  isDepartureDate?: boolean;
  /** Whether the selected job has scheduled tasks on this day (REQ-16) */
  hasScheduledTasks?: boolean;
  /** Click handler */
  onClick?: () => void;
}

/** French day abbreviations (Monday = 0 after adjustment) */
const FRENCH_DAYS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

/**
 * Get French day abbreviation for a date.
 * JavaScript getDay() returns 0 for Sunday, so we adjust.
 */
function getFrenchDayAbbrev(date: Date): string {
  const jsDay = date.getDay(); // 0 = Sunday
  // Convert: Sun=0 -> 6, Mon=1 -> 0, Tue=2 -> 1, etc.
  const frenchIndex = jsDay === 0 ? 6 : jsDay - 1;
  return FRENCH_DAYS[frenchIndex];
}

/**
 * DateCell - Individual day cell in the Date Strip.
 * Shows French day abbreviation and day number.
 * Supports highlighting for today, departure date (REQ-15), and scheduled days (REQ-16).
 */
export function DateCell({
  date,
  isToday = false,
  isDepartureDate = false,
  hasScheduledTasks = false,
  onClick,
}: DateCellProps) {
  const dayAbbrev = getFrenchDayAbbrev(date);
  const dayNumber = date.getDate().toString().padStart(2, '0');

  // Determine styling based on state (priority: departure > today > normal)
  let textColor = 'text-zinc-500';
  let bgColor = '';
  let borderColor = 'border-white/5';
  let dayNumberColor = 'text-zinc-400';

  if (isDepartureDate) {
    // REQ-15: Departure date styling (red)
    textColor = 'text-red-300';
    bgColor = 'bg-red-500/10';
    borderColor = 'border-red-500/30';
    dayNumberColor = 'text-red-300';
  } else if (isToday) {
    // Today styling (amber)
    textColor = 'text-amber-200';
    bgColor = 'bg-amber-500/15';
    borderColor = 'border-amber-500/30';
    dayNumberColor = 'text-amber-200';
  }

  return (
    <button
      type="button"
      className={`h-10 w-full flex flex-col items-center justify-center text-xs font-mono ${textColor} border-b ${borderColor} cursor-pointer hover:bg-white/5 transition-colors ${bgColor} relative`}
      onClick={onClick}
      data-testid={`date-cell-${date.toISOString().split('T')[0]}`}
    >
      <span className="text-[10px]">{dayAbbrev}</span>
      <span className={`font-medium ${dayNumberColor}`}>{dayNumber}</span>
      {/* REQ-16: Scheduled tasks indicator dot */}
      {hasScheduledTasks && (
        <span
          className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500"
          data-testid="scheduled-indicator"
        />
      )}
    </button>
  );
}
