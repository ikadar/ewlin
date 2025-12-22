import type { Job, Task, TaskAssignment, Station } from '@flux/types';
import { X } from 'lucide-react';
import { JobInfo } from './JobInfo';
import { JobStatus } from './JobStatus';
import { TaskList } from './TaskList';

export interface JobDetailsPanelProps {
  /** Selected job to display (null if none selected) */
  job: Job | null;
  /** All tasks */
  tasks: Task[];
  /** All assignments */
  assignments: TaskAssignment[];
  /** All stations */
  stations: Station[];
  /** Task ID that is the active placement target in Quick Placement Mode */
  activeTaskId?: string | null;
  /** Callback when a scheduled task is clicked (jump to grid) */
  onJumpToTask?: (assignment: TaskAssignment) => void;
  /** Callback when a scheduled task is double-clicked (recall) */
  onRecallTask?: (assignmentId: string) => void;
  /** Callback when close button is clicked (REQ-02) */
  onClose?: () => void;
}

/**
 * Job Details Panel showing selected job information and task list.
 * Only visible when a job is selected.
 */
export function JobDetailsPanel({
  job,
  tasks,
  assignments,
  stations,
  activeTaskId,
  onJumpToTask,
  onRecallTask,
  onClose,
}: JobDetailsPanelProps) {
  // Don't render if no job selected
  if (!job) {
    return null;
  }

  // Filter tasks for this job
  const jobTasks = tasks.filter((t) => t.jobId === job.id);

  // Filter assignments for this job's tasks
  const jobTaskIds = new Set(jobTasks.map((t) => t.id));
  const jobAssignments = assignments.filter((a) => jobTaskIds.has(a.taskId));

  return (
    <div className="w-72 shrink-0 bg-zinc-900/50 border-r border-white/5 flex flex-col" data-testid="job-details-panel">
      {/* Panel header with close button */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Détails</span>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label="Fermer"
          data-testid="job-details-close-button"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Job details - simple key-value list */}
      <div className="px-3 pb-3 border-b border-white/5 space-y-2.5 text-sm">
        <JobInfo job={job} />

        {/* Separator between info and status */}
        <div className="border-t border-white/5 pt-2.5" />

        <JobStatus job={job} />
      </div>

      {/* Task tiles */}
      <TaskList
        tasks={jobTasks}
        job={job}
        assignments={jobAssignments}
        stations={stations}
        activeTaskId={activeTaskId}
        onJumpToTask={onJumpToTask}
        onRecallTask={onRecallTask}
      />
    </div>
  );
}
