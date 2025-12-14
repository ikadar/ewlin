import type { ScheduleSnapshot, LateJob, ScheduleConflict } from '../../types';
import {
  generateStations,
  generateCategories,
  generateAllGroups,
  generateProviders,
} from '../generators/stations';
import { generateJobs } from '../generators/jobs';
import { generateAssignments } from '../generators/assignments';

export interface SnapshotFactoryOptions {
  jobCount?: number;
  startDate?: Date;
  includeConflicts?: boolean;
  includeLateJobs?: boolean;
}

export const snapshotFactory = {
  /**
   * Create a complete ScheduleSnapshot for testing/Storybook
   */
  create: (options: SnapshotFactoryOptions = {}): ScheduleSnapshot => {
    const {
      jobCount = 10,
      startDate = new Date(),
      includeConflicts = false,
      includeLateJobs = false,
    } = options;

    const stations = generateStations();
    const providers = generateProviders();
    const categories = generateCategories();
    const groups = generateAllGroups();
    const jobs = generateJobs(jobCount, startDate).map((r) => r.job);
    const assignments = generateAssignments({
      jobs,
      stations,
      providers,
      startDate,
    });

    const conflicts: ScheduleConflict[] = includeConflicts
      ? generateConflicts(jobs, assignments)
      : [];

    const lateJobs: LateJob[] = includeLateJobs ? generateLateJobs(jobs) : [];

    return {
      snapshotVersion: 1,
      generatedAt: new Date().toISOString(),
      stations,
      providers,
      categories,
      groups,
      jobs,
      assignments,
      conflicts,
      lateJobs,
    };
  },

  /**
   * Create an empty snapshot (for initial state)
   */
  createEmpty: (): ScheduleSnapshot => {
    return {
      snapshotVersion: 1,
      generatedAt: new Date().toISOString(),
      stations: generateStations(),
      providers: generateProviders(),
      categories: generateCategories(),
      groups: generateAllGroups(),
      jobs: [],
      assignments: [],
      conflicts: [],
      lateJobs: [],
    };
  },

  /**
   * Create a minimal snapshot (for simple tests)
   */
  createMinimal: (): ScheduleSnapshot => {
    const stations = generateStations().slice(0, 3);
    const providers = generateProviders().slice(0, 1);
    const categories = generateCategories().slice(0, 2);
    const groups = generateAllGroups().slice(0, 2);
    const jobs = generateJobs(2).map((r) => r.job);
    const assignments = generateAssignments({
      jobs,
      stations,
      providers,
      startDate: new Date(),
    });

    return {
      snapshotVersion: 1,
      generatedAt: new Date().toISOString(),
      stations,
      providers,
      categories,
      groups,
      jobs,
      assignments,
      conflicts: [],
      lateJobs: [],
    };
  },
};

// Helper to generate mock conflicts
function generateConflicts(
  jobs: ReturnType<typeof generateJobs>[0]['job'][],
  assignments: ReturnType<typeof generateAssignments>
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  // Generate a few sample conflicts for testing
  if (assignments.length >= 2) {
    conflicts.push({
      type: 'StationConflict',
      affectedTaskIds: [assignments[0].taskId, assignments[1].taskId],
      description:
        'Tasks overlap on the same station between 10:00 and 11:00',
      severity: 'High',
    });
  }

  if (jobs.length >= 1 && jobs[0].tasks.length >= 2) {
    conflicts.push({
      type: 'PrecedenceConflict',
      affectedTaskIds: [jobs[0].tasks[0].id, jobs[0].tasks[1].id],
      description: 'Task 2 is scheduled before Task 1 completes',
      severity: 'High',
    });
  }

  return conflicts;
}

// Helper to generate mock late jobs
function generateLateJobs(
  jobs: ReturnType<typeof generateJobs>[0]['job'][]
): LateJob[] {
  const lateJobs: LateJob[] = [];

  // Find jobs that might be delayed
  const delayedJobs = jobs.filter(
    (j) => j.status === 'Delayed' || j.status === 'InProgress'
  );

  for (const job of delayedJobs.slice(0, 3)) {
    const deadlineDate = new Date(job.workshopExitDate);
    const expectedCompletion = new Date(
      deadlineDate.getTime() + Math.random() * 48 * 60 * 60 * 1000
    );

    lateJobs.push({
      jobId: job.id,
      reference: job.reference,
      workshopExitDate: job.workshopExitDate,
      expectedCompletion: expectedCompletion.toISOString(),
      delayHours: Math.ceil(Math.random() * 48),
    });
  }

  return lateJobs;
}
