import { memo, useRef, useState } from 'react';
import type { Task, TaskAssignment, Station, Job, OutsourcedProvider, OutsourcedTask, InternalTask } from '@flux/types';
import { Circle, CircleCheck, Scissors, Pin } from 'lucide-react';
import { useTooltipDelay } from '../../hooks';
import { OutsourcingMiniForm } from './OutsourcingMiniForm';

export type TileState = 'unplaced' | 'shipped' | 'default' | 'completed' | 'late' | 'conflict';

export interface TaskTileProps {
  /** The task to display */
  task: Task;
  /** The job this task belongs to */
  job: Job;
  /** State-based tile coloring */
  tileState: TileState;
  /** Assignment if task is scheduled */
  assignment?: TaskAssignment;
  /** Station for this task (to show name) */
  station?: Station;
  /** Whether this task is the active placement target in Quick Placement Mode */
  isActivePlacement?: boolean;
  /** Whether this task is currently picked (for Pick & Place) */
  isPicked?: boolean;
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
  /** v0.5.11: Callback when manual departure changes for outsourced task */
  onDepartureChange?: (taskId: string, departure: Date | undefined) => void;
  /** v0.5.11: Callback when manual return changes for outsourced task */
  onReturnChange?: (taskId: string, returnDate: Date | undefined) => void;
  /** Whether this is the last task of the job (one-way shipping) */
  isLastTaskOfJob?: boolean;
  /** Whether the task assignment is completed */
  isCompleted?: boolean;
  /** Whether the task assignment is pinned */
  isPinned?: boolean;
  /** Callback to toggle completion state */
  onToggleComplete?: (assignmentId: string) => void;
  /** Callback to toggle pin state */
  onTogglePin?: (assignmentId: string) => void;
  /** Callback when right-clicking a scheduled tile (context menu) */
  onContextMenu?: (x: number, y: number, assignmentId: string, isCompleted: boolean, isPinned: boolean) => void;
}

/** Visual style config per tile state */
const TILE_STYLES: Record<TileState, {
  borderColor: string;
  bg: string;
  outline?: string;
  nameColor: string;
  opacity?: string;
}> = {
  unplaced: {
    borderColor: '#3b82f6',
    bg: 'bg-[rgba(59,130,246,0.12)]',
    nameColor: 'text-blue-300',
  },
  shipped: {
    borderColor: '#10b981',
    bg: 'bg-[rgba(16,185,129,0.09)]',
    nameColor: 'text-emerald-300',
  },
  default: {
    borderColor: '#3b82f6',
    bg: 'bg-transparent',
    outline: 'outline outline-1 outline-[rgba(59,130,246,0.25)]',
    nameColor: 'text-blue-400',
  },
  completed: {
    borderColor: '#22c55e',
    bg: 'bg-[rgba(34,197,94,0.09)]',
    nameColor: 'text-green-300',
    opacity: 'opacity-50',
  },
  late: {
    borderColor: '#ef4444',
    bg: 'bg-[rgba(239,68,68,0.09)]',
    nameColor: 'text-red-300',
  },
  conflict: {
    borderColor: '#f59e0b',
    bg: 'bg-[rgba(245,158,11,0.09)]',
    nameColor: 'text-amber-300',
  },
};

/**
 * Individual task tile with state-based styling.
 * Internal tasks:
 *   - Unplaced: blue fill, duration on right, no completion circle
 *   - Default/Completed/Late/Conflict: state coloring, datetime on right, completion circle
 * Outsourced tasks:
 *   - Always show mini-form (not schedulable, just configurable)
 */
