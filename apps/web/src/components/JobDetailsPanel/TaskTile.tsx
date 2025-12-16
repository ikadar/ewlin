import type { Task, TaskAssignment, Station } from '@flux/types';

export interface TaskTileProps {
  /** The task to display */
  task: Task;
  /** Job color for unscheduled styling */
  jobColor: string;
  /** Assignment if task is scheduled */
  assignment?: TaskAssignment;
  /** Station for this task (to show name) */
  station?: Station;
}

/**
 * Individual task tile with state-based styling.
 * Unscheduled: job color, border-l-4, cursor-grab
 * Scheduled: dark placeholder with station + datetime
 */
export function TaskTile({ task, jobColor, assignment, station }: TaskTileProps) {
  const isScheduled = !!assignment;

  // Format duration as Xh YY
  const formatDuration = (): string => {
    if (task.type === 'Internal') {
      const totalMinutes = task.duration.setupMinutes + task.duration.runMinutes;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours}h${minutes.toString().padStart(2, '0')}`;
    }
    return `${task.duration.openDays}j`;
  };

  // Format scheduled datetime as "Di 15/12 07:00"
  const formatScheduledTime = (isoString: string): string => {
    const date = new Date(isoString);
    const dayNames = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
    const dayName = dayNames[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${dayName} ${day}/${month} ${hours}:${minutes}`;
  };

  // Get station name
  const stationName = station?.name || 'Unknown';

  // Calculate height based on duration (for visual representation)
  // 1 hour = 100px, minimum 20px
  const getHeight = (): number => {
    if (task.type === 'Internal') {
      const totalMinutes = task.duration.setupMinutes + task.duration.runMinutes;
      const height = Math.max(20, Math.round((totalMinutes / 60) * 100));
      return Math.min(height, 200); // Cap at 200px for list view
    }
    return 60; // Default for outsourced
  };

  // Convert hex color to Tailwind-compatible classes
  // For now, we'll use inline styles for the job color
  const getColorStyles = () => {
    if (isScheduled) {
      return {
        borderColor: undefined,
        backgroundColor: undefined,
        textColor: 'text-zinc-400',
      };
    }
    // For unscheduled, use the job color
    return {
      borderColor: jobColor,
      backgroundColor: `${jobColor}20`, // 20 = ~12% opacity
      textColor: getTextColorFromHex(jobColor),
    };
  };

  // Get a lighter text color based on the job color
  const getTextColorFromHex = (hex: string): string => {
    // For simplicity, just return a class based on common color families
    // In a real app, you'd compute this from the hex
    const colorLower = hex.toLowerCase();
    if (colorLower.includes('purple') || colorLower === '#8b5cf6' || colorLower === '#a855f7') {
      return 'text-purple-300';
    }
    if (colorLower.includes('blue') || colorLower === '#3b82f6' || colorLower === '#60a5fa') {
      return 'text-blue-300';
    }
    if (colorLower.includes('green') || colorLower === '#22c55e' || colorLower === '#4ade80') {
      return 'text-green-300';
    }
    if (colorLower.includes('amber') || colorLower === '#f59e0b' || colorLower === '#fbbf24') {
      return 'text-amber-300';
    }
    if (colorLower.includes('red') || colorLower === '#ef4444' || colorLower === '#f87171') {
      return 'text-red-300';
    }
    // Default to using inline style
    return '';
  };

  const colorStyles = getColorStyles();
  const height = getHeight();

  if (isScheduled) {
    // Scheduled (placed) task - dark placeholder
    return (
      <div
        className="pt-0.5 px-2 pb-2 text-sm border-l-4 border-slate-700 bg-slate-800/40"
        style={{ height: `${height}px` }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-400 font-medium truncate min-w-0">{stationName}</span>
          <span className="text-zinc-500 shrink-0">
            {formatScheduledTime(assignment.scheduledStart)}
          </span>
        </div>
      </div>
    );
  }

  // Unscheduled task - job color styling
  return (
    <div
      className="pt-0.5 px-2 cursor-grab text-sm border-l-4"
      style={{
        height: `${height}px`,
        borderLeftColor: jobColor,
        backgroundColor: colorStyles.backgroundColor,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`font-medium truncate min-w-0 ${colorStyles.textColor}`}
          style={colorStyles.textColor ? undefined : { color: jobColor }}
        >
          {stationName}
        </span>
        <span className="text-zinc-400 shrink-0">{formatDuration()}</span>
      </div>
    </div>
  );
}
