import type { Assignment, Job, Station, OutsourcedProvider } from '../../types';
import { generateAssignments } from '../generators/assignments';
import { generateStations, generateProviders } from '../generators/stations';
import { generateJobs } from '../generators/jobs';

export interface AssignmentFactoryOptions {
  jobs?: Job[];
  stations?: Station[];
  providers?: OutsourcedProvider[];
  startDate?: Date;
}

export const assignmentFactory = {
  /**
   * Generate assignments for given jobs (or default jobs)
   */
  createMany: (options: AssignmentFactoryOptions = {}): Assignment[] => {
    const {
      jobs = generateJobs(10).map((r) => r.job),
      stations = generateStations(),
      providers = generateProviders(),
      startDate = new Date(),
    } = options;

    return generateAssignments({ jobs, stations, providers, startDate });
  },

  /**
   * Generate a consistent set of jobs and their assignments
   */
  createWithJobs: (
    jobCount: number = 10,
    startDate: Date = new Date()
  ): { jobs: Job[]; assignments: Assignment[] } => {
    const jobs = generateJobs(jobCount, startDate).map((r) => r.job);
    const stations = generateStations();
    const providers = generateProviders();
    const assignments = generateAssignments({ jobs, stations, providers, startDate });

    return { jobs, assignments };
  },

  /**
   * Get assignments for a specific job
   */
  filterByJob: (assignments: Assignment[], jobId: string): Assignment[] => {
    return assignments.filter((a) => a.jobId === jobId);
  },

  /**
   * Get assignments for a specific station
   */
  filterByStation: (assignments: Assignment[], stationId: string): Assignment[] => {
    return assignments.filter((a) => a.stationId === stationId);
  },

  /**
   * Get assignments within a date range
   */
  filterByDateRange: (
    assignments: Assignment[],
    start: Date,
    end: Date
  ): Assignment[] => {
    return assignments.filter((a) => {
      const assignmentStart = new Date(a.scheduledStart);
      const assignmentEnd = new Date(a.scheduledEnd);
      return assignmentStart >= start && assignmentEnd <= end;
    });
  },
};
