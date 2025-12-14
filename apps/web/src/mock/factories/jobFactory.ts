import type { Job, Task, JobStatus } from '../../types';
import { generateJobs } from '../generators/jobs';

export interface JobFactoryOptions {
  count?: number;
  startDate?: Date;
}

export const jobFactory = {
  /**
   * Generate multiple jobs with tasks
   */
  createMany: (options: JobFactoryOptions = {}): Job[] => {
    const { count = 10, startDate = new Date() } = options;
    return generateJobs(count, startDate).map((r) => r.job);
  },

  /**
   * Generate a single job with tasks
   */
  createOne: (startDate: Date = new Date()): Job => {
    return generateJobs(1, startDate)[0].job;
  },

  /**
   * Get jobs filtered by status
   */
  createManyByStatus: (
    status: JobStatus,
    count: number = 5,
    startDate: Date = new Date()
  ): Job[] => {
    // Generate more jobs and filter by status
    const allJobs = generateJobs(count * 5, startDate).map((r) => r.job);
    return allJobs.filter((j) => j.status === status).slice(0, count);
  },

  /**
   * Get all tasks from a set of jobs
   */
  extractTasks: (jobs: Job[]): Task[] => {
    return jobs.flatMap((job) => job.tasks);
  },

  /**
   * Get unassigned tasks from a set of jobs
   */
  extractUnassignedTasks: (jobs: Job[]): Task[] => {
    return jobs
      .flatMap((job) => job.tasks)
      .filter((task) => task.status !== 'Assigned' && task.status !== 'Completed');
  },

  /**
   * Get assigned tasks from a set of jobs
   */
  extractAssignedTasks: (jobs: Job[]): Task[] => {
    return jobs.flatMap((job) => job.tasks).filter((task) => task.status === 'Assigned');
  },
};
