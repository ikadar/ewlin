import { useState, useCallback, useMemo } from 'react';
import type { Job, Task, TaskAssignment, Station, StationCategory, Element, OutsourcedProvider, InternalTask } from '@flux/types';
import { X, Calendar, CalendarCheck } from 'lucide-react';
import { TaskList } from './TaskList';
import { JobDetailContextMenu } from './JobDetailContextMenu';
import { getTasksForJob } from '../../utils/taskHelpers';

export interface JobDetailsPanelProps {
  /** Selected job to display (null if none selected) */
  job: Job | null;
  /** All tasks */
  tasks: Task[];
  /** All elements */
  elements: Element[];
  /** All assignments */
  assignments: TaskAssignment[];
  /** All stations */
  stations: Station[];
  /** Station categories for printing/die-cutting detection */
  categories?: StationCategory[];
  /** v0.5.11: All providers for outsourced tasks */
  providers?: OutsourcedProvider[];
  /** Task ID that is the active placement target in Quick Placement Mode */
  activeTaskId?: string | null;
  /** Callback when a scheduled task is clicked (jump to grid) */
  onJumpToTask?: (assignment: TaskAssignment) => void;
  /** Callback to recall (unschedule) a task, triggered via context menu */
  onRecallTask?: (assignmentId: string) => void;
  /** Callback when close button is clicked (REQ-02) */
  onClose?: () => void;
  /** REQ-02: Callback when departure date is clicked (scrolls grid to date) */
  onDateClick?: (date: Date) => void;
  /** v0.5.11: Callback when manual departure changes for outsourced task */
  onDepartureChange?: (taskId: string, departure: Date | undefined) => void;
  /** v0.5.11: Callback when manual return changes for outsourced task */
  onReturnChange?: (taskId: string, returnDate: Date | undefined) => void;
  /** Callback when completion icon is clicked (assignmentId) */
  onToggleComplete?: (assignmentId: string) => void;
  /** Callback when outsourced task done circle is clicked (taskId) */
  onToggleOutsourcedDone?: (taskId: string) => void;
  /** Callback when pin icon is clicked (assignmentId) */
  onTogglePin?: (assignmentId: string) => void;
  /** Task IDs involved in precedence conflicts (for amber glow highlighting) */
  conflictTaskIds?: Set<string>;
  /** v0.5.13b: Callback when edit button is clicked */
  onEditJob?: () => void;
  /** Job IDs that are late (past workshop exit date) */
  lateJobIds?: Set<string>;
  /** Job IDs that are shipped (highest priority tile coloring) */
  shippedJobIds?: Set<string>;
  /** Callback when split is requested (taskId, x, y) */
  onSplitTask?: (taskId: string, x: number, y: number) => void;
  /** Callback when fuse is requested (taskId) */
  onFuseTask?: (taskId: string) => void;
  /** All jobs in snapshot (for dependency display) */
  allJobs?: Job[];
  /** Callback when a dependency job chip is clicked */
  onSelectJob?: (jobId: string) => void;
  /** Operators from snapshot (for displaying names on assignments) */
  snapshotOperators?: Array<{ id: string; firstName: string; lastName: string }>;
  /** Callback to scroll the operator grid to a specific operator slice */
  onJumpToOperatorSlice?: (operatorId: string, from: Date) => void;
}

