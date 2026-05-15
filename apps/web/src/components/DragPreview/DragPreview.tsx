import type { Task, Job } from '@flux/types';
import { getStateInlineColors } from '../Tile/colorUtils';

export interface DragPreviewProps {
  /** The task being dragged */
  task: Task;
  /** The job this task belongs to */
  job: Job;
  /** Current zoom level in pixels per hour (default: 80) */
  pixelsPerHour?: number;
}

/**
 * Preview component shown during drag operation.
 * Displays a semi-transparent version of the task tile.
 */
export function DragPreview({ task, job, pixelsPerHour = 80 }: DragPreviewProps) {
  const colors = getStateInlineColors('default');

  const stationName = task.type === 'Internal' ? task.stationId : 'Outsourced';

  const formatDuration = (): string => {
    if (task.type === 'Internal') {
      const totalMinutes = task.duration.setupMinutes + task.duration.runMinutes;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours}h${minutes.toString().padStart(2, '0')}`;
    }
    return `${task.duration.openDays}j`;
  };

  const getHeight = (): number => {
    const scale = pixelsPerHour / 80;
    const minHeight = Math.round(40 * scale);
    const maxHeight = Math.round(200 * scale);

    if (task.type === 'Internal') {
      const totalMinutes = task.duration.setupMinutes + task.duration.runMinutes;
      const height = Math.max(minHeight, Math.round((totalMinutes / 60) * pixelsPerHour));
      return Math.min(height, maxHeight);
    }
    return Math.round(60 * scale);
  };

  return (
    <div
      className="w-56 pt-1 px-2 pb-2 text-sm border-l-4 opacity-80 shadow-lg rounded cursor-grabbing pointer-events-none"
      style={{
        height: `${getHeight()}px`,
        borderLeftColor: colors.border,
        background: colors.bg,
      }}
      data-testid="drag-preview"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium truncate min-w-0" style={{ color: colors.text }}>
          {stationName}
        </span>
        <span className="text-zinc-400 shrink-0">{formatDuration()}</span>
      </div>
      <div className="text-xs opacity-70 truncate mt-0.5" style={{ color: colors.text }}>
        {job.reference} · {job.client}
      </div>
    </div>
  );
}
