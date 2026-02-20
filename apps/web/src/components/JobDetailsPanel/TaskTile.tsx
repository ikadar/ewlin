import type { Task, TaskAssignment, Station, Job, OutsourcedProvider, OutsourcedTask } from '@flux/types';
import { OutsourcingMiniForm } from './OutsourcingMiniForm';

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
  /** Whether this task is currently picked (for Pick & Place) */
  isPicked?: boolean;
  /** Whether this task is involved in a precedence conflict */
  hasConflict?: boolean;
  /** Callback when a scheduled task is clicked (jump to grid) */
  onJumpToTask?: (assignment: TaskAssignment) => void;
  /** Callback when a scheduled task is double-clicked (recall) */
  onRecallTask?: (assignmentId: string) => void;
  /** Callback when an unscheduled task is clicked (pick for placement) - v0.3.54 */
  onPick?: (task: Task, job: Job, clientX: number, clientY: number) => void;
  /** v0.5.11: Provider for outsourced tasks */
  provider?: OutsourcedProvider;
  /** v0.5.11: End time of predecessor task (ISO string) for outsourcing calculations */
  predecessorEndTime?: string;
  /** v0.5.11: Callback when work days changes for outsourced task */
  onWorkDaysChange?: (taskId: string, workDays: number) => void;
  /** v0.5.11: Callback when manual departure changes for outsourced task */
  onDepartureChange?: (taskId: string, departure: Date | undefined) => void;
  /** v0.5.11: Callback when manual return changes for outsourced task */
  onReturnChange?: (taskId: string, returnDate: Date | undefined) => void;
}

/**
 * Individual task tile with state-based styling.
 * Internal tasks:
 *   - Unscheduled: job color, border-l-4, clickable for Pick & Place
 *   - Scheduled: dark placeholder with station + datetime
 * Outsourced tasks:
 *   - Always show mini-form (not schedulable, just configurable)
 * v0.3.57: Drag & drop removed, now uses Pick & Place only
 * v0.5.11: Outsourcing Mini-Form for outsourced tasks
 */
export function TaskTile({
  task,
  job,
  jobColor,
  assignment,
  station,
  isActivePlacement = false,
  isPicked = false,
  hasConflict = false,
  onJumpToTask,
  onRecallTask,
  onPick,
  provider,
  predecessorEndTime,
  onWorkDaysChange,
  onDepartureChange,
  onReturnChange,
}: TaskTileProps) {
  // v0.5.11: Outsourced tasks render as mini-form
  if (task.type === 'Outsourced') {
    return (
      <OutsourcingMiniForm
        task={task as OutsourcedTask}
        provider={provider}
        jobColor={jobColor}
        predecessorEndTime={predecessorEndTime}
        workshopExitDate={job.workshopExitDate}
        onWorkDaysChange={onWorkDaysChange}
        onDepartureChange={onDepartureChange}
        onReturnChange={onReturnChange}
      />
    );
  }

  // Internal task handling
  const isScheduled = !!assignment;

  // Format duration as Xh YY
  const formatDuration = (): string => {
    const totalMinutes = task.duration.setupMinutes + task.duration.runMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h${minutes.toString().padStart(2, '0')}`;
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

  // Get display name (station name for internal tasks)
  const displayName = station?.name || 'Unknown';

  // Convert hex color to Tailwind-compatible classes
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
    return '';
  };

  const colorStyles = getColorStyles();

  // Precedence conflict amber glow (matches grid Tile styling)
  const conflictStyle = hasConflict
    ? { boxShadow: '0 0 12px 4px #F59E0B99' }
    : undefined;

  if (isScheduled) {
    // Scheduled (placed) task - dark placeholder (not draggable)
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
        className="h-8 pt-0.5 px-2 text-sm border-l-4 border-slate-700 bg-slate-800/40 cursor-pointer hover:bg-slate-800/60 transition-colors text-left w-full"
        style={conflictStyle}
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

  // Active placement styling (white ring/halo)
  const activePlacementStyle = isActivePlacement
    ? {
        boxShadow: '0 0 0 2px white, 0 0 16px rgba(255, 255, 255, 0.5)',
      }
    : undefined;

  // Picked state styling (v0.3.54)
  const pickedStyle = isPicked
    ? {
        boxShadow: '0 0 0 2px #3b82f6, 0 0 12px rgba(59, 130, 246, 0.4)',
        opacity: 0.7,
      }
    : undefined;

  // Handle click for pick & place
  const handleClick = (e: React.MouseEvent) => {
    if (onPick) {
      onPick(task, job, e.clientX, e.clientY);
    }
  };

  // Determine cursor style
  const getCursorClass = () => {
    if (isPicked) return 'cursor-default';
    if (onPick) return 'cursor-pointer';
    return 'cursor-default';
  };

  // Unscheduled task - job color styling, clickable for Pick & Place
  const baseClassName = `h-8 pt-0.5 px-2 text-sm border-l-4 select-none transition-all duration-150 ${getCursorClass()}`;
  const tileStyle = {
    borderLeftColor: jobColor,
    backgroundColor: colorStyles.backgroundColor,
    ...activePlacementStyle,
    ...pickedStyle,
    ...conflictStyle,
  };

  const content = (
    <div className="flex items-center justify-between gap-2">
      <span
        className={`font-medium truncate min-w-0 ${colorStyles.textColor}`}
        style={colorStyles.textColor ? undefined : { color: jobColor }}
      >
        {displayName}
      </span>
      <span className="text-zinc-400 shrink-0">{formatDuration()}</span>
    </div>
  );

  // Use button when interactive (onPick provided)
  if (onPick) {
    return (
      <button
        type="button"
        className={`${baseClassName} w-full text-left`}
        style={tileStyle}
        data-testid={`task-tile-${task.id}`}
        onClick={handleClick}
      >
        {content}
      </button>
    );
  }

  // Non-interactive display
  return (
    <div
      className={baseClassName}
      style={tileStyle}
      data-testid={`task-tile-${task.id}`}
    >
      {content}
    </div>
  );
}
