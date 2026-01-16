/**
 * Test Scenarios
 *
 * Predefined mock scenarios for testing specific features.
 * Activated via URL parameter: ?scenario=<name>
 *
 * Example: http://localhost:5173/?scenario=brochure-precedence
 */

import type { ScheduleSnapshot, Job, Element, Task, InternalTask } from '@flux/types';
import { generateAllStationData } from './generators';

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimestamp(date: Date): string {
  return date.toISOString();
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Round up to the nearest quarter hour (15 minutes)
 */
function roundUpToQuarterHour(minutes: number): number {
  return Math.ceil(minutes / 15) * 15;
}

// ============================================================================
// Task Builder
// ============================================================================

interface TaskSpec {
  stationId: string;
  setupMinutes?: number;
  runMinutes?: number;
}

function createInternalTask(
  jobId: string,
  elementId: string,
  sequenceOrder: number,
  spec: TaskSpec
): InternalTask {
  const now = new Date();
  // Setup time is kept as-is, only TOTAL duration is rounded up
  const setupMinutes = spec.setupMinutes ?? 15;
  const rawRunMinutes = spec.runMinutes ?? 45;

  // Round TOTAL duration up to nearest quarter hour
  const rawTotal = setupMinutes + rawRunMinutes;
  const roundedTotal = roundUpToQuarterHour(rawTotal);
  const runMinutes = roundedTotal - setupMinutes;

  return {
    id: `task-${jobId}-${sequenceOrder}`,
    jobId,
    elementId,
    sequenceOrder,
    status: 'Ready',
    type: 'Internal',
    stationId: spec.stationId,
    duration: {
      setupMinutes,
      runMinutes,
    },
    createdAt: formatTimestamp(now),
    updatedAt: formatTimestamp(now),
  };
}

// ============================================================================
// Scenario: Brochure Precedence Test
// ============================================================================

/**
 * Single brochure job for testing precedence rules:
 * - COUV: 754 (press) -> P137 (massicot)
 * - INT1: G37 (press) -> Stahl (plieuse)
 * - FIN: H (encarteuse) -> Film -> Carton
 *
 * Dependencies:
 * - FIN depends on COUV and INT1
 * - Within each element: tasks must execute in sequence
 * - After offset press (754, G37): 4h dry time before next task
 */
function createBrochurePrecedenceScenario(): ScheduleSnapshot {
  const now = new Date();
  const stationData = generateAllStationData();

  const jobId = 'job-00001';
  const job: Job = {
    id: jobId,
    reference: `${now.getFullYear()}-0001`,
    client: 'Test Client',
    description: 'Brochure test - Précédences',
    status: 'Planned',
    workshopExitDate: formatDate(addDays(now, 10)),
    fullyScheduled: false,
    color: '#8B5CF6', // violet
    paperType: 'Couché mat 170g',
    paperFormat: '52x74',
    paperWeight: 170,
    inking: 'CMYK',
    paperPurchaseStatus: 'InStock',
    proofApproval: {
      sentAt: formatDate(addDays(now, -5)),
      approvedAt: formatDate(addDays(now, -3)),
    },
    platesStatus: 'Done',
    requiredJobIds: [],
    comments: [],
    elementIds: [],
    taskIds: [],
    createdAt: formatTimestamp(addDays(now, -7)),
    updatedAt: formatTimestamp(now),
  };

  // ============================================================================
  // COUV Element: Cover
  // Tasks: 754 (press offset) -> P137 (massicot)
  // ============================================================================
  const couvElementId = `elem-${jobId}-couv`;
  const couvTasks: InternalTask[] = [
    createInternalTask(jobId, couvElementId, 1, {
      stationId: 'sta-754',
      setupMinutes: 30,
      runMinutes: 90,
    }),
    createInternalTask(jobId, couvElementId, 2, {
      stationId: 'sta-p137',
      setupMinutes: 10,
      runMinutes: 30,
    }),
  ];

  const couvElement: Element = {
    id: couvElementId,
    jobId,
    suffix: 'COUV',
    label: 'Couverture',
    prerequisiteElementIds: [],
    taskIds: couvTasks.map((t) => t.id),
    createdAt: formatTimestamp(now),
    updatedAt: formatTimestamp(now),
  };

  // ============================================================================
  // INT1 Element: Interior
  // Tasks: G37 (press offset) -> Stahl (plieuse)
  // ============================================================================
  const int1ElementId = `elem-${jobId}-int1`;
  const int1Tasks: InternalTask[] = [
    createInternalTask(jobId, int1ElementId, 3, {
      stationId: 'sta-g37',
      setupMinutes: 30,
      runMinutes: 120,
    }),
    createInternalTask(jobId, int1ElementId, 4, {
      stationId: 'sta-stahl',
      setupMinutes: 20,
      runMinutes: 60,
    }),
  ];

  const int1Element: Element = {
    id: int1ElementId,
    jobId,
    suffix: 'INT1',
    label: 'Intérieur',
    prerequisiteElementIds: [],
    taskIds: int1Tasks.map((t) => t.id),
    createdAt: formatTimestamp(now),
    updatedAt: formatTimestamp(now),
  };

  // ============================================================================
  // FIN Element: Finishing
  // Tasks: H (encarteuse) -> Film -> Carton
  // Prerequisites: COUV, INT1
  // ============================================================================
  const finElementId = `elem-${jobId}-fin`;
  const finTasks: InternalTask[] = [
    createInternalTask(jobId, finElementId, 5, {
      stationId: 'sta-h',
      setupMinutes: 20,
      runMinutes: 90,
    }),
    createInternalTask(jobId, finElementId, 6, {
      stationId: 'sta-film',
      setupMinutes: 10,
      runMinutes: 30,
    }),
    createInternalTask(jobId, finElementId, 7, {
      stationId: 'sta-carton',
      setupMinutes: 10,
      runMinutes: 20,
    }),
  ];

  const finElement: Element = {
    id: finElementId,
    jobId,
    suffix: 'FIN',
    label: 'Finition',
    prerequisiteElementIds: [couvElementId, int1ElementId],
    taskIds: finTasks.map((t) => t.id),
    createdAt: formatTimestamp(now),
    updatedAt: formatTimestamp(now),
  };

  // Collect all elements and tasks
  const elements = [couvElement, int1Element, finElement];
  const tasks: Task[] = [...couvTasks, ...int1Tasks, ...finTasks];

  // Update job with element and task IDs
  job.elementIds = elements.map((e) => e.id);
  job.taskIds = tasks.map((t) => t.id);

  return {
    version: 1,
    generatedAt: formatTimestamp(now),
    stations: stationData.stations,
    categories: stationData.categories,
    groups: stationData.groups,
    providers: stationData.providers,
    jobs: [job],
    elements,
    tasks,
    assignments: [], // All tasks unscheduled
    conflicts: [],
    lateJobs: [],
  };
}

// ============================================================================
// Scenario Registry
// ============================================================================

export type ScenarioName = 'brochure-precedence';

const SCENARIOS: Record<ScenarioName, () => ScheduleSnapshot> = {
  'brochure-precedence': createBrochurePrecedenceScenario,
};

/**
 * Get the scenario name from URL parameter
 */
export function getScenarioFromUrl(): ScenarioName | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const scenario = params.get('scenario');

  if (scenario && scenario in SCENARIOS) {
    return scenario as ScenarioName;
  }

  return null;
}

/**
 * Check if a test scenario is requested
 */
export function shouldUseScenario(): boolean {
  return getScenarioFromUrl() !== null;
}

/**
 * Create a snapshot for the requested scenario
 */
export function createScenarioSnapshot(): ScheduleSnapshot | null {
  const scenarioName = getScenarioFromUrl();
  if (!scenarioName) return null;

  const scenarioFactory = SCENARIOS[scenarioName];
  return scenarioFactory();
}

/**
 * Get list of available scenarios for documentation
 */
export function getAvailableScenarios(): Array<{ name: ScenarioName; description: string }> {
  return [
    {
      name: 'brochure-precedence',
      description: 'Single brochure job for testing precedence rules (COUV on 754, INT1 on G37, FIN on H/Film/Carton)',
    },
  ];
}
