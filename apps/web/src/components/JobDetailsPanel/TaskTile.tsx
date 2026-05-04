import { memo } from 'react';
import type { Task, TaskAssignment, Station, Job, OutsourcedProvider, OutsourcedTask, InternalTask } from '@flux/types';
import { Scissors, Pin } from 'lucide-react';
import { OutsourcingMiniForm } from './OutsourcingMiniForm';
import { PendingIcon, ProgressIcon, DoneIcon, taskStatusToFluxST } from '../FluxTable/STCell';
import { useHoverCrosslink, pulseTaskTiles } from '../../hooks';
import { useNow } from '../../hooks/useNow';
import { ProgressFill } from '../Tile/ProgressFill';
import { TaskBadge } from '../Tile/TaskBadge';
import { computeOptimisticProgress } from '../Tile/saisieMath';

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
  /** Callback when a scheduled task is clicked (jump to grid) */
  onJumpToTask?: (assignment: TaskAssignment) => void;
  /** Callback to recall (unschedule) a task, triggered via context menu */
  onRecallTask?: (assignmentId: string) => void;
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
  /** Callback to toggle outsourced task done via task.status (shared with Flux ST column) */
  onToggleOutsourcedDone?: (taskId: string) => void;
  /** Callback to toggle pin state */
  onTogglePin?: (assignmentId: string) => void;
  /** Callback when right-clicking a scheduled tile (context menu) */
  onContextMenu?: (x: number, y: number, assignmentId: string, isCompleted: boolean, isPinned: boolean) => void;
  /** Operator assignments for this task */
  operatorAssignments?: Array<{
    operatorId: string;
    name: string;
    attention: number;
    from?: string;
    to?: string;
  }>;
  /** Callback to scroll the grid to a specific operator slice (operator view) */
  onJumpToOperatorSlice?: (operatorId: string, from: Date) => void;
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
  onJumpToTask,
  onRecallTask,
  provider,
  predecessorEndTime,
  onDepartureChange,
  onReturnChange,
  isLastTaskOfJob: isLastTask,
  isCompleted = false,
  isPinned = false,
  onToggleComplete,
  onToggleOutsourcedDone,
  onTogglePin,
  onContextMenu,
  operatorAssignments,
  onJumpToOperatorSlice,
}: TaskTileProps) {
  // JDP ↔ grid hover crosslink — heartbeat pulse on the paired tile(s)
  const crosslink = useHoverCrosslink(task.id);
  const now = useNow(60_000);

  // Optimistic fond-vert (Q4-Q7 of 2026-05-04 mindmap). Computed once per
  // task here ; each operator sub-tile mirrors the same task-level value
  // so the chef sees a coherent progression across the per-operator rows.
  // Hidden when the task is completed (the state color already conveys it)
  // or when no assignment exists (unplaced).
  const fondVert = (
    !isCompleted
    && task.type === 'Internal'
    && assignment
  )
    ? computeOptimisticProgress(
        assignment.scheduledStart,
        assignment.scheduledEnd,
        (task as InternalTask).duration.setupMinutes,
        (task as InternalTask).duration.runMinutes,
        (task as InternalTask).recordedProgressPct,
        (task as InternalTask).recordedAt,
        now.getTime(),
      )
    : null;

  // v0.5.11: Outsourced tasks render as mini-form with state-based styling
  if (task.type === 'Outsourced') {
    const style = TILE_STYLES[tileState];
    const handleOutsourcedToggleComplete = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onToggleOutsourcedDone) onToggleOutsourcedDone(task.id);
    };
    const handleOutsourcedTogglePin = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onTogglePin && assignment) onTogglePin(assignment.id);
    };
    const handleOutsourcedContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      if (onContextMenu && assignment) onContextMenu(e.clientX, e.clientY, assignment.id, isCompleted, isPinned);
    };

    // Build inline header icons for the mini-form — 3-state ST status (same as Flux column)
    const stStatus = taskStatusToFluxST(task.status);
    const headerIcons = tileState !== 'unplaced' ? (
      <>
        <button
          type="button"
          className={`p-1 -m-1 rounded shrink-0 cursor-pointer inline-flex items-center transition-colors hover:bg-white/5 ${
            stStatus === 'done' ? 'text-emerald-500 hover:text-emerald-400'
            : stStatus === 'progress' ? 'text-amber-500 hover:text-amber-400'
            : 'text-zinc-500 hover:text-zinc-400'
          }`}
          onClick={handleOutsourcedToggleComplete}
        >
          {stStatus === 'done' && <DoneIcon />}
          {stStatus === 'progress' && <ProgressIcon />}
          {stStatus === 'pending' && <PendingIcon />}
        </button>
        {assignment && (
          <span
            onClick={handleOutsourcedTogglePin}
            className={`pin-toggle p-1 -m-1 rounded shrink-0 cursor-pointer inline-flex items-center transition-colors hover:bg-white/5 ${
              isPinned ? 'text-amber-500 hover:text-amber-400' : 'text-zinc-700 hover:text-zinc-400'
            }`}
            title={isPinned ? 'Désépingler' : 'Épingler'}
          >
            <Pin className="w-3 h-3" />
          </span>
        )}
      </>
    ) : undefined;

    return (
      <div
        className={`${style.bg} ${style.outline ?? ''} ${style.opacity ?? ''}`}
        style={{ borderLeftColor: style.borderColor }}
        onContextMenu={handleOutsourcedContextMenu}
      >
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
          headerIcons={headerIcons}
        />
      </div>
    );
  }

  // Internal task handling
  const isScheduled = !!assignment;
  const style = TILE_STYLES[tileState];

  // Format a minute count as "Xh MM"
  const formatMinutes = (m: number): string => {
    const hours = Math.floor(m / 60);
    const minutes = m % 60;
    return `${hours}h${minutes.toString().padStart(2, '0')}`;
  };

  // Theoretical duration (setup + run minutes) and effective duration
  // (sum of operator to - from). Shown in place of the scheduled date/time
  // on placed tiles, since the date + time window is carried by operator rows.
  const theoMinutes = task.duration.setupMinutes + task.duration.runMinutes;
  const effMinutes: number | null = (() => {
    if (!assignment?.operators?.length) return null;
    let total = 0;
    for (const op of assignment.operators) {
      if (!op.from || !op.to) return null;
      total += (new Date(op.to).getTime() - new Date(op.from).getTime()) / 60000;
    }
    return Math.round(total);
  })();
  const hasEffDelta = effMinutes !== null && effMinutes !== theoMinutes;

  // Get display name (station name for internal tasks)
  const displayName = station?.name || 'Unknown';

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
  const tileInlineStyle = {
    borderLeftColor: style.borderColor,
    ...activePlacementStyle,
  };

  if (isScheduled) {
    // Scheduled (placed) task
    const handleClick = () => {
      if (onJumpToTask && assignment) {
        onJumpToTask(assignment);
        pulseTaskTiles(task.id);
      }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
      if (onContextMenu && assignment) {
        e.preventDefault();
        onContextMenu(e.clientX, e.clientY, assignment.id, isCompleted, isPinned);
      }
    };

    return (
      <button
        type="button"
        className={`border-l-4 ${style.bg} ${style.outline ?? ''} ${style.opacity ?? ''} cursor-pointer hover:brightness-125 transition-all text-left w-full focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:-outline-offset-2`}
        style={tileInlineStyle}
        data-testid={`task-tile-${task.id}`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        {...crosslink}
      >
        <div className="flex items-center justify-between gap-2 min-h-[32px] pt-[7px] pb-[7px] pl-[11px] pr-[10px] text-[12.5px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              onClick={handleTogglePin}
              className={`pin-toggle p-1 -m-1 rounded shrink-0 cursor-pointer inline-flex items-center transition-colors hover:bg-white/5 ${
                isPinned ? 'text-amber-500 hover:text-amber-400' : 'text-zinc-700 hover:text-zinc-400'
              }`}
              title={isPinned ? 'Désépingler' : 'Épingler'}
            >
              <Pin className="w-3 h-3" />
            </span>
            <span className={`font-medium truncate min-w-0 ${style.nameColor}`}>{displayName}</span>
            {task.type === 'Internal' && (task as InternalTask).splitGroupId && (
              <>
                <Scissors className="w-3 h-3 text-blue-500/40 shrink-0" />
                <span className="text-[10.5px] tabular-nums text-blue-500 bg-blue-500/[0.15] rounded-[3px] px-[5px] py-px font-bold tracking-[0.02em] shrink-0">
                  {((task as InternalTask).splitIndex ?? 0) + 1}/{(task as InternalTask).splitTotal ?? 1}
                </span>
              </>
            )}
          </div>
          <span className="text-[11px] shrink-0 font-mono">
            {hasEffDelta ? (
              <>
                <span className="text-zinc-600 line-through">{formatMinutes(theoMinutes)}</span>
                <span className="text-amber-400 font-semibold"> → {formatMinutes(effMinutes!)}</span>
              </>
            ) : (
              <span className="text-zinc-400">{formatMinutes(theoMinutes)}</span>
            )}
          </span>
        </div>
        {operatorAssignments && operatorAssignments.length > 0 && (
          <div className="flex flex-col pt-0 pl-[11px] pr-[10px] pb-2 gap-[3px]">
            {[...operatorAssignments].sort((a, b) => {
              // Chronological order by start time. Absent `from` is pushed
              // to the end (defensive — shouldn't happen on scheduled tasks).
              const ta = a.from ? new Date(a.from).getTime() : Number.POSITIVE_INFINITY;
              const tb = b.from ? new Date(b.from).getTime() : Number.POSITIVE_INFINITY;
              return ta - tb;
            }).map((op, i) => {
              const nameParts = op.name.split(' ');
              const displayName = nameParts.length >= 2
                ? `${nameParts[0].charAt(0)}. ${nameParts.slice(1).join(' ')}`
                : op.name;
              const fromDate = op.from ? new Date(op.from) : null;
              const toDate = op.to ? new Date(op.to) : null;
              const dateStr = fromDate
                ? `${String(fromDate.getDate()).padStart(2, '0')}/${String(fromDate.getMonth() + 1).padStart(2, '0')}`
                : '';
              const fromTime = fromDate ? fromDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
              const toTime = toDate ? toDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
              const timeRange = fromTime && toTime ? `${dateStr} ${fromTime}–${toTime}` : '';

              // Per-operator badge — share of the parent task this operator
              // handles, by wallclock ratio. Single op covering whole task →
              // 100. Two sequential ops half-each → 50 / 50. Masked-time
              // concurrent → 100 / 100 (overlap, sum > 100 by design).
              const opBadgePct = ((): number => {
                if (!assignment || !fromDate || !toDate) return 100;
                const totalMs = new Date(assignment.scheduledEnd).getTime()
                  - new Date(assignment.scheduledStart).getTime();
                if (totalMs <= 0) return 100;
                const opMs = toDate.getTime() - fromDate.getTime();
                return Math.max(0, Math.min(100, (opMs / totalMs) * 100));
              })();

              const isClickable = !!onJumpToOperatorSlice && !!fromDate;
              const jumpToSlice = (e: React.SyntheticEvent) => {
                if (!isClickable || !fromDate) return;
                e.stopPropagation();
                onJumpToOperatorSlice!(op.operatorId, fromDate);
                pulseTaskTiles(task.id);
              };
              return (
                <div
                  key={i}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onClick={isClickable ? jumpToSlice : undefined}
                  onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jumpToSlice(e); } } : undefined}
                  className={`relative flex items-center gap-[7px] bg-zinc-700/45 rounded-[3px] px-[7px] py-[3px] overflow-hidden ${
                    isClickable ? 'cursor-pointer hover:bg-zinc-700/75 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30' : ''
                  }`}
                >
                  {fondVert && (fondVert.pct > 0 || fondVert.isLate) && (
                    <ProgressFill
                      pct={fondVert.pct}
                      isLate={fondVert.isLate}
                      direction="horizontal"
                    />
                  )}
                  <div className="relative w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                  <span className="relative text-[11.5px] text-zinc-300 truncate flex-1">{displayName}</span>
                  <span className="relative text-[10.5px] text-zinc-500 font-mono shrink-0">{timeRange}</span>
                  <TaskBadge pct={opBadgePct} forceShow />
                </div>
              );
            })}
          </div>
        )}
      </button>
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
  const baseClassName = `border-l-4 ${style.bg} select-none transition-all duration-150 cursor-default`;

  return (
    <div
      className={baseClassName}
      style={tileInlineStyle}
      data-testid={`task-tile-${task.id}`}
      onContextMenu={handleUnplacedContextMenu}
      {...crosslink}
    >
      <div className="flex items-center justify-between gap-2 min-h-[32px] pt-[7px] pb-[7px] pl-[11px] pr-[10px] text-[12.5px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`font-medium truncate min-w-0 ${style.nameColor}`}>
            {displayName}
          </span>
          {task.type === 'Internal' && (task as InternalTask).splitGroupId && (
            <>
              <Scissors className="w-3 h-3 text-blue-500/40 shrink-0" />
              <span className="text-[10.5px] tabular-nums text-blue-500 bg-blue-500/[0.15] rounded-[3px] px-[5px] py-px font-bold tracking-[0.02em] shrink-0">
                {((task as InternalTask).splitIndex ?? 0) + 1}/{(task as InternalTask).splitTotal ?? 1}
              </span>
            </>
          )}
        </div>
        <span className="text-zinc-400 shrink-0 font-mono text-[10.5px]">{formatMinutes(theoMinutes)}</span>
      </div>
    </div>
  );
});