/** Format a datetime as DD/MM/YYYY a HHhMM */
function formatJobDate(dateStr: string): string {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (match) {
    const [, year, month, day, hours, minutes] = match;
    return `${day}/${month}/${year} a ${hours}h${minutes}`;
  }
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} a ${hours}h${minutes}`;
}

const PRIORITY_LABELS = ['Impératif', 'Important', 'Standard', 'Flexible'] as const;
const PRIORITY_CHIP_CLASSES = [
  'bg-red-500/15 text-red-400',
  'bg-amber-500/15 text-amber-400',
  '',
  'bg-blue-500/15 text-blue-400',
];

/**
 * Job Details Panel showing selected job information and task list.
 * Only visible when a job is selected.
 */
export function JobDetailsPanel({
  job,
  tasks,
  elements,
  assignments,
  stations,
  categories,
  providers,
  activeTaskId,
  conflictTaskIds,
  onJumpToTask,
  onRecallTask,
  onClose,
  onDateClick,
  onToggleComplete,
  onToggleOutsourcedDone,
  onTogglePin,
  onDepartureChange,
  onReturnChange,
  onEditJob,
  lateJobIds,
  shippedJobIds,
  onSplitTask,
  onFuseTask,
  allJobs,
  onSelectJob,
  snapshotOperators,
  onJumpToOperatorSlice,
}: JobDetailsPanelProps) {
  // Memoize data filtering for this job
  const emptyJobData = { jobTasks: [] as Task[], jobElements: [] as Element[], jobAssignments: [] as TaskAssignment[] };
  const { jobTasks, jobElements, jobAssignments } = useMemo(() => {
    if (!job) return emptyJobData;
    const jt = getTasksForJob(job.id, tasks, elements);
    const je = elements.filter((e) => job.elementIds.includes(e.id));
    const jtIds = new Set(jt.map((t) => t.id));
    const ja = assignments.filter((a) => jtIds.has(a.taskId));
    return { jobTasks: jt, jobElements: je, jobAssignments: ja };
  }, [job, tasks, elements, assignments]);

  // Context menu state
  // For unassigned tasks, assignmentId is actually the taskId (no assignment exists)
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    assignmentId: string;
    isCompleted: boolean;
    isPinned: boolean;
    taskId?: string;
    isUnassigned?: boolean;
  } | null>(null);

  const handleTileContextMenu = useCallback(
    (x: number, y: number, assignmentId: string, isCompleted: boolean, isPinned: boolean) => {
      // Check if this is an unassigned task (assignmentId is actually a taskId)
      const isAssignment = jobAssignments.some((a) => a.id === assignmentId);
      if (isAssignment) {
        const assignment = jobAssignments.find((a) => a.id === assignmentId);
        setContextMenu({ x, y, assignmentId, isCompleted, isPinned, taskId: assignment?.taskId });
      } else {
        // assignmentId is actually a taskId for unassigned tasks
        setContextMenu({ x, y, assignmentId, isCompleted: false, isPinned: false, taskId: assignmentId, isUnassigned: true });
      }
    },
    [jobAssignments]
  );

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextMenuRecall = useCallback(() => {
    if (contextMenu && onRecallTask) {
      onRecallTask(contextMenu.assignmentId);
    }
  }, [contextMenu, onRecallTask]);

  const handleContextMenuToggleComplete = useCallback(() => {
    if (contextMenu && onToggleComplete) {
      onToggleComplete(contextMenu.assignmentId);
    }
  }, [contextMenu, onToggleComplete]);

  const handleContextMenuTogglePin = useCallback(() => {
    if (contextMenu && onTogglePin) {
      onTogglePin(contextMenu.assignmentId);
    }
  }, [contextMenu, onTogglePin]);

  const handleContextMenuSplit = useCallback(() => {
    if (contextMenu && contextMenu.taskId && onSplitTask) {
      onSplitTask(contextMenu.taskId, contextMenu.x, contextMenu.y);
    }
  }, [contextMenu, onSplitTask]);

  const handleContextMenuFuse = useCallback(() => {
    if (contextMenu && contextMenu.taskId && onFuseTask) {
      onFuseTask(contextMenu.taskId);
    }
  }, [contextMenu, onFuseTask]);

  // Dependencies: required jobs and dependent jobs
  const requiredJobs = useMemo(() => {
    if (!allJobs || !job?.requiredJobIds || job.requiredJobIds.length === 0) return [];
    return job.requiredJobIds
      .map((id) => allJobs.find((j) => j.id === id))
      .filter((j): j is Job => j !== undefined);
  }, [allJobs, job?.requiredJobIds]);

  const dependentJobs = useMemo(() => {
    if (!allJobs || !job) return [];
    return allJobs.filter(
      (j) => j.requiredJobIds && j.requiredJobIds.includes(job.id)
    );
  }, [allJobs, job?.id]);

  // Don't render if no job selected
  if (!job) {
    return null;
  }

  // Determine if the context menu task is a split task
  const contextMenuTaskObj = contextMenu?.taskId
    ? jobTasks.find((t) => t.id === contextMenu.taskId) as InternalTask | undefined
    : null;
  const isContextMenuSplit = contextMenuTaskObj?.type === 'Internal' && !!contextMenuTaskObj.splitGroupId;

  // REQ-02: Handle departure date click
  const handleDateClick = onDateClick
    ? () => onDateClick(new Date(job.workshopExitDate))
    : undefined;

  return (
    <div className="w-[300px] shrink-0 bg-zinc-900 border-r border-white/5 flex flex-col h-full" data-testid="job-details-panel">
      {/* Header */}
      <div className="px-4 pt-3.5 pb-3 border-b border-white/5 flex flex-col">
        {/* Topline: ref · client + close */}
        <div className="flex items-start justify-between gap-2.5 mb-1.5">
          <div className="flex flex-row items-baseline flex-wrap min-w-0 flex-1">
            <span className="font-mono font-semibold text-[14.5px] text-zinc-50 leading-none">
              {job.reference}
            </span>
            <span className="mx-[7px] text-zinc-600">·</span>
            <span className="text-[12px] text-zinc-400 truncate">
              {job.client}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 -m-1 rounded shrink-0 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
            aria-label="Fermer"
            data-testid="job-details-close-button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description */}
        {job.description && (
          <div className="text-[12.5px] text-zinc-300 truncate mb-2.5">
            {job.description}
          </div>
        )}

        {/* Deadlines encadré: Départ + BAT */}
        <div className="bg-white/[0.02] border border-white/5 rounded-[3px] p-2 flex flex-col gap-1 mb-2.5">
          <div
            className={`flex items-center gap-[7px] text-[12px] text-zinc-200 ${handleDateClick ? 'cursor-pointer hover:text-zinc-50' : ''}`}
            onClick={handleDateClick}
          >
            <Calendar className="w-[13px] h-[13px] text-zinc-500 shrink-0" />
            <span>
              Dep. <strong className="font-semibold text-zinc-50">{formatJobDate(job.workshopExitDate)}</strong>
            </span>
            {job.deadlinePriority !== undefined && job.deadlinePriority !== 2 && (
              <span className={`inline-flex items-center px-1.5 py-px rounded-[3px] text-[10px] font-semibold tracking-wide shrink-0 ${PRIORITY_CHIP_CLASSES[job.deadlinePriority]}`}>
                {PRIORITY_LABELS[job.deadlinePriority]}
              </span>
            )}
          </div>
          {job.batDeadline && (
            <div className="flex items-center gap-[7px] text-[12px] text-zinc-200">
              <CalendarCheck className="w-[11px] h-[11px] text-zinc-500 shrink-0" />
              <span>
                D.L. BAT <strong className="font-semibold text-zinc-50">{formatJobDate(job.batDeadline)}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Dependencies inline */}
        {(requiredJobs.length > 0 || dependentJobs.length > 0) && (
          <div className="flex flex-wrap gap-y-2 gap-x-4 mb-2.5">
            {requiredJobs.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap" data-testid="job-dependencies">
                <span className="text-[10px] uppercase tracking-[0.07em] text-zinc-600 font-medium">Prérequis</span>
                {requiredJobs.map((rj) => (
                  <button
                    key={rj.id}
                    onClick={() => onSelectJob?.(rj.id)}
                    className="inline-flex items-center px-2 py-px rounded-[3px] text-[10.5px] font-mono bg-purple-500/10 border border-purple-500/25 text-purple-300 hover:bg-purple-500/20 transition-colors truncate max-w-[140px]"
                    title={`${rj.reference} - ${rj.client}`}
                  >
                    {rj.reference}
                  </button>
                ))}
              </div>
            )}
            {dependentJobs.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap" data-testid="job-dependents">
                <span className="text-[10px] uppercase tracking-[0.07em] text-zinc-600 font-medium">Requis par</span>
                {dependentJobs.map((dj) => (
                  <button
                    key={dj.id}
                    onClick={() => onSelectJob?.(dj.id)}
                    className="inline-flex items-center px-2 py-px rounded-[3px] text-[10.5px] font-mono bg-purple-500/10 border border-purple-500/25 text-purple-300 hover:bg-purple-500/20 transition-colors truncate max-w-[140px]"
                    title={`${dj.reference} - ${dj.client}`}
                  >
                    {dj.reference}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {onEditJob && (
          <div className="flex gap-1.5">
            <button
              onClick={onEditJob}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium rounded bg-white/[0.04] border border-white/[0.09] text-zinc-200 hover:bg-white/[0.09] hover:text-zinc-50 transition-colors"
              data-testid="job-details-edit-button"
            >
              Modifier
            </button>
          </div>
        )}
      </div>

      {/* Task tiles grouped by element */}
      <TaskList
        tasks={jobTasks}
        elements={jobElements}
        job={job}
        assignments={jobAssignments}
        stations={stations}
        categories={categories}
        providers={providers}
        activeTaskId={activeTaskId}
        conflictTaskIds={conflictTaskIds}
        lateJobIds={lateJobIds}
        shippedJobIds={shippedJobIds}
        onJumpToTask={onJumpToTask}
        onRecallTask={onRecallTask}
        onDepartureChange={onDepartureChange}
        onReturnChange={onReturnChange}
        onToggleComplete={onToggleComplete}
        onToggleOutsourcedDone={onToggleOutsourcedDone}
        onTogglePin={onTogglePin}
        onContextMenu={handleTileContextMenu}
        snapshotOperators={snapshotOperators}
        onJumpToOperatorSlice={onJumpToOperatorSlice}
      />

      {contextMenu && (
        <JobDetailContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isCompleted={contextMenu.isCompleted}
          isPinned={contextMenu.isPinned}
          onTogglePin={handleContextMenuTogglePin}
          onToggleComplete={handleContextMenuToggleComplete}
          onRecall={handleContextMenuRecall}
          onSplit={onSplitTask ? handleContextMenuSplit : undefined}
          onFuse={onFuseTask ? handleContextMenuFuse : undefined}
          isSplit={isContextMenuSplit}
          isUnassigned={contextMenu.isUnassigned}
          onClose={handleContextMenuClose}
        />
      )}
    </div>
  );
}
