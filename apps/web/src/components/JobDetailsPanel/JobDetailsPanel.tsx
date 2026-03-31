import { useState, useCallback, useMemo } from 'react';
import type { Job, Task, TaskAssignment, Station, StationCategory, Element, PaperStatus, BatStatus, PlateStatus, FormeStatus, OutsourcedProvider, InternalTask } from '@flux/types';
import { X } from 'lucide-react';
import { TaskList } from './TaskList';
import { JobDetailContextMenu } from './JobDetailContextMenu';
import { getTasksForJob } from '../../utils/taskHelpers';

/** Payload for element prerequisite status updates */
export interface ElementStatusUpdate {
  elementId: string;
  field: 'paperStatus' | 'batStatus' | 'plateStatus' | 'formeStatus';
  value: PaperStatus | BatStatus | PlateStatus | FormeStatus;
}

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
  /** Task ID that is currently picked (v0.3.54 Pick & Place) */
  pickedTaskId?: string | null;
  /** Callback when a scheduled task is clicked (jump to grid) */
  onJumpToTask?: (assignment: TaskAssignment) => void;
  /** Callback when a scheduled task is double-clicked (recall) */
  onRecallTask?: (assignmentId: string) => void;
  /** Callback when an unscheduled task is clicked (pick for placement) - v0.3.54 */
  onPick?: (task: Task, job: Job, clientX: number, clientY: number) => void;
  /** Callback when close button is clicked (REQ-02) */
  onClose?: () => void;
  /** REQ-02: Callback when departure date is clicked (scrolls grid to date) */
  onDateClick?: (date: Date) => void;
  /** Callback when element prerequisite status changes (v0.4.32a) */
  onElementStatusChange?: (update: ElementStatusUpdate) => void;
  /** v0.5.11: Callback when work days changes for outsourced task */
  onWorkDaysChange?: (taskId: string, workDays: number) => void;
  /** v0.5.11: Callback when manual departure changes for outsourced task */
  onDepartureChange?: (taskId: string, departure: Date | undefined) => void;
  /** v0.5.11: Callback when manual return changes for outsourced task */
  onReturnChange?: (taskId: string, returnDate: Date | undefined) => void;
  /** Callback when completion icon is clicked (assignmentId) */
  onToggleComplete?: (assignmentId: string) => void;
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
}

/** Format workshop exit date as DD/MM/YYYY a HHhMM */
function formatDepartureDate(dateStr: string): string {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (match) {
    const [, , month, day, hours, minutes] = match;
    const year = match[1];
    return `Dep. ${day}/${month}/${year} a ${hours}h${minutes}`;
  }
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `Dep. ${day}/${month}/${year} a ${hours}h${minutes}`;
}

/** Format BAT deadline as DD/MM/YYYY a HHhMM */
function formatBatDeadline(dateStr: string): string {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (match) {
    const [, , month, day, hours, minutes] = match;
    const year = match[1];
    return `D.L. BAT ${day}/${month}/${year} a ${hours}h${minutes}`;
  }
  return `D.L. BAT ${dateStr}`;
}

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
  pickedTaskId,
  conflictTaskIds,
  onJumpToTask,
  onRecallTask,
  onPick,
  onClose,
  onDateClick,
  onElementStatusChange,
  onToggleComplete,
  onWorkDaysChange,
  onDepartureChange,
  onReturnChange,
  onEditJob,
  lateJobIds,
  shippedJobIds,
  onSplitTask,
  onFuseTask,
  allJobs,
  onSelectJob,
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
    taskId?: string;
    isUnassigned?: boolean;
  } | null>(null);

  const handleTileContextMenu = useCallback(
    (x: number, y: number, assignmentId: string, isCompleted: boolean) => {
      // Check if this is an unassigned task (assignmentId is actually a taskId)
      const isAssignment = jobAssignments.some((a) => a.id === assignmentId);
      if (isAssignment) {
        const assignment = jobAssignments.find((a) => a.id === assignmentId);
        setContextMenu({ x, y, assignmentId, isCompleted, taskId: assignment?.taskId });
      } else {
        // assignmentId is actually a taskId for unassigned tasks
        setContextMenu({ x, y, assignmentId, isCompleted: false, taskId: assignmentId, isUnassigned: true });
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
    <div className="w-80 shrink-0 bg-zinc-900 border-r border-white/5 flex flex-col" data-testid="job-details-panel">
      {/* Compact info header */}
      <div className="px-3 pt-3 pb-3 border-b border-white/5 space-y-1">
        {/* Line 1: reference - client + close button */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-200 truncate min-w-0">
            {job.reference} &ndash; {job.client}
          </span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 ml-2"
            aria-label="Fermer"
            data-testid="job-details-close-button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Line 2: description */}
        <div className="text-xs text-zinc-400 truncate">{job.description}</div>

        {/* Line 3: departure date */}
        <div
          className={`text-xs text-zinc-400 ${handleDateClick ? 'cursor-pointer hover:text-zinc-200' : ''}`}
          onClick={handleDateClick}
        >
          {formatDepartureDate(job.workshopExitDate)}
        </div>

        {/* Line 3b: BAT deadline (if set) */}
        {job.batDeadline && (
          <div className="text-xs text-zinc-400">
            {formatBatDeadline(job.batDeadline)}
          </div>
        )}

        {/* Line 4: Modifier button */}
        {onEditJob && (
          <div className="pt-1">
            <button
              onClick={onEditJob}
              className="bg-white/[0.06] border border-white/[0.08] rounded px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
              data-testid="job-details-edit-button"
            >
              Modifier
            </button>
          </div>
        )}

        {/* Dependencies section */}
        {requiredJobs.length > 0 && (
          <div className="pt-1.5" data-testid="job-dependencies">
            <div className="text-xs text-zinc-500 mb-1">Prérequis:</div>
            <div className="flex flex-wrap gap-1">
              {requiredJobs.map((rj) => (
                <button
                  key={rj.id}
                  onClick={() => onSelectJob?.(rj.id)}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-purple-900/30 border border-purple-700/30 text-purple-300 hover:bg-purple-900/50 transition-colors truncate max-w-[140px]"
                  title={`${rj.reference} - ${rj.client}`}
                >
                  {rj.reference}
                </button>
              ))}
            </div>
          </div>
        )}
        {dependentJobs.length > 0 && (
          <div className="pt-1" data-testid="job-dependents">
            <div className="text-xs text-zinc-500">
              Requis par: {dependentJobs.map((j) => j.reference).join(', ')}
            </div>
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
        pickedTaskId={pickedTaskId}
        conflictTaskIds={conflictTaskIds}
        lateJobIds={lateJobIds}
        shippedJobIds={shippedJobIds}
        onJumpToTask={onJumpToTask}
        onRecallTask={onRecallTask}
        onPick={onPick}
        onElementStatusChange={onElementStatusChange}
        onWorkDaysChange={onWorkDaysChange}
        onDepartureChange={onDepartureChange}
        onReturnChange={onReturnChange}
        onToggleComplete={onToggleComplete}
        onContextMenu={handleTileContextMenu}
      />

      {contextMenu && (
        <JobDetailContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isCompleted={contextMenu.isCompleted}
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
