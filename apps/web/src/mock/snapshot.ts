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
import { getTasksForJob as getTasksForJobHelper } from '../utils/taskHelpers';
import { updateSnapshotConflicts } from '../utils/conflictRecalculation';

// ============================================================================
// Snapshot Creation
// ============================================================================

export interface SnapshotOptions {
  jobCount?: number;
  lateJobCount?: number;
  conflictJobCount?: number;
}

export function createSnapshot(options: SnapshotOptions = {}): ScheduleSnapshot {
  const { jobCount = 15, lateJobCount = 2, conflictJobCount = 1 } = options;

  // Generate station data
  const stationData = generateAllStationData();

  // Generate jobs and tasks
  const jobData = generateJobs({
    count: jobCount,
    includeLateJobs: lateJobCount,
    includeConflictJobs: conflictJobCount,
  });

  // Generate assignments and conflicts
  const assignmentData = generateAllAssignmentData(
    jobData.tasks,
    jobData.jobs,
    jobData.elements,
    stationData.stations
  );

  // Identify late jobs (including tasks scheduled past deadline)
  const lateJobs = identifyLateJobs(jobData.jobs, jobData.tasks, assignmentData.assignments);

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
  // Check for test fixture mode (URL parameter ?fixture=<name>)
  if (shouldUseFixture()) {
    if (!cachedSnapshot) {
      cachedSnapshot = getFixtureFromUrl();
    }
    if (cachedSnapshot) {
      return cachedSnapshot;
    }
  }

  // If options changed, invalidate cache
  if (options && JSON.stringify(options) !== JSON.stringify(cacheOptions)) {
    cachedSnapshot = null;
    cacheOptions = options;
  }

  if (!cachedSnapshot) {
    cachedSnapshot = createSnapshot(options || cacheOptions);
  }

  return cachedSnapshot;
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
 * Automatically recalculates all precedence conflicts after the update.
 * @param updater - Function that receives the current snapshot and returns updated snapshot
 */
export function updateSnapshot(
  updater: (snapshot: ScheduleSnapshot) => ScheduleSnapshot
): ScheduleSnapshot {
  const current = getSnapshot();
  let updated = updater(current);
  updated.version += 1;
  updated.generatedAt = new Date().toISOString();

  // Automatically recalculate conflicts and late jobs after every update
  updated = updateSnapshotConflicts(updated);
  updated = { ...updated, lateJobs: identifyLateJobs(updated.jobs, updated.tasks, updated.assignments) };

  cachedSnapshot = updated;
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
  const snapshot = getSnapshot();
  return getTasksForJobHelper(jobId, snapshot.tasks, snapshot.elements);
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
