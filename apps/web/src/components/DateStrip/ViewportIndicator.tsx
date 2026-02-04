export interface ViewportIndicatorProps {
  /** Start hour of the visible viewport within this day (can be negative if viewport starts before this day) */
  viewportStartHour: number;
  /** End hour of the visible viewport within this day (can be >24 if viewport extends past this day) */
  viewportEndHour: number;
  /** Whether this day is today (show "now" line) */
  isToday?: boolean;
  /** Current hour for "now" line position (0-24, fractional) */
  currentHour?: number;
}

/**
 * ViewportIndicator - Gray border rectangle showing which portion of the day is visible in the grid.
 *
 * Position is calculated as percentage of 24 hours:
 * - Top: (viewportStartHour / 24) * 100%
 * - Height: ((viewportEndHour - viewportStartHour) / 24) * 100%
 *
 * Values can be outside 0-100% range when viewport spans multiple days:
 * - Negative top: viewport starts before this day
 * - Height > 100%: viewport extends past this day
 *
 * If isToday, shows a red "now" line at currentHour position within the viewport.
 */
export function ViewportIndicator({
  viewportStartHour,
  viewportEndHour,
  isToday = false,
  currentHour = 0,
}: ViewportIndicatorProps) {
  // Calculate position as percentage of cell height (24 hours = 100%)
  // Values can be negative or >100% when viewport spans multiple days
  const topPercent = (viewportStartHour / 24) * 100;
  const heightPercent = ((viewportEndHour - viewportStartHour) / 24) * 100;

  // Calculate "now" line position within viewport (if today and current hour is visible)
  // Current hour is in 0-24 range, so we check if it's within the viewport portion on this day
  const isNowVisible = isToday && currentHour >= Math.max(0, viewportStartHour) && currentHour <= Math.min(24, viewportEndHour);
  const nowPositionPercent = isNowVisible
    ? ((currentHour - viewportStartHour) / (viewportEndHour - viewportStartHour)) * 100
    : 0;

  return (
    <div
      className="absolute left-0.5 right-0.5 border border-zinc-500 rounded-sm pointer-events-none overflow-visible"
      style={{
        top: `${topPercent}%`,
        height: `${heightPercent}%`,
      }}
      data-testid="viewport-indicator"
    >
      {/* "Now" line within viewport (red horizontal line) */}
      {isNowVisible && (
        <div
          className="absolute left-0 right-0 h-0.5 bg-red-500"
          style={{
            top: `${nowPositionPercent}%`,
          }}
          data-testid="viewport-now-line"
        />
      )}
    </div>
  );
}
