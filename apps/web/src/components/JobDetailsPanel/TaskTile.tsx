import type { Task, TaskAssignment, Station, Job } from '@flux/types';

export interface TaskTileProps {
  /** The task to display */
  task: Task;
  /** The job this task belongs to */
  job: Job;
  /** Job color for unscheduled styling */
  jobColor: string;
  /** Assignment if task is scheduled */
  assignment?: TaskAssignment;
  /** Station for this task (to show name) */
  station?: Station;
  /** Whether this task is the active placement target in Quick Placement Mode */
  isActivePlacement?: boolean;
  /** Whether this task is currently being picked (Pick & Place mode) */
  isPicked?: boolean;
  /** Callback when a scheduled task is clicked (jump to grid) */
  onJumpToTask?: (assignment: TaskAssignment) => void;
  /** Callback when a scheduled task is double-clicked (recall) */
  onRecallTask?: (assignmentId: string) => void;
  /** Callback when an unscheduled task is clicked (Pick & Place mode) */
  onPickTask?: (task: Task, job: Job) => void;
}

/**
 * Individual task tile with state-based styling.
 * Unscheduled: job color, border-l-4, clickable for Pick & Place
 * Scheduled: dark placeholder with station + datetime
 */
export function TaskTile({ task, job, jobColor, assignment, station, isActivePlacement = false, isPicked = false, onJumpToTask, onRecallTask, onPickTask }: TaskTileProps) {
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

  // Get display name based on task type
  const getDisplayName = (): string => {
    if (task.type === 'Internal') {
      return station?.name || 'Unknown';
    }
    // Outsourced task - show action type (e.g., "Pelliculage", "Reliure")
    return task.actionType || 'Sous-traitance';
  };
  const displayName = getDisplayName();

  // v0.3.70: Fixed height for all tasks (simpler, more practical list view)
  const TASK_HEIGHT = 32;

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

  if (isScheduled) {
    // Scheduled (placed) task - dark placeholder (not draggable)
    // Single-click: jump to grid position
    // Double-click: recall (unschedule)
    const handleClick = () => {
      if (onJumpToTask && assignment) {
        onJumpToTask(assignment);
      }
    };

    const handleDoubleClick = () => {
      if (onRecallTask && assignment) {
        onRecallTask(assignment.id);
      }
    };

    return (
      <button
        type="button"
        className="pt-0.5 px-2 pb-2 text-sm border-l-4 border-slate-700 bg-slate-800/40 cursor-pointer hover:bg-slate-800/60 transition-colors text-left w-full"
        style={{ height: `${TASK_HEIGHT}px` }}
        data-testid={`task-tile-${task.id}`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-400 font-medium truncate min-w-0">{displayName}</span>
          <span className="text-zinc-500 shrink-0">
            {formatScheduledTime(assignment.scheduledStart)}
          </span>
        </div>
      </button>
    );
  }

  // Active placement styling (white ring/halo) - for Quick Placement Mode
  const getHighlightStyle = () => {
    if (isActivePlacement) {
      return {
        boxShadow: '0 0 0 2px white, 0 0 16px rgba(255, 255, 255, 0.5)',
      };
    }
    return undefined;
  };

  // Handle click to pick task
  const handleClick = () => {
    if (onPickTask && !isPicked) {
      onPickTask(task, job);
    }
  };

  // v0.3.55: Picked state - looks like scheduled task with pulse animation
  if (isPicked) {
    return (
      <div
        className="pt-0.5 px-2 pb-2 text-sm border-l-4 text-left w-full animate-pulse-opacity"
        style={{
          height: `${TASK_HEIGHT}px`,
          borderLeftColor: jobColor,
          backgroundColor: colorStyles.backgroundColor,
        }}
        data-testid={`task-tile-${task.id}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={`font-medium truncate min-w-0 ${colorStyles.textColor}`}
            style={colorStyles.textColor ? undefined : { color: jobColor }}
          >
            {displayName}
          </span>
          <span className="text-zinc-400 shrink-0">...</span>
        </div>
      </div>
    );
  }

  // Unscheduled task - job color styling, clickable for Pick & Place
  // v0.3.55: cursor grab + hover effect (shadow + translateY)
  return (
    <button
      type="button"
      onClick={handleClick}
      className="pt-0.5 px-2 text-sm border-l-4 touch-none select-none text-left w-full transition-all duration-150 cursor-grab hover:shadow-md hover:-translate-y-0.5 hover:brightness-110"
      style={{
        height: `${TASK_HEIGHT}px`,
        borderLeftColor: jobColor,
        backgroundColor: colorStyles.backgroundColor,
        ...getHighlightStyle(),
      }}
      data-testid={`task-tile-${task.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`font-medium truncate min-w-0 ${colorStyles.textColor}`}
          style={colorStyles.textColor ? undefined : { color: jobColor }}
        >
          {displayName}
        </span>
        <span className="text-zinc-400 shrink-0">{formatDuration()}</span>
      </div>
    </button>
  );
}
