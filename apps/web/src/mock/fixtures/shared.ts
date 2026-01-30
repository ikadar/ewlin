import type {
  ScheduleSnapshot,
  Station,
  StationCategory,
  StationGroup,
  Job,
  Element,
  Task,
  OutsourcedProvider,
  DaySchedule,
} from '@flux/types';

// ============================================================================
// Common Data (shared across fixtures)
// ============================================================================

export const standardDaySchedule: DaySchedule = {
  isOperating: true,
  slots: [
    { start: '06:00', end: '12:00' },
    { start: '13:00', end: '22:00' },
  ],
};

export const closedDaySchedule: DaySchedule = {
  isOperating: false,
  slots: [],
};

// 7-day operating schedule for tests that need to run on any day of the week
export const sevenDayOperatingSchedule = {
  monday: standardDaySchedule,
  tuesday: standardDaySchedule,
  wednesday: standardDaySchedule,
  thursday: standardDaySchedule,
  friday: standardDaySchedule,
  saturday: standardDaySchedule,
  sunday: standardDaySchedule,
};

export const categories: StationCategory[] = [
  {
    id: 'cat-offset',
    name: 'Presses Offset',
    description: 'Machines d\'impression offset',
    similarityCriteria: [],
  },
  {
    id: 'cat-cutting',
    name: 'Massicots',
    description: 'Machines de découpe',
    similarityCriteria: [],
  },
];

export const groups: StationGroup[] = [
  {
    id: 'grp-offset',
    name: 'Presses Offset',
    maxConcurrent: 10,
    isOutsourcedProviderGroup: false,
  },
  {
    id: 'grp-cutting',
    name: 'Massicots',
    maxConcurrent: 10,
    isOutsourcedProviderGroup: false,
  },
];

export const stations: Station[] = [
  {
    id: 'station-komori',
    name: 'Komori G40',
    status: 'Available',
    categoryId: 'cat-offset',
    groupId: 'grp-offset',
    capacity: 1,
    operatingSchedule: {
      monday: standardDaySchedule,
      tuesday: standardDaySchedule,
      wednesday: standardDaySchedule,
      thursday: standardDaySchedule,
      friday: standardDaySchedule,
      saturday: closedDaySchedule,
      sunday: closedDaySchedule,
    },
    exceptions: [],
  },
  {
    id: 'station-heidelberg',
    name: 'Heidelberg Speedmaster',
    status: 'Available',
    categoryId: 'cat-offset',
    groupId: 'grp-offset',
    capacity: 1,
    operatingSchedule: {
      monday: standardDaySchedule,
      tuesday: standardDaySchedule,
      wednesday: standardDaySchedule,
      thursday: standardDaySchedule,
      friday: standardDaySchedule,
      saturday: closedDaySchedule,
      sunday: closedDaySchedule,
    },
    exceptions: [],
  },
  {
    id: 'station-polar',
    name: 'Polar 137',
    status: 'Available',
    categoryId: 'cat-cutting',
    groupId: 'grp-cutting',
    capacity: 1,
    operatingSchedule: {
      monday: standardDaySchedule,
      tuesday: standardDaySchedule,
      wednesday: standardDaySchedule,
      thursday: standardDaySchedule,
      friday: standardDaySchedule,
      saturday: closedDaySchedule,
      sunday: closedDaySchedule,
    },
    exceptions: [],
  },
];

export const providers: OutsourcedProvider[] = [];

// ============================================================================
// Helper Functions
// ============================================================================

export const today = new Date();
today.setHours(0, 0, 0, 0);

export function isoDate(hours: number, minutes: number = 0, daysOffset: number = 0): string {
  const d = new Date(today);
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

export function baseSnapshot(): Omit<ScheduleSnapshot, 'jobs' | 'elements' | 'tasks' | 'assignments' | 'conflicts' | 'lateJobs'> {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    stations,
    categories,
    groups,
    providers,
  };
}

/**
 * Job without elementIds - used for fixture definitions.
 * The generateElementsForJobs function will add elementIds automatically.
 */
export type JobWithoutElementIds = Omit<Job, 'elementIds'>;

/**
 * Options for generating elements with custom prerequisites.
 */
export interface ElementGeneratorOptions {
  paperStatus?: 'none' | 'in_stock' | 'to_order' | 'ordered' | 'delivered';
  batStatus?: 'none' | 'waiting_files' | 'files_received' | 'bat_sent' | 'bat_approved';
  plateStatus?: 'none' | 'to_make' | 'ready';
}

/**
 * Generate elements for jobs and add elementIds to jobs.
 * For v0.4.1+, mutates jobs to add elementIds and returns elements.
 */
export function generateElementsForJobs(
  jobs: JobWithoutElementIds[],
  tasks: Task[],
  options: ElementGeneratorOptions = {}
): Element[] {
  const {
    paperStatus = 'in_stock',
    batStatus = 'bat_approved',
    plateStatus = 'ready',
  } = options;

  return jobs.map((job) => {
    const elementId = `elem-${job.id}`;
    // Mutate job to add elementIds (side effect for convenience in fixtures)
    (job as Job).elementIds = [elementId];
    return {
      id: elementId,
      jobId: job.id,
      suffix: 'ELT',
      prerequisiteElementIds: [],
      // Tasks have elementId that matches this element's id
      taskIds: tasks.filter((t) => t.elementId === elementId).map((t) => t.id),
      paperStatus,
      batStatus,
      plateStatus,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  });
}
