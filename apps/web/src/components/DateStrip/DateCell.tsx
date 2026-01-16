import { useState } from 'react';
import { ViewportIndicator } from './ViewportIndicator';
import { TaskMarkers, type TaskMarker } from './TaskMarkers';
import { ExitTriangle } from './ExitTriangle';

export interface DateCellProps {
  /** The date to display */
  date: Date;
  /** Day index from grid start (0 = first day) - used for viewport indicator positioning */
  dayIndex: number;
  /** Whether this is today */
  isToday?: boolean;
  /** Whether this is the focused day in the grid (REQ-09.2) */
  isFocused?: boolean;
  /** Whether this is the departure date for the selected job (REQ-15) */
  isDepartureDate?: boolean;
  /** Whether the selected job has scheduled tasks on this day (REQ-16) */
  hasScheduledTasks?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** v0.3.47: Current hour for "now" line (0-24, fractional) */
  currentHour?: number;
  /** v0.3.47: Task markers for this day */
  taskMarkers?: TaskMarker[];
  /** v0.3.47: Whether this day is on the task timeline (between earliest task and exit) */
  isOnTimeline?: boolean;
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
  dayIndex,
  isToday = false,
  isFocused = false,
  isDepartureDate = false,
  hasScheduledTasks = false,
  onClick,
  currentHour,
  taskMarkers = [],
  isOnTimeline = false,
}: DateCellProps) {
  const dayAbbrev = getFrenchDayAbbrev(date);
  const dayNumber = date.getDate().toString().padStart(2, '0');

  // REQ-01: Full date tooltip in French (e.g., "Vendredi 9 janvier 2026")
  const fullDateString = date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  // Capitalize first letter (toLocaleDateString returns lowercase weekday)
  const tooltipDate = fullDateString.charAt(0).toUpperCase() + fullDateString.slice(1);

  // Custom tooltip state for fast appearance
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  // Calculate tooltip position on mouse enter
  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      top: rect.top + rect.height / 2,
      left: rect.right + 8, // 8px gap from the cell
    });
    setShowTooltip(true);
  };

  // Determine styling based on state (priority: departure > focused > normal)
  // REQ-09.3: Today is now indicated by a thin line, not background color
  let textColor = 'text-zinc-500';
  let bgColor = '';
  let borderColor = 'border-white/5';
  let dayNumberColor = 'text-zinc-400';

  if (isDepartureDate) {
    // REQ-15: Departure date - v0.3.47: now indicated by exit triangle only, no background
    textColor = 'text-zinc-400';
    borderColor = 'border-white/5';
    dayNumberColor = 'text-zinc-400';
  } else if (isFocused) {
    // REQ-09.3: Focused day styling (white/light highlight)
    textColor = 'text-zinc-200';
    bgColor = 'bg-white/10';
    borderColor = 'border-white/20';
    dayNumberColor = 'text-zinc-100';
  }

  return (
    <button
      type="button"
      className={`h-12 w-full flex flex-col items-center justify-center text-sm font-mono ${textColor} border-b ${borderColor} cursor-pointer hover:bg-white/5 transition-colors ${bgColor} relative overflow-visible`}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
      data-testid={`date-cell-${date.toISOString().split('T')[0]}`}
    >
      {/* REQ-01: Custom tooltip with fast appearance - uses fixed position to escape overflow */}
      {showTooltip && (
        <div
          className="fixed z-50 px-2 py-1 bg-zinc-800 text-zinc-200 text-sm rounded shadow-lg whitespace-nowrap pointer-events-none -translate-y-1/2"
          style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
          role="tooltip"
        >
          {tooltipDate}
        </div>
      )}
      {/* v0.3.64: Viewport indicator - uses RAF loop for smooth updates */}
      {/* Automatically hides when viewport doesn't overlap this day */}
      <ViewportIndicator
        dayIndex={dayIndex}
        isToday={isToday}
        currentHour={currentHour}
      />

      {/* v0.3.47: Task timeline dotted line (from earliest task to exit) */}
      {isOnTimeline && (
        <div
          className="absolute right-0 top-0 bottom-0 w-0 border-l-2 border-dotted border-zinc-400 pointer-events-none"
          data-testid="task-timeline"
        />
      )}

      {/* v0.3.64: Today indicator removed - ViewportIndicator handles "now" line display */}

      <span className="text-xs relative z-10">{dayAbbrev}</span>
      <span className={`font-medium ${dayNumberColor} relative z-10`}>{dayNumber}</span>

      {/* v0.3.47: Task markers (colored lines for each task on this day) */}
      {taskMarkers.length > 0 && <TaskMarkers markers={taskMarkers} />}

      {/* v0.3.47: Exit triangle (workshop exit date) */}
      {isDepartureDate && <ExitTriangle />}

      {/* REQ-16: Scheduled tasks indicator dot (legacy - keep for backward compat if no task markers) */}
      {hasScheduledTasks && taskMarkers.length === 0 && (
        <span
          className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500"
          data-testid="scheduled-indicator"
        />
      )}
    </button>
  );
}
