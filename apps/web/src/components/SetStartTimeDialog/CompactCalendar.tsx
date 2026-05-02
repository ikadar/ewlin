/**
 * CompactCalendar — single-month grid for picking a date.
 *
 * Pure presentational : the parent owns `currentMonth` (the month being shown)
 * and `selectedDay` (the picked one) ; the calendar emits navigation events
 * via callbacks. Days are rendered with state classes :
 *   - past         : faded, not clickable
 *   - today        : amber border
 *   - selected     : filled blue background
 *   - closure      : red dashed border, still clickable (the engine will
 *                    glide the pin to the next open slot — see playgrounds/
 *                    tile-prompts-and-menu.html)
 *
 * Layout follows the playground's `.calendar` block. French day-of-week
 * conventions (L M M J V S D, Monday-first).
 */
import type { ReactElement } from 'react';

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

const DOW_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

export interface CompactCalendarProps {
  /** First day of the month being displayed (set hours/min/sec to 0). */
  currentMonth: Date;
  /** The currently picked day. */
  selectedDay: Date;
  /** "Today" reference — past days are disabled relative to this. */
  today: Date;
  onSelectDay: (day: Date) => void;
  onChangeMonth: (firstOfMonth: Date) => void;
  /**
   * Optional set of dates considered closures (e.g., shop closures, holidays).
   * Weekends are also treated as closures by default.
   */
  closureDays?: ReadonlyArray<Date>;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

export function CompactCalendar({
  currentMonth,
  selectedDay,
  today,
  onSelectDay,
  onChangeMonth,
  closureDays = [],
}: CompactCalendarProps): ReactElement {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const first = new Date(year, month, 1);
  const firstIdx = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const isClosure = (d: Date): boolean => {
    if (isWeekend(d)) return true;
    return closureDays.some((c) => sameDay(c, d));
  };

  const handlePrevMonth = () => onChangeMonth(new Date(year, month - 1, 1));
  const handleNextMonth = () => onChangeMonth(new Date(year, month + 1, 1));

  const cells: ReactElement[] = [];

  // Day-of-week header
  DOW_LABELS.forEach((label, i) => {
    cells.push(
      <span key={`dow-${i}`} className="cal-dow">{label}</span>,
    );
  });

  // Empty cells before the 1st
  for (let i = 0; i < firstIdx; i++) {
    cells.push(<span key={`empty-${i}`} className="cal-day cal-empty" />);
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const isPast = date < today && !sameDay(date, today);
    const isToday = sameDay(date, today);
    const isSelected = sameDay(date, selectedDay);
    const isClosureDay = !isPast && isClosure(date);

    const classes = [
      'cal-day',
      isPast ? 'cal-disabled' : '',
      isToday ? 'cal-today' : '',
      isSelected ? 'cal-selected' : '',
      isClosureDay ? 'cal-closure' : '',
    ].filter(Boolean).join(' ');

    cells.push(
      <button
        key={`day-${day}`}
        type="button"
        className={classes}
        disabled={isPast}
        onClick={() => onSelectDay(date)}
        data-testid={`cal-day-${day}`}
        data-state={
          isPast ? 'past'
          : isSelected ? 'selected'
          : isClosureDay ? 'closure'
          : isToday ? 'today'
          : 'normal'
        }
      >
        {day}
      </button>,
    );
  }

  return (
    <div className="calendar" data-testid="compact-calendar">
      <div className="cal-header">
        <button
          type="button"
          className="cal-nav"
          onClick={handlePrevMonth}
          aria-label="Mois précédent"
          data-testid="cal-prev-month"
        >‹</button>
        <span className="cal-month" data-testid="cal-month-label">
          {MONTHS_FR[month]} {year}
        </span>
        <button
          type="button"
          className="cal-nav"
          onClick={handleNextMonth}
          aria-label="Mois suivant"
          data-testid="cal-next-month"
        >›</button>
      </div>
      <div className="cal-grid">{cells}</div>
    </div>
  );
}
