import { useState, useMemo } from 'react';
import type { Job, Task, LateJob, ScheduleConflict } from '@flux/types';
import { JobsListHeader } from './JobsListHeader';
import { ProblemsSection } from './ProblemsSection';
import { JobsSection } from './JobsSection';
import { JobCard, type JobProblemType } from './JobCard';

export interface JobsListProps {
  /** All jobs */
  jobs: Job[];
  /** All tasks */
  tasks: Task[];
  /** Late jobs */
  lateJobs: LateJob[];
  /** Schedule conflicts */
  conflicts: ScheduleConflict[];
  /** Currently selected job ID */
  selectedJobId?: string | null;
  /** Job selection handler */
  onSelectJob?: (jobId: string) => void;
}

/**
 * Jobs List component showing all jobs with problems section at top.
 */
export function JobsList({
  jobs,
  tasks,
  lateJobs,
  conflicts,
  selectedJobId,
  onSelectJob,
}: JobsListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Create sets for quick lookup
  const lateJobIds = useMemo(
    () => new Set(lateJobs.map((lj) => lj.jobId)),
    [lateJobs]
  );

  const conflictJobIds = useMemo(() => {
    const ids = new Set<string>();
    conflicts.forEach((c) => {
      // Get job IDs from tasks involved in conflicts
      const task = tasks.find((t) => t.id === c.taskId);
      if (task) ids.add(task.jobId);
    });
    return ids;
  }, [conflicts, tasks]);

  // Calculate task counts per job
  const taskCountsByJob = useMemo(() => {
    const counts = new Map<string, { total: number; completed: number }>();
    jobs.forEach((job) => {
      const jobTasks = tasks.filter((t) => t.jobId === job.id);
      counts.set(job.id, {
        total: jobTasks.length,
        completed: jobTasks.filter((t) => t.status === 'Completed').length,
      });
    });
    return counts;
  }, [jobs, tasks]);

  // Filter jobs by search query
  const filteredJobs = useMemo(() => {
    if (!searchQuery.trim()) return jobs;
    const query = searchQuery.toLowerCase();
    return jobs.filter(
      (job) =>
        job.reference.toLowerCase().includes(query) ||
        job.client.toLowerCase().includes(query) ||
        job.description.toLowerCase().includes(query)
    );
  }, [jobs, searchQuery]);

  // Separate problem jobs from normal jobs
  const { problemJobs, normalJobs, getProblemType } = useMemo(() => {
    // Determine problem type for a job
    const getType = (jobId: string): JobProblemType => {
      if (lateJobIds.has(jobId)) return 'late';
      if (conflictJobIds.has(jobId)) return 'conflict';
      return null;
    };

    const problems: Job[] = [];
    const normal: Job[] = [];

    filteredJobs.forEach((job) => {
      const problemType = getType(job.id);
      if (problemType) {
        problems.push(job);
      } else {
        normal.push(job);
      }
    });

    // Sort problems: late first, then conflicts
    problems.sort((a, b) => {
      const aType = getType(a.id);
      const bType = getType(b.id);
      if (aType === 'late' && bType !== 'late') return -1;
      if (aType !== 'late' && bType === 'late') return 1;
      return 0;
    });

    return { problemJobs: problems, normalJobs: normal, getProblemType: getType };
  }, [filteredJobs, lateJobIds, conflictJobIds]);

  // Format date as DD/MM
  const formatDeadline = (dateStr: string): string => {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  };

  const renderJobCard = (job: Job) => {
    const counts = taskCountsByJob.get(job.id) || { total: 0, completed: 0 };
    return (
      <JobCard
        key={job.id}
        id={job.id}
        reference={job.reference}
        client={job.client}
        description={job.description}
        taskCount={counts.total}
        completedTaskCount={counts.completed}
        deadline={job.workshopExitDate ? formatDeadline(job.workshopExitDate) : undefined}
        problemType={getProblemType(job.id)}
        isSelected={selectedJobId === job.id}
        onClick={() => onSelectJob?.(job.id)}
      />
    );
  };

  return (
    <aside className="w-72 shrink-0 bg-zinc-900/30 flex flex-col border-r border-white/5" data-testid="jobs-list">
      <JobsListHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Problems section */}
        <ProblemsSection count={problemJobs.length}>
          {problemJobs.map(renderJobCard)}
        </ProblemsSection>

        {/* Jobs section */}
        <JobsSection>{normalJobs.map(renderJobCard)}</JobsSection>

        {/* Empty state */}
        {filteredJobs.length === 0 && (
          <div className="px-3 py-8 text-center text-zinc-500 text-sm">
            {searchQuery ? 'Aucun travail trouvé' : 'Aucun travail'}
          </div>
        )}
      </div>
    </aside>
  );
}
