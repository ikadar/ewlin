/**
 * Mock Data Module
 * Public API for mock data generation and access.
 */

// Snapshot cache (primary API)
export {
  createSnapshot,
  getSnapshot,
  invalidateSnapshot,
  updateSnapshot,
  getJobById,
  getTasksForJob,
  getAssignmentForTask,
  getStationById,
  getProviderById,
  type SnapshotOptions,
} from './snapshot';

// Individual generators (for advanced use cases)
export {
  // Station generators
  generateStationCategories,
  generateStationGroups,
  generateOperatingSchedule,
  generateScheduleExceptions,
  generateStations,
  generateProviders,
  generateAllStationData,
  type StationData,

  // Job generators
  generateTasksForJob,
  generateJobs,
  identifyLateJobs,
  type JobData,

  // Assignment generators
  generateAssignments,
  generateConflicts,
  generateAllAssignmentData,
  type AssignmentData,
} from './generators';
