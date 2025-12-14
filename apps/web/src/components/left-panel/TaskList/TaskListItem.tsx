import { memo, useState, useCallback } from 'react';
import { cn } from '../../../lib/utils';
import type { Task } from '../../../types';
import { MapPin, Truck, Clock, ChevronUp, ChevronDown, Eye, Undo2 } from 'lucide-react';

interface TaskListItemProps {
  task: Task;
  isScheduled: boolean;
  jobColor: string;
  onJumpTo: () => void;
  onRecall: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: () => void;
}

function formatDuration(task: Task): string {
  if (task.type === 'outsourced' && task.durationOpenDays !== null) {
    return `${task.durationOpenDays}d`;
  }
  const total = task.setupMinutes + task.runMinutes;
  if (total >= 60) {
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
  }
  return `${total}m`;
}

export const TaskListItem = memo(function TaskListItem({
  task,
  isScheduled,
  jobColor,
  onJumpTo,
  onRecall,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
  onDragOver,
}: TaskListItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = useCallback(() => {
    if (isScheduled) {
      onJumpTo();
    }
  }, [isScheduled, onJumpTo]);

  const handleDoubleClick = useCallback(() => {
    if (isScheduled) {
      onRecall();
    }
  }, [isScheduled, onRecall]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const handleJumpToClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onJumpTo();
    },
    [onJumpTo]
  );

  const handleRecallClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRecall();
    },
    [onRecall]
  );

  const handleMoveUpClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onMoveUp?.();
    },
    [onMoveUp]
  );

  const handleMoveDownClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onMoveDown?.();
    },
    [onMoveDown]
  );

  const locationName = task.type === 'outsourced' ? task.providerName : task.stationName;
  const LocationIcon = task.type === 'outsourced' ? Truck : MapPin;

  return (
    <div
      role="listitem"
      data-task-id={task.id}
      draggable={!isScheduled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'relative flex items-center gap-2 px-2 py-1.5 rounded-md border transition-all',
        'select-none',
        isScheduled ? 'opacity-50 cursor-pointer' : 'opacity-100 cursor-grab',
        isScheduled && 'hover:opacity-70',
        isDragging && 'opacity-30 border-dashed',
        !isScheduled && !isDragging && 'hover:bg-muted/50'
      )}
      style={{
        borderLeftColor: jobColor,
        borderLeftWidth: '3px',
      }}
    >
      {/* Task info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <LocationIcon className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">
            {locationName || 'Unknown'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span>{formatDuration(task)}</span>
          {task.type === 'internal' && task.setupMinutes > 0 && (
            <span className="text-muted-foreground/70">
              ({task.setupMinutes}m setup)
            </span>
          )}
          {task.type === 'outsourced' && task.actionType && (
            <span className="text-muted-foreground/70">
              {task.actionType}
            </span>
          )}
        </div>
      </div>

      {/* Reorder buttons (always visible for unscheduled) */}
      {!isScheduled && (
        <div className="flex flex-col gap-0.5">
          <button
            onClick={handleMoveUpClick}
            disabled={!canMoveUp}
            className={cn(
              'p-0.5 rounded hover:bg-muted transition-colors',
              !canMoveUp && 'opacity-30 cursor-not-allowed'
            )}
            title="Move up"
            aria-label="Move task up"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            onClick={handleMoveDownClick}
            disabled={!canMoveDown}
            className={cn(
              'p-0.5 rounded hover:bg-muted transition-colors',
              !canMoveDown && 'opacity-30 cursor-not-allowed'
            )}
            title="Move down"
            aria-label="Move task down"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Hover buttons (only for scheduled tasks) */}
      {isScheduled && isHovered && (
        <div className="flex gap-1" data-testid="hover-buttons">
          <button
            onClick={handleJumpToClick}
            className="p-1 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
            title="Jump to tile"
            aria-label="Jump to task"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleRecallClick}
            className="p-1 rounded bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
            title="Recall (unassign)"
            aria-label="Recall task"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
});
