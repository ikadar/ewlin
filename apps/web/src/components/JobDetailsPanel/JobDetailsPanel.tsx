import type { Job, Task, TaskAssignment, Station, StationCategory, Element, PaperStatus, BatStatus, PlateStatus, FormeStatus, OutsourcedProvider } from '@flux/types';
import { X, Pencil } from 'lucide-react';
import { JobInfo } from './JobInfo';
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
  /** v0.5.13b: Callback when edit button is clicked */
  onEditJob?: () => void;
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
  onJumpToTask,
  onRecallTask,
  onPick,
  onClose,
  onDateClick,
  onElementStatusChange,
  onWorkDaysChange,
  onDepartureChange,
  onReturnChange,
  onEditJob,
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

  return (
    <div className="w-72 shrink-0 bg-zinc-900/50 border-r border-white/5 flex flex-col" data-testid="job-details-panel">
      {/* Panel header with edit and close buttons */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Détails</span>
        <div className="flex items-center gap-1">
          {onEditJob && (
            <button
              onClick={onEditJob}
              className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
              aria-label="Modifier le job"
              data-testid="job-details-edit-button"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Modifier</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Fermer"
            data-testid="job-details-close-button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Job details - simple key-value list */}
      <div className="px-3 pb-3 border-b border-white/5 space-y-2.5 text-sm">
        <JobInfo job={job} onDateClick={onDateClick} />
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
        onJumpToTask={onJumpToTask}
        onRecallTask={onRecallTask}
        onPick={onPick}
        onElementStatusChange={onElementStatusChange}
        onWorkDaysChange={onWorkDaysChange}
        onDepartureChange={onDepartureChange}
        onReturnChange={onReturnChange}
      />
    </div>
  );
}
