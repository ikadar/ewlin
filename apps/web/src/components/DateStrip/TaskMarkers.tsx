/** Task marker status determines color */
export type TaskMarkerStatus = 'scheduled' | 'conflict' | 'late' | 'completed';

export interface TaskMarker {
  taskId: string;
  status: TaskMarkerStatus;
  /** Start hour within the day (0-24, fractional, e.g., 9.5 = 9:30 AM) */
  startHour: number;
}

export interface TaskMarkersProps {
  /** Array of task markers to display */
  markers: TaskMarker[];
}

/** Get Tailwind color class based on task status */
function getMarkerColorClass(status: TaskMarkerStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500';
    case 'late':
      return 'bg-red-500';
    case 'conflict':
      return 'bg-amber-500';
    case 'scheduled':
    default:
      return 'bg-zinc-500';
  }
}

/**
 * TaskMarkers - Colored horizontal lines indicating tasks scheduled on a day.
 *
 * Each marker is positioned vertically at its start time (percentage of 24 hours).
 * Lines span 50% of cell width (left-[50%] to right-1).
 * Multiple markers at similar times have small vertical offset to prevent overlap.
 *
 * Colors:
 * - Gray (zinc-500): Scheduled future task
 * - Orange (amber-500): Precedence conflict
 * - Red (red-500): Late (past incomplete)
 * - Green (emerald-500): Completed
 */
export function TaskMarkers({ markers }: TaskMarkersProps) {
  if (markers.length === 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      data-testid="task-markers"
    >
      {markers.map((marker, index) => {
        // Position marker at its start time (percentage of 24 hours)
        const topPercent = (marker.startHour / 24) * 100;
        // Small offset for multiple markers at same time to prevent overlap
        const offsetPx = index * 3;

        return (
          <div
            key={marker.taskId}
            className={`absolute left-[50%] right-1 h-0.5 rounded-full ${getMarkerColorClass(marker.status)}`}
            style={{ top: `calc(${topPercent}% + ${offsetPx}px)` }}
            data-testid={`task-marker-${marker.taskId}`}
            data-status={marker.status}
          />
        );
      })}
    </div>
  );
}
