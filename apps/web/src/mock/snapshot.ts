/**
 * Snapshot Cache
 * Creates and caches the complete ScheduleSnapshot for the application.
 */

import type { ScheduleSnapshot } from '@flux/types';
import {
  generateAllStationData,
  generateJobs,
  generateAllAssignmentData,
  identifyLateJobs,
} from './generators';
import { getFixtureFromUrl, shouldUseFixture } from './testFixtures';
import { shouldUseScenario, createScenarioSnapshot } from './scenarios';

// ============================================================================
// Snapshot Creation
// ============================================================================

export interface SnapshotOptions {
  jobCount?: number;
  lateJobCount?: number;
  conflictJobCount?: number;
  /** Force all tasks to be assigned (fully scheduled jobs) */
  allTasksAssigned?: boolean;
}

export function createSnapshot(options: SnapshotOptions = {}): ScheduleSnapshot {
  const { jobCount = 500, lateJobCount = 2, conflictJobCount = 1, allTasksAssigned = false } = options;

  // Generate station data
  const stationData = generateAllStationData();

  // Generate jobs and tasks
  const jobData = generateJobs({
    count: jobCount,
    includeLateJobs: lateJobCount,
    includeConflictJobs: conflictJobCount,
    allTasksAssigned,
  });

  // Generate assignments and conflicts
  const assignmentData = generateAllAssignmentData(
    jobData.tasks,
    jobData.jobs,
    stationData.stations
  );

  // Identify late jobs
  const lateJobs = identifyLateJobs(jobData.jobs, jobData.tasks);

  // Create the snapshot
  const snapshot: ScheduleSnapshot = {
    version: 1,
    generatedAt: new Date().toISOString(),
    stations: stationData.stations,
    categories: stationData.categories,
    groups: stationData.groups,
    providers: stationData.providers,
    jobs: jobData.jobs,
    elements: jobData.elements,
    tasks: jobData.tasks,
    assignments: assignmentData.assignments,
    conflicts: assignmentData.conflicts,
    lateJobs,
  };

  return snapshot;
}

// ============================================================================
// Snapshot Cache
// ============================================================================

let cachedSnapshot: ScheduleSnapshot | null = null;
let cacheOptions: SnapshotOptions = {};

/**
 * Get the cached snapshot or create a new one.
 * @param options - Options for snapshot creation (only used if creating new)
 * @returns The cached or newly created snapshot
 */
export function getSnapshot(options?: SnapshotOptions): ScheduleSnapshot {
  // Check for test scenario mode (URL parameter ?scenario=<name>)
  if (shouldUseScenario()) {
    if (!cachedSnapshot) {
      cachedSnapshot = createScenarioSnapshot();
    }
    if (cachedSnapshot) {
      return cachedSnapshot;
    }
  }

  // Check for test fixture mode (URL parameter ?fixture=<name>)
  if (shouldUseFixture()) {
    if (!cachedSnapshot) {
      cachedSnapshot = getFixtureFromUrl();
    }
    if (cachedSnapshot) {
      return cachedSnapshot;
    }
  }

  // Check for URL parameters
  const urlOptions = getOptionsFromUrl();
  const mergedOptions = { ...cacheOptions, ...options, ...urlOptions };

  // If options changed, invalidate cache
  if (JSON.stringify(mergedOptions) !== JSON.stringify(cacheOptions)) {
    cachedSnapshot = null;
    cacheOptions = mergedOptions;
  }

  if (!cachedSnapshot) {
    cachedSnapshot = createSnapshot(cacheOptions);
  }

  return cachedSnapshot;
}

/**
 * Parse snapshot options from URL parameters.
 * Supports: ?allAssigned=true, ?jobCount=100
 */
function getOptionsFromUrl(): Partial<SnapshotOptions> {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const options: Partial<SnapshotOptions> = {};

  if (params.get('allAssigned') === 'true') {
    options.allTasksAssigned = true;
  }

  const jobCount = params.get('jobCount');
  if (jobCount) {
    const count = parseInt(jobCount, 10);
    if (!isNaN(count) && count > 0) {
      options.jobCount = count;
    }
  }

  return options;
}

/**
 * Invalidate the cached snapshot.
 * Next call to getSnapshot will create a fresh snapshot.
 */
export function invalidateSnapshot(): void {
  cachedSnapshot = null;
}

/**
 * Update the cached snapshot with new data.
 * Useful for optimistic updates.
 * @param updater - Function that receives the current snapshot and returns updated snapshot
 */
export function updateSnapshot(
  updater: (snapshot: ScheduleSnapshot) => ScheduleSnapshot
): ScheduleSnapshot {
  const current = getSnapshot();
  cachedSnapshot = updater(current);
  cachedSnapshot.version += 1;
  cachedSnapshot.generatedAt = new Date().toISOString();
  return cachedSnapshot;
}

// ============================================================================
// Snapshot Utilities
// ============================================================================

/**
 * Get a job by ID from the snapshot.
 */
export function getJobById(jobId: string): ReturnType<typeof getSnapshot>['jobs'][number] | undefined {
  return getSnapshot().jobs.find((job) => job.id === jobId);
}

/**
 * Get tasks for a specific job.
 */
export function getTasksForJob(jobId: string): ReturnType<typeof getSnapshot>['tasks'] {
  return getSnapshot().tasks.filter((task) => task.jobId === jobId);
}

/**
 * Get assignment for a specific task.
 */
export function getAssignmentForTask(
  taskId: string
): ReturnType<typeof getSnapshot>['assignments'][number] | undefined {
  return getSnapshot().assignments.find((assignment) => assignment.taskId === taskId);
}

/**
 * Get station by ID.
 */
export function getStationById(
  stationId: string
): ReturnType<typeof getSnapshot>['stations'][number] | undefined {
  return getSnapshot().stations.find((station) => station.id === stationId);
}

/**
 * Get provider by ID.
 */
export function getProviderById(
  providerId: string
): ReturnType<typeof getSnapshot>['providers'][number] | undefined {
  return getSnapshot().providers.find((provider) => provider.id === providerId);
}
