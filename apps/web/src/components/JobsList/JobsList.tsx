import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Job, Task, TaskAssignment, LateJob, ScheduleConflict, Element } from '@flux/types';
import { JobsListHeader, type JobTab, type JobChip } from './JobsListHeader';
import { JobCard, type JobProblemType } from './JobCard';
import { getJobIdForTask, groupTasksByJob, createTaskToJobMap } from '../../utils/taskHelpers';

export interface JobsListProps {
  jobs: Job[];
  tasks: Task[];
  elements: Element[];
  assignments: TaskAssignment[];
  lateJobs: LateJob[];
  conflicts: ScheduleConflict[];
  selectedJobId?: string | null;
  onSelectJob?: (jobId: string | null) => void;
  onAddJob?: () => void;
}

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
  const [activeTab, setActiveTab] = useState<JobTab>('planified');
  const [activeChip, setActiveChip] = useState<JobChip>('all');

  const lateJobIds = useMemo(
    () => new Set(lateJobs.map((lj) => lj.jobId)),
    [lateJobs]
  );

  const conflictJobIds = useMemo(() => {
    const ids = new Set<string>();
    conflicts.forEach((c) => {
      if (c.type === 'ApprovalGateConflict' || c.type === 'DeadlineConflict') return;
      const task = tasks.find((t) => t.id === c.taskId);
      if (task) {
        const jobId = getJobIdForTask(task, elements);
        if (jobId) ids.add(jobId);
      }
    });
    return ids;
  }, [conflicts, tasks, elements]);

  const tasksByJob = useMemo(() => groupTasksByJob(tasks, elements), [tasks, elements]);

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

  const isJobPlanified = useCallback(
    (jobId: string): boolean => (assignmentsByJob.get(jobId)?.length ?? 0) > 0,
    [assignmentsByJob]
  );

  const isJobCompleted = useCallback(
    (jobId: string): boolean => {
      const jobTasks = tasksByJob.get(jobId) ?? [];
      if (jobTasks.length === 0) return false;
      const jobAssignments = assignmentsByJob.get(jobId) ?? [];
      const assignmentByTask = new Map(jobAssignments.map((a) => [a.taskId, a]));
      return jobTasks.every((t) => assignmentByTask.get(t.id)?.isCompleted === true);
    },
    [tasksByJob, assignmentsByJob]
  );

  const getProblemType = useCallback(
    (jobId: string): JobProblemType => {
      if (lateJobIds.has(jobId)) return 'late';
      if (conflictJobIds.has(jobId)) return 'conflict';
      return null;
    },
    [lateJobIds, conflictJobIds]
  );

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

  const { planifiedJobs, unplanifiedJobs } = useMemo(() => {
    const p: Job[] = [];
    const u: Job[] = [];
    filteredJobs.forEach((job) => {
      if (isJobPlanified(job.id)) p.push(job);
      else u.push(job);
    });
    return { planifiedJobs: p, unplanifiedJobs: u };
  }, [filteredJobs, isJobPlanified]);

  const tabJobs = activeTab === 'planified' ? planifiedJobs : unplanifiedJobs;

  const chipCounts = useMemo(
    () => ({
      all: tabJobs.length,
      late: tabJobs.filter((j) => lateJobIds.has(j.id)).length,
      conflict: tabJobs.filter((j) => conflictJobIds.has(j.id)).length,
    }),
    [tabJobs, lateJobIds, conflictJobIds]
  );

  const visibleJobs = useMemo(() => {
    let list = tabJobs;
    if (activeChip === 'late') list = list.filter((j) => lateJobIds.has(j.id));
    else if (activeChip === 'conflict') list = list.filter((j) => conflictJobIds.has(j.id));

    // Flat sort: late → conflict → in-progress (has completed task) → normal → completed
    const rank = (job: Job): number => {
      if (lateJobIds.has(job.id)) return 0;
      if (conflictJobIds.has(job.id)) return 1;
      if (isJobCompleted(job.id)) return 4;
      const jobAssignments = assignmentsByJob.get(job.id) ?? [];
      const hasCompletedTask = jobAssignments.some((a) => a.isCompleted);
      return hasCompletedTask ? 2 : 3;
    };

    return [...list].sort((a, b) => rank(a) - rank(b));
  }, [tabJobs, activeChip, lateJobIds, conflictJobIds, assignmentsByJob, isJobCompleted]);

  const handleTabChange = useCallback((tab: JobTab) => {
    setActiveTab(tab);
    setActiveChip('all');
  }, []);

  const formatDeadline = (dateStr: string): string => {
    if (dateStr.includes('T')) {
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
      if (match) {
        const [, , month, day, hours, minutes] = match;
        return `${day}/${month} ${hours}:${minutes}`;
      }
    }
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month} 14:00`;
  };

  const selectedJobIdRef = useRef(selectedJobId);
  useEffect(() => {
    selectedJobIdRef.current = selectedJobId;
  });

  const handleJobToggle = useCallback(
    (jobId: string) => {
      onSelectJob?.(selectedJobIdRef.current === jobId ? null : jobId);
    },
    [onSelectJob]
  );

  const computeBufferLabel = (
    job: Job,
    jobTasks: Task[],
    jobAssignments: TaskAssignment[]
  ): string | undefined => {
    if (jobTasks.length === 0 || jobAssignments.length === 0 || !job.workshopExitDate) return undefined;
    const assignedTaskIds = new Set(jobAssignments.map((a) => a.taskId));
    const allTasksAssigned = jobTasks.every((t) => assignedTaskIds.has(t.id));
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
        isCompleted={isJobCompleted(job.id)}
        bufferLabel={computeBufferLabel(job, jobTasks, jobAssignments)}
        isSelected={selectedJobId === job.id}
        onClick={handleJobToggle}
      />
    );
  };

  return (
    <aside
      className="w-72 shrink-0 bg-zinc-900 flex flex-col border-r border-white/5 h-full"
      data-testid="jobs-list"
    >
      <JobsListHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddJob={onAddJob}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        tabCounts={{ planified: planifiedJobs.length, unplanified: unplanifiedJobs.length }}
        activeChip={activeChip}
        onChipChange={setActiveChip}
        chipCounts={chipCounts}
      />

      <div className="flex-1 overflow-y-auto jobslist-scroll">
        {visibleJobs.length > 0 ? (
          visibleJobs.map(renderJobCard)
        ) : (
          <div className="px-3 py-8 text-center text-zinc-500 text-sm">
            {searchQuery ? 'Aucun travail trouvé' : 'Aucun travail dans cette vue'}
          </div>
        )}
      </div>
    </aside>
  );
}