export const TaskTile = memo(function TaskTile({
  task,
  job,
  tileState,
  assignment,
  station,
  isActivePlacement = false,
  isPicked = false,
  onJumpToTask,
  onRecallTask,
  onPick,
  provider,
  predecessorEndTime,
  onDepartureChange,
  onReturnChange,
  isLastTaskOfJob: isLastTask,
  isCompleted = false,
  isPinned = false,
  onToggleComplete,
  onTogglePin,
  onContextMenu,
}: TaskTileProps) {
  // v0.5.11: Outsourced tasks render as mini-form with state-based styling
  if (task.type === 'Outsourced') {
    const style = TILE_STYLES[tileState];
    const handleOutsourcedToggleComplete = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onToggleComplete && assignment) onToggleComplete(assignment.id);
    };
    const handleOutsourcedTogglePin = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onTogglePin && assignment) onTogglePin(assignment.id);
    };
    const handleOutsourcedContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      if (onContextMenu && assignment) onContextMenu(e.clientX, e.clientY, assignment.id, isCompleted, isPinned);
    };

    return (
      <div
        className={`rounded-[3px] ${style.bg} ${style.outline ?? ''} ${style.opacity ?? ''}`}
        style={{ borderLeftColor: style.borderColor }}
        onContextMenu={handleOutsourcedContextMenu}
      >
        {/* Icons row: done + pin */}
        {assignment && (
          <div className="flex items-center gap-1 px-2 pt-1">
            {isCompleted ? (
              <CircleCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 cursor-pointer hover:text-emerald-400 transition-colors" onClick={handleOutsourcedToggleComplete} />
            ) : (
              <Circle className="w-3.5 h-3.5 text-zinc-600 shrink-0 cursor-pointer hover:text-zinc-400 transition-colors" onClick={handleOutsourcedToggleComplete} />
            )}
            <Pin
              className={`w-3 h-3 shrink-0 cursor-pointer transition-colors ${isPinned ? 'text-amber-500 hover:text-amber-400' : 'text-zinc-700 hover:text-zinc-400'}`}
              onClick={handleOutsourcedTogglePin}
              title={isPinned ? 'Désépingler' : 'Épingler'}
            />
          </div>
        )}
        <OutsourcingMiniForm
          task={task as OutsourcedTask}
          provider={provider}
          jobColor={style.borderColor}
          predecessorEndTime={predecessorEndTime}
          workshopExitDate={job.workshopExitDate}
          isLastTaskOfJob={isLastTask}
          onDepartureChange={onDepartureChange}
          onReturnChange={onReturnChange}
          isPlaced={tileState !== 'unplaced'}
        />
      </div>
    );
  }

  // Internal task handling
  const isScheduled = !!assignment;
  const style = TILE_STYLES[tileState];

  // Tooltip for scheduled tiles (recall hint)
  const { isVisible: showRecallTip, onMouseEnter: tipEnter, onMouseLeave: tipLeave } = useTooltipDelay();
  const tileRef = useRef<HTMLButtonElement>(null);
  const [tipPos, setTipPos] = useState({ top: 0, left: 0 });

  const handleTipEnter = () => {
    if (tileRef.current) {
      const rect = tileRef.current.getBoundingClientRect();
      setTipPos({ top: rect.top - 4, left: rect.left + rect.width / 2 });
    }
    tipEnter();
  };

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

  // Completion icon click handler
  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleComplete && assignment) {
      onToggleComplete(assignment.id);
    }
  };

  // Pin icon click handler
  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTogglePin && assignment) {
      onTogglePin(assignment.id);
    }
  };

  // Active placement styling (white ring/halo)
  const activePlacementStyle = isActivePlacement
    ? { boxShadow: '0 0 0 2px white, 0 0 16px rgba(255, 255, 255, 0.5)' }
    : undefined;

  // Picked state styling (v0.3.54)
  const pickedStyle = isPicked
    ? { boxShadow: '0 0 0 2px #3b82f6, 0 0 12px rgba(59, 130, 246, 0.4)', opacity: 0.7 }
    : undefined;

  const tileInlineStyle = {
    borderLeftColor: style.borderColor,
    ...activePlacementStyle,
    ...pickedStyle,
  };

  if (isScheduled) {
    // Scheduled (placed) task
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

    const handleContextMenu = (e: React.MouseEvent) => {
      if (onContextMenu && assignment) {
        e.preventDefault();
        onContextMenu(e.clientX, e.clientY, assignment.id, isCompleted, isPinned);
      }
    };

    return (
      <>
        <button
          ref={tileRef}
          type="button"
          className={`h-8 pt-0.5 px-2 text-sm border-l-4 ${style.bg} ${style.outline ?? ''} ${style.opacity ?? ''} cursor-pointer hover:brightness-125 transition-all text-left w-full`}
          style={tileInlineStyle}
          data-testid={`task-tile-${task.id}`}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          onMouseEnter={handleTipEnter}
          onMouseLeave={tipLeave}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {isCompleted ? (
                <CircleCheck
                  className="w-3.5 h-3.5 text-emerald-500 shrink-0 cursor-pointer hover:text-emerald-400 transition-colors"
                  onClick={handleToggleComplete}
                />
              ) : (
                <Circle
                  className="w-3.5 h-3.5 text-zinc-600 shrink-0 cursor-pointer hover:text-zinc-400 transition-colors"
                  onClick={handleToggleComplete}
                />
              )}
              <Pin
                className={`w-3 h-3 shrink-0 cursor-pointer transition-colors ${
                  isPinned
                    ? 'text-amber-500 hover:text-amber-400'
                    : 'text-zinc-700 hover:text-zinc-400'
                }`}
                onClick={handleTogglePin}
                title={isPinned ? 'Désépingler' : 'Épingler'}
              />
              <span className={`font-medium truncate min-w-0 ${style.nameColor}`}>{displayName}</span>
              {task.type === 'Internal' && (task as InternalTask).splitGroupId && (
                <>
                  <Scissors className="w-3 h-3 text-blue-500/40 shrink-0" />
                  <span className="text-[9px] text-blue-500 bg-blue-500/[0.15] rounded px-1 py-px font-semibold shrink-0">
                    {((task as InternalTask).splitIndex ?? 0) + 1}/{(task as InternalTask).splitTotal ?? 1}
                  </span>
                </>
              )}
            </div>
            <span className="text-zinc-500 shrink-0">
              {formatScheduledTime(assignment.scheduledStart)}
            </span>
          </div>
        </button>
        {showRecallTip && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{ left: tipPos.left, top: tipPos.top, transform: 'translate(-50%, -100%)' }}
          >
            <div className="flux-tooltip whitespace-nowrap">
              <span className="text-[var(--tt-text)]">Double-clic pour rappeler</span>
            </div>
            <div className="flex justify-center">
              <div className="flux-tooltip-arrow" />
            </div>
          </div>
        )}
      </>
    );
  }

  // Unplaced task - no completion circle, duration on right
  // Handle right-click on unplaced task for split
  const handleUnplacedContextMenu = (e: React.MouseEvent) => {
    if (onContextMenu) {
      e.preventDefault();
      // For unplaced tasks, pass task.id as assignmentId (no assignment exists)
      onContextMenu(e.clientX, e.clientY, task.id, false);
    }
  };

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

  const baseClassName = `h-8 pt-0.5 px-2 text-sm border-l-4 ${style.bg} select-none transition-all duration-150 ${getCursorClass()}`;

  const content = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`font-medium truncate min-w-0 ${style.nameColor}`}>
          {displayName}
        </span>
        {task.type === 'Internal' && (task as InternalTask).splitGroupId && (
          <>
            <Scissors className="w-3 h-3 text-blue-500/40 shrink-0" />
            <span className="text-[9px] text-blue-500 bg-blue-500/[0.15] rounded px-1 py-px font-semibold shrink-0">
              {((task as InternalTask).splitIndex ?? 0) + 1}/{(task as InternalTask).splitTotal ?? 1}
            </span>
          </>
        )}
      </div>
      <span className="text-zinc-400 shrink-0">{formatDuration()}</span>
    </div>
  );

  // Use button when interactive (onPick provided)
  if (onPick) {
    return (
      <button
        type="button"
        className={`${baseClassName} w-full text-left`}
        style={tileInlineStyle}
        data-testid={`task-tile-${task.id}`}
        onClick={handleClick}
        onContextMenu={handleUnplacedContextMenu}
      >
        {content}
      </button>
    );
  }

  // Non-interactive display
  return (
    <div
      className={baseClassName}
      style={tileInlineStyle}
      data-testid={`task-tile-${task.id}`}
      onContextMenu={handleUnplacedContextMenu}
    >
      {content}
    </div>
  );
});
