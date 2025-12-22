/** Pixels per hour in the timeline (default value) */
export const PIXELS_PER_HOUR = 80;

export interface HourMarkerProps {
  /** Hour to display (0-23) */
  hour: number;
  /** Y position in pixels */
  yPosition: number;
  /** Pixels per hour (default: 80) */
  pixelsPerHour?: number;
}

/**
 * Format hour for display (6h, 7h, etc.)
 */
function formatHour(hour: number): string {
  return `${hour}h`;
}

/**
 * HourMarker - Displays hour line, label, and tick marks.
 * Each hour has: full-width line, label, and 3 tick marks (15, 30, 45 min).
 */
export function HourMarker({ hour, yPosition, pixelsPerHour = PIXELS_PER_HOUR }: HourMarkerProps) {
  // Calculate tick positions based on pixelsPerHour
  const tick15 = yPosition + (pixelsPerHour * 15) / 60;
  const tick30 = yPosition + (pixelsPerHour * 30) / 60;
  const tick45 = yPosition + (pixelsPerHour * 45) / 60;

  return (
    <>
      {/* Hour line - full width */}
      <div
        className="absolute left-0 right-0 h-px bg-zinc-700/50"
        style={{ top: yPosition }}
      />
      {/* Hour label */}
      <span
        className="absolute right-2 text-sm font-mono text-zinc-600"
        style={{ top: yPosition + 1 }}
      >
        {formatHour(hour)}
      </span>
      {/* 15 min tick */}
      <div
        className="absolute right-0 w-2 h-px bg-zinc-800/50"
        style={{ top: tick15 }}
      />
      {/* 30 min tick */}
      <div
        className="absolute right-0 w-3 h-px bg-zinc-700/50"
        style={{ top: tick30 }}
      />
      {/* 45 min tick */}
      <div
        className="absolute right-0 w-2 h-px bg-zinc-800/50"
        style={{ top: tick45 }}
      />
    </>
  );
}
