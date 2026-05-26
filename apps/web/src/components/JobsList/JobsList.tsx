import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Job, Task, TaskAssignment, LateJob, ScheduleConflict, Element } from '@flux/types';
import { getDeadlineDate } from '@flux/types';
import { JobsListHeader, type JobTab, type JobChip } from './JobsListHeader';
import { JobCard, type JobProblemType } from './JobCard';
import { getJobIdForTask, groupTasksByJob, createTaskToJobMap } from '../../utils/taskHelpers';
import { expandJobsForDisplay, isAcompteJob, getParentJobId, buildAcompteAssignmentMap } from '../../utils/acompteFanOut';

export interface JobsListProps {
  jobs: Job[];
  tasks: Task[];
  elements: Element[];
  assignments: TaskAssignment[];
  lateJobs: LateJob[];
  conflicts: ScheduleConflict[];
  selectedJobId?: string | null;
  onSelectJob?: (jobId: string | null) => void;
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
}: JobsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<JobTab>('planified');
  const [activeChip, setActiveChip] = useState<JobChip>('all');

  const scrollRef = useRef<HTMLDivElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const [peekPosition, setPeekPosition] = useState<'above' | 'below' | null>(null);

  const expandedJobs = useMemo(() => expandJobsForDisplay(jobs), [jobs]);

  const parentToSyntheticIds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const job of expandedJobs) {
      if (isAcompteJob(job)) {
        const existing = map.get(job._parentJobId) || [];
        existing.push(job.id);
        map.set(job._parentJobId, existing);
      }
    }
    return map;
  }, [expandedJobs]);

  const lateJobIds = useMemo(() => {
    const ids = new Set(lateJobs.map((lj) => lj.jobId));
    for (const parentId of [...ids]) {
      const synthetics = parentToSyntheticIds.get(parentId);
      if (synthetics) synthetics.forEach(id => ids.add(id));
    }
    return ids;
  }, [lateJobs, parentToSyntheticIds]);

  const conflictJobIds = useMemo(() => {
    const ids = new Set<string>();
    conflicts.forEach((c) => {
      if (c.type === 'ApprovalGateConflict' || c.type === 'DeadlineConflict') return;
      const task = tasks.find((t) => t.id === c.taskId);
      if (task) {
        const jobId = getJobIdForTask(task, elements);
        if (jobId) {
          ids.add(jobId);
          const synthetics = parentToSyntheticIds.get(jobId);
          if (synthetics) synthetics.forEach(id => ids.add(id));
        }
      }
    });
    return ids;
  }, [conflicts, tasks, elements, parentToSyntheticIds]);

  const tasksByJob = useMemo(() => groupTasksByJob(tasks, elements), [tasks, elements]);

  const acompteAssignmentMap = useMemo(
    () => buildAcompteAssignmentMap(assignments, jobs),
    [assignments, jobs]
  );

  const assignmentsByJob = useMemo(() => {
    const taskJobMap = createTaskToJobMap(tasks, elements);
    const map = new Map<string, TaskAssignment[]>();
    assignments.forEach((assignment) => {
      const syntheticJobId = acompteAssignmentMap.get(assignment.id);
      const jobId = syntheticJobId ?? taskJobMap.get(assignment.taskId);
      if (jobId) {
        const existing = map.get(jobId) || [];
        existing.push(assignment);
        map.set(jobId, existing);
      }
    });
    return map;
  }, [tasks, elements, assignments, acompteAssignmentMap]);

  const isJobPlanified = useCallback(
    (jobId: string): boolean => (assignmentsByJob.get(jobId)?.length ?? 0) > 0,
    [assignmentsByJob]
  );

  const isJobCompleted = useCallback(
    (jobId: string): boolean => {
      const job = expandedJobs.find(j => j.id === jobId);
      const parentId = job ? getParentJobId(job) : jobId;
      const jobTasks = tasksByJob.get(parentId) ?? [];
      if (jobTasks.length === 0) return false;
      const jobAssignments = assignmentsByJob.get(jobId) ?? [];
      const assignmentByTask = new Map(jobAssignments.map((a) => [a.taskId, a]));
      return jobTasks.every((t) => assignmentByTask.get(t.id)?.isCompleted === true);
    },
    [tasksByJob, assignmentsByJob, expandedJobs]
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
    if (!searchQuery.trim()) return expandedJobs;
    const query = searchQuery.toLowerCase();
    return expandedJobs.filter(
      (job) =>
        job.reference.toLowerCase().includes(query) ||
        job.client.toLowerCase().includes(query) ||
        job.description.toLowerCase().includes(query)
    );
  }, [expandedJobs, searchQuery]);

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

    const deadlineTime = (job: Job): number =>
      job.workshopExitDate ? getDeadlineDate(job.workshopExitDate).getTime() : Infinity;

    return [...list].sort((a, b) => deadlineTime(a) - deadlineTime(b));
  }, [tabJobs, activeChip, lateJobIds, conflictJobIds]);

  const handleTabChange = useCallback((tab: JobTab) => {
    setActiveTab(tab);
    setActiveChip('all');
  }, []);

  const formatDeadline = (dateStr: string): string => {
    if (dateStr.includes('T')) {
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T/);
      if (match) {
        const [, , month, day] = match;
        return `${day}/${month}`;
      }
    }
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
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

  const updatePeek = useCallback(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || !selectedJobId) {
      setPeekPosition(null);
      return;
    }
    const card = scrollEl.querySelector<HTMLElement>(
      `[data-testid="job-card-${selectedJobId}"]`
    );
    if (!card) {
      setPeekPosition(null);
      return;
    }
    const scrollRect = scrollEl.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    // Guard against jsdom/pre-paint where rects are all zero.
    if (scrollRect.height === 0 || cardRect.height === 0) return;

    const peekH = peekRef.current?.offsetHeight ?? 0;
    const effectiveTop = scrollRect.top + (peekPosition === 'above' ? peekH : 0);
    const effectiveBottom = scrollRect.bottom - (peekPosition === 'below' ? peekH : 0);

    if (cardRect.bottom <= effectiveTop + 2) setPeekPosition('above');
    else if (cardRect.top >= effectiveBottom - 2) setPeekPosition('below');
    else setPeekPosition(null);
  }, [selectedJobId, peekPosition]);

  // Attach scroll/resize listeners once via a ref to the latest updatePeek,
  // so changing peekPosition doesn't re-bind the listeners on every tick.
  const updatePeekRef = useRef(updatePeek);
  useEffect(() => {
    updatePeekRef.current = updatePeek;
  }, [updatePeek]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const handler = () => updatePeekRef.current();
    scrollEl.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler);
    return () => {
      scrollEl.removeEventListener('scroll', handler);
      window.removeEventListener('resize', handler);
    };
  }, []);

  const handlePeekClick = useCallback(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || !selectedJobId) return;
    const card = scrollEl.querySelector<HTMLElement>(
      `[data-testid="job-card-${selectedJobId}"]`
    );
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedJobId]);

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

  const getJobCardProps = (job: Job) => {
    const parentId = getParentJobId(job);
    const jobTasks = tasksByJob.get(parentId) || [];
    const jobAssignments = assignmentsByJob.get(job.id) || [];
    return {
      id: job.id,
      reference: job.reference,
      client: job.client,
      description: job.description,
      deadline: job.workshopExitDate ? formatDeadline(job.workshopExitDate) : undefined,
      batDeadline: job.batDeadline ? formatDeadline(job.batDeadline) : undefined,
      problemType: getProblemType(job.id),
      isCompleted: isJobCompleted(job.id),
      isPlanified: isJobPlanified(job.id),
      bufferLabel: computeBufferLabel(job, jobTasks, jobAssignments),
      deadlinePriority: job.deadlinePriority,
    };
  };

  const renderJobCard = (job: Job) => (
    <JobCard
      key={job.id}
      {...getJobCardProps(job)}
      isSelected={selectedJobId === job.id}
      dim={selectedJobId != null && selectedJobId !== job.id}
      onClick={handleJobToggle}
    />
  );

  const selectedJob = useMemo(
    () => expandedJobs.find((j) => j.id === selectedJobId) ?? null,
    [expandedJobs, selectedJobId]
  );

  // Re-check peek position on selection change and whenever the visible list
  // changes (filter/sort/tab). Deferred via rAF so the setState isn't
  // synchronous within the effect body (avoids cascading renders).
  useEffect(() => {
    const id = requestAnimationFrame(() => updatePeekRef.current());
    return () => cancelAnimationFrame(id);
  }, [selectedJobId, visibleJobs]);

  return (
    <aside
      className="w-[270px] shrink-0 bg-zinc-900 flex flex-col border-r border-white/5 h-full"
      data-testid="jobs-list"
    >
      <JobsListHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        tabCounts={{ planified: planifiedJobs.length, unplanified: unplanifiedJobs.length }}
        activeChip={activeChip}
        onChipChange={setActiveChip}
        chipCounts={chipCounts}
      />

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div ref={scrollRef} className="absolute inset-0 overflow-y-auto jobslist-scroll">
          {visibleJobs.length > 0 ? (
            visibleJobs.map(renderJobCard)
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
              {searchQuery ? 'Aucun travail trouvé' : 'Aucun travail dans cette vue'}
            </div>
          )}
        </div>
        {peekPosition && selectedJob && (
          <div
            ref={peekRef}
            data-testid="job-card-peek"
            className={`absolute left-0 right-[6px] z-10 bg-zinc-900 pt-[6px] ${
              peekPosition === 'above'
                ? 'top-0 shadow-[0_6px_12px_-4px_rgba(0,0,0,0.6)] border-b border-white/5'
                : 'bottom-0 shadow-[0_-6px_12px_-4px_rgba(0,0,0,0.6)] border-t border-white/5'
            }`}
          >
            <JobCard
              {...getJobCardProps(selectedJob)}
              isSelected
              dim={false}
              onClick={handlePeekClick}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
