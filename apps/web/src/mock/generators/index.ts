/**
 * Generator Exports
 * Central export point for all mock data generators.
 */

export {
  generateStationCategories,
  generateStationGroups,
  generateOperatingSchedule,
  generateScheduleExceptions,
  generateStations,
  generateProviders,
  generateAllStationData,
  type StationData,
} from './stations';

export {
  generateElement,
  getRandomJobPattern,
  type JobPattern,
  type JobPatternConfig,
} from './elements';

export {
  generateTasksForJob,
  generateTasksForElement,
  generateJobs,
  identifyLateJobs,
  type JobData,
} from './jobs';

export {
  generateAssignments,
  generateConflicts,
  generateAllAssignmentData,
  createStretchedAssignment,
  type AssignmentData,
} from './assignments';
