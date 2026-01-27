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

// Mock API (simulates backend HTTP calls)
export {
  createMockApi,
  mockApi,
  simulateLatency,
  simulateFailure,
  MockApiError,
  type MockApi,
  type MockApiConfig,
  type CreateAssignmentRequest,
  type UpdateAssignmentRequest,
} from './api';

// Reference data (JCF autocomplete presets)
export {
  PAPER_TYPES,
  PRODUCT_FORMATS,
  FEUILLE_FORMATS,
  IMPRESSION_PRESETS,
  SURFACAGE_PRESETS,
  POSTE_PRESETS,
  POSTE_CATEGORIES,
  SOUSTRAITANT_PRESETS,
  TEMPLATE_CATEGORIES,
} from './reference-data';
