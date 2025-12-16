import type { Job, Task, TaskAssignment, Station } from '@flux/types';
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
    <div className="w-72 shrink-0 bg-zinc-900/50 border-r border-white/5 flex flex-col">
      {/* Job details - simple key-value list */}
      <div className="p-3 border-b border-white/5 space-y-2.5 text-sm">
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
      />
    </div>
  );
}
