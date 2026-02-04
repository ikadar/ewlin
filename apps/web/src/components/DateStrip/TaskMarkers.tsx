/** Task marker status determines color */
export type TaskMarkerStatus = 'scheduled' | 'conflict' | 'late' | 'completed';

export interface TaskMarker {
  taskId: string;
  status: TaskMarkerStatus;
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
 * Multiple tasks are stacked vertically within the cell.
 * Each line is 2px tall with a small gap between them.
 * Positioned on the right side of the cell (starts at ~70%, ends at right edge).
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
      className="absolute bottom-1 left-[70%] right-1 flex flex-col gap-0.5 pointer-events-none"
      data-testid="task-markers"
    >
      {markers.map((marker) => (
        <div
          key={marker.taskId}
          className={`h-0.5 w-full rounded-full ${getMarkerColorClass(marker.status)}`}
          data-testid={`task-marker-${marker.taskId}`}
          data-status={marker.status}
        />
      ))}
    </div>
  );
}
