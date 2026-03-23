import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Job, Task, TaskAssignment, LateJob, ScheduleConflict, Element } from '@flux/types';
import { JobsListHeader } from './JobsListHeader';
import { ProblemsSection } from './ProblemsSection';
import { JobsSection } from './JobsSection';
import { JobCard, type JobProblemType } from './JobCard';
import { getJobIdForTask, groupTasksByJob, createTaskToJobMap } from '../../utils/taskHelpers';

export interface JobsListProps {
  /** All jobs */
  jobs: Job[];
  /** All tasks */
  tasks: Task[];
  /** All elements */
  elements: Element[];
  /** All assignments */
  assignments: TaskAssignment[];
  /** Late jobs */
  lateJobs: LateJob[];
  /** Schedule conflicts */
  conflicts: ScheduleConflict[];
  /** Currently selected job ID */
  selectedJobId?: string | null;
  /** Job selection handler (null to deselect - REQ-03 toggle) */
  onSelectJob?: (jobId: string | null) => void;
  /** Add job handler (opens JCF modal) */
  onAddJob?: () => void;
}

/**
 * Jobs List component showing all jobs with problems section at top.
 */
export function JobsList({
  jobs,
  tasks,
  elements,
  assignments,
  lateJobs,
  conflicts,
  selectedJobId,
  onSelectJob,
  onAddJob,
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
      if (task) {
        const jobId = getJobIdForTask(task, elements);
        if (jobId) ids.add(jobId);
      }
    });
    return ids;
  }, [conflicts, tasks, elements]);

  // Group tasks by job ID using elements
  const tasksByJob = useMemo(() => {
    return groupTasksByJob(tasks, elements);
  }, [tasks, elements]);

  // Group assignments by job ID (via tasks and elements)
  const assignmentsByJob = useMemo(() => {
    const taskJobMap = createTaskToJobMap(tasks, elements);

    const map = new Map<string, TaskAssignment[]>();
    assignments.forEach((assignment) => {
      const jobId = taskJobMap.get(assignment.taskId);
      if (jobId) {
        const existing = map.get(jobId) || [];
        existing.push(assignment);
        map.set(jobId, existing);
      }
    });
    return map;
  }, [tasks, elements, assignments]);

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

    // Sort normal jobs: not fully scheduled first
    normal.sort((a, b) => {
      if (!a.fullyScheduled && b.fullyScheduled) return -1;
      if (a.fullyScheduled && !b.fullyScheduled) return 1;
      return 0;
    });

    return { problemJobs: problems, normalJobs: normal, getProblemType: getType };
  }, [filteredJobs, lateJobIds, conflictJobIds]);

  // Format date as DD/MM HH:mm
  const formatDeadline = (dateStr: string): string => {
    if (dateStr.includes('T')) {
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
      if (match) {
        const [, , month, day, hours, minutes] = match;
        return `${day}/${month} ${hours}:${minutes}`;
      }
    }
    // Date-only fallback
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month} 14:00`;
  };

  // Step 2a: Stable toggle callback using ref to avoid inline closures per card
  const selectedJobIdRef = useRef(selectedJobId);
  useEffect(() => { selectedJobIdRef.current = selectedJobId; });

  const handleJobToggle = useCallback((jobId: string) => {
    onSelectJob?.(selectedJobIdRef.current === jobId ? null : jobId);
  }, [onSelectJob]);

  const computeBufferLabel = (job: Job, jobTasks: Task[], jobAssignments: TaskAssignment[]): string | undefined => {
    if (jobTasks.length === 0 || jobAssignments.length === 0 || !job.workshopExitDate) return undefined;
    // Consider fully scheduled when every task has at least one assignment
    const assignedTaskIds = new Set(jobAssignments.map(a => a.taskId));
    const allTasksAssigned = jobTasks.every(t => assignedTaskIds.has(t.id));
    if (!allTasksAssigned) return undefined;

    const lastEnd = jobAssignments.reduce((max, a) => {
      const end = new Date(a.scheduledEnd).getTime();
      return end > max ? end : max;
    }, 0);

    const deadline = new Date(job.workshopExitDate).getTime();
    const diffMs = deadline - lastEnd;
    const sign = diffMs >= 0 ? '+' : '-';
    const absDiffMs = Math.abs(diffMs);
    const totalHours = Math.floor(absDiffMs / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;

    if (days > 0) return `${sign}${days}j ${hours}h`;
    return `${sign}${hours}h`;
  };

  const renderJobCard = (job: Job) => {
    const jobTasks = tasksByJob.get(job.id) || [];
    const jobAssignments = assignmentsByJob.get(job.id) || [];

    return (
      <JobCard
        key={job.id}
        id={job.id}
        reference={job.reference}
        client={job.client}
        description={job.description}
        tasks={jobTasks}
        assignments={jobAssignments}
        deadline={job.workshopExitDate ? formatDeadline(job.workshopExitDate) : undefined}
        problemType={getProblemType(job.id)}
        bufferLabel={computeBufferLabel(job, jobTasks, jobAssignments)}
        isSelected={selectedJobId === job.id}
        onClick={handleJobToggle}
      />
    );
  };

  return (
    <aside className="w-72 shrink-0 bg-zinc-900 flex flex-col border-r border-white/5 h-full" data-testid="jobs-list">
      <JobsListHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddJob={onAddJob}
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
