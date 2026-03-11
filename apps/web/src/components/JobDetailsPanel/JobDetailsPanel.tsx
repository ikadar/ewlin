import type { Job, Task, TaskAssignment, Station, StationCategory, Element, PaperStatus, BatStatus, PlateStatus, FormeStatus, OutsourcedProvider } from '@flux/types';
import type { SplitConfig } from '../../utils/splitTransform';
import { X } from 'lucide-react';
import { TaskList } from './TaskList';
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
  /** Split configurations for expanding split tasks into sub-rows */
  splitConfigs?: Map<string, SplitConfig>;
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
  splitConfigs,
}: JobDetailsPanelProps) {
  // Don't render if no job selected
  if (!job) {
    return null;
  }

  // Filter tasks for this job
  const jobTasks = getTasksForJob(job.id, tasks, elements);

  // Filter elements for this job
  const jobElements = elements.filter((e) => job.elementIds.includes(e.id));

  // Filter assignments for this job's tasks
  const jobTaskIds = new Set(jobTasks.map((t) => t.id));
  const jobAssignments = assignments.filter((a) => jobTaskIds.has(a.taskId));

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
        onJumpToTask={onJumpToTask}
        onRecallTask={onRecallTask}
        onPick={onPick}
        onElementStatusChange={onElementStatusChange}
        onWorkDaysChange={onWorkDaysChange}
        onDepartureChange={onDepartureChange}
        onReturnChange={onReturnChange}
        onToggleComplete={onToggleComplete}
        splitConfigs={splitConfigs}
      />
    </div>
  );
}
