export interface DateCellProps {
  /** The date to display */
  date: Date;
  /** Whether this is today */
  isToday?: boolean;
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
 */
export function DateCell({ date, isToday = false, onClick }: DateCellProps) {
  const dayAbbrev = getFrenchDayAbbrev(date);
  const dayNumber = date.getDate().toString().padStart(2, '0');

  if (isToday) {
    return (
      <div
        className="h-10 flex flex-col items-center justify-center text-xs font-mono text-amber-200 border-b border-amber-500/30 cursor-pointer bg-amber-500/15"
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      >
        <span className="text-[10px]">{dayAbbrev}</span>
        <span className="font-medium">{dayNumber}</span>
      </div>
    );
  }

  return (
    <div
      className="h-10 flex flex-col items-center justify-center text-xs font-mono text-zinc-500 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <span className="text-[10px]">{dayAbbrev}</span>
      <span className="font-medium text-zinc-400">{dayNumber}</span>
    </div>
  );
}
