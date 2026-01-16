/**
 * Job Generators
 * Generate mock jobs with tasks for testing.
 */

import { faker } from '@faker-js/faker/locale/fr';
import type {
  Job,
  JobStatus,
  PaperPurchaseStatus,
  PlatesStatus,
  Task,
  InternalTask,
  OutsourcedTask,
  TaskStatus,
  LateJob,
  Element,
} from '@flux/types';
import { generateElement, getRandomJobPattern, type JobPatternConfig } from './elements';

// ============================================================================
// Constants
// ============================================================================

const JOB_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#F59E0B', // amber
  '#10B981', // emerald
  '#EF4444', // red
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
];

const PAPER_TYPES = ['CB 135g', 'CB 300g', 'CB 350g', 'Couché mat 170g', 'Couché brillant 250g', 'Offset 80g', 'Kraft 120g'];
const PAPER_FORMATS = ['45x64', '52x74', '63x88', '70x100', 'A4', 'A3', 'SRA3'];
const PAPER_WEIGHTS = [80, 100, 120, 150, 170, 200, 250, 300, 350];
const INKINGS = ['CMYK', '4C+0', '4C+4C', '2C+0', 'Pantone 485+Black', '1C+0'];

const CLIENT_NAMES = [
  'Autosphere',
  'Carrefour',
  'Décathlon',
  'E.Leclerc',
  'FNAC',
  'Galeries Lafayette',
  'Ikea',
  'Leroy Merlin',
  'Mairie de Paris',
  'Orange',
];

const JOB_DESCRIPTIONS = [
  'Cartes de voeux - 9,9 x 21 cm',
  'Brochures A4 - 16 pages',
  'Affiches A2 - quadri',
  'Dépliants 3 volets',
  'Catalogues 48 pages',
  'Flyers A5 - recto/verso',
  'Calendriers muraux',
  'Chemises à rabats',
  'Enveloppes personnalisées',
  'Carnets de bons',
];

const PROVIDER_IDS = ['prov-clement', 'prov-reliure'];
const PROVIDER_ACTION_TYPES: Record<string, string[]> = {
  'prov-clement': ['Pelliculage', 'Dorure', 'Vernis UV'],
  'prov-reliure': ['Reliure dos carré collé', 'Reliure spirale'],
};

// ============================================================================
// Helper Functions
// ============================================================================

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatTimestamp(date: Date): string {
  return date.toISOString();
}

// ============================================================================
// Task Generators
// ============================================================================

interface TaskGeneratorOptions {
  jobId: string;
  elementId: string;
  startSequence?: number;
  includeOutsourced?: boolean;
  /** Force the first task to use this station ID */
  forceFirstStation?: string;
  /** Number of tasks to generate */
  taskCount?: number;
}

function generateInternalTask(
  jobId: string,
  elementId: string,
  sequenceOrder: number,
  stationId: string,
  status: TaskStatus = 'Ready'
): InternalTask {
  const now = new Date();

  // Generate total duration as multiple of 15 minutes (45min to 3h range)
  const totalMinutes = randomInt(3, 12) * 15; // 45, 60, 75, ..., 180

  // Setup is roughly 15-30% of total, rounded to 15 minutes
  const setupPercent = randomInt(15, 30) / 100;
  const rawSetup = totalMinutes * setupPercent;
  const setupMinutes = Math.round(rawSetup / 15) * 15 || 15; // At least 15 min
  const runMinutes = totalMinutes - setupMinutes;

  return {
    id: `task-${jobId}-${sequenceOrder}`,
    jobId,
    elementId,
    sequenceOrder,
    status,
    type: 'Internal',
    stationId,
    duration: {
      setupMinutes,
      runMinutes,
    },
    comment: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
    createdAt: formatTimestamp(now),
    updatedAt: formatTimestamp(now),
  };
}

function generateOutsourcedTask(
  jobId: string,
  elementId: string,
  sequenceOrder: number,
  providerId: string,
  actionType: string,
  status: TaskStatus = 'Ready'
): OutsourcedTask {
  const now = new Date();
  return {
    id: `task-${jobId}-${sequenceOrder}`,
    jobId,
    elementId,
    sequenceOrder,
    status,
    type: 'Outsourced',
    providerId,
    actionType,
    duration: {
      openDays: randomInt(1, 3),
      latestDepartureTime: providerId === 'prov-clement' ? '14:00' : '12:00',
      receptionTime: providerId === 'prov-clement' ? '09:00' : '10:00',
    },
    comment: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.2 }),
    createdAt: formatTimestamp(now),
    updatedAt: formatTimestamp(now),
  };
}

export function generateTasksForElement(options: TaskGeneratorOptions): Task[] {
  const {
    jobId,
    elementId,
    startSequence = 0,
    includeOutsourced = true,
    forceFirstStation,
    taskCount = randomInt(2, 4),
  } = options;
  const tasks: Task[] = [];
  let seq = startSequence;

  // Generate the requested number of tasks
  for (let i = 0; i < taskCount; i++) {
    if (i === 0) {
      // First task: Printing
      const printStation =
        forceFirstStation || randomElement(['sta-komori-g40', 'sta-heidelberg-sm', 'sta-xerox', 'sta-hp-indigo']);
      tasks.push(generateInternalTask(jobId, elementId, seq++, printStation));
    } else if (i === 1) {
      // Second task: Cutting
      const cutStation = randomElement(['sta-polar-137', 'sta-massicot']);
      tasks.push(generateInternalTask(jobId, elementId, seq++, cutStation));
    } else if (i === taskCount - 1 && includeOutsourced && Math.random() > 0.7) {
      // Last task might be outsourced
      const providerId = randomElement(PROVIDER_IDS);
      const actionTypes = PROVIDER_ACTION_TYPES[providerId];
      const actionType = randomElement(actionTypes);
      tasks.push(generateOutsourcedTask(jobId, elementId, seq++, providerId, actionType));
    } else {
      // Other tasks: finishing
      const finishStation = randomElement(['sta-stahl', 'sta-muller', 'sta-horizon']);
      tasks.push(generateInternalTask(jobId, elementId, seq++, finishStation));
    }
  }

  return tasks;
}

/**
 * @deprecated Use generateTasksForElement instead
 */
export function generateTasksForJob(options: Omit<TaskGeneratorOptions, 'elementId'> & { elementId?: string }): Task[] {
  return generateTasksForElement({
    ...options,
    elementId: options.elementId || `elem-${options.jobId}-elt`,
  });
}

// ============================================================================
// Job Generators
// ============================================================================

interface JobGeneratorOptions {
  count?: number;
  includeLateJobs?: number;
  includeConflictJobs?: number;
}

interface GenerateJobOptions {
  index: number;
  isLate?: boolean;
  /** Force the first task to use this station ID */
  forceFirstStation?: string;
  /** Keep the first task unscheduled */
  keepFirstUnscheduled?: boolean;
  /** Ensure all approval gates are satisfied (BAT approved, Plates done) */
  forceApproved?: boolean;
  /** Force a specific job pattern */
  forcePattern?: JobPatternConfig;
}

interface GenerateJobResult {
  job: Job;
  elements: Element[];
  tasks: Task[];
}

function generateJob(options: GenerateJobOptions): GenerateJobResult {
  const {
    index,
    isLate = false,
    forceFirstStation,
    keepFirstUnscheduled = false,
    forceApproved = false,
    forcePattern,
  } = options;
  const now = new Date();
  const jobId = `job-${String(index).padStart(5, '0')}`;

  // Workshop exit date: 5-20 days from now, or in the past for late jobs
  const daysFromNow = isLate ? randomInt(-5, -1) : randomInt(5, 20);
  const workshopExitDate = addDays(now, daysFromNow);

  // Determine job status based on whether it's late
  let status: JobStatus;
  if (isLate) {
    status = 'Delayed';
  } else {
    status = randomElement(['Planned', 'InProgress'] as JobStatus[]);
  }

  // Get job pattern (single-element, multi-sheet, or brochure)
  const pattern = forcePattern || getRandomJobPattern();

  // Generate elements and tasks
  const elements: Element[] = [];
  const allTasks: Task[] = [];
  let globalSequence = 0;

  // Create a map from suffix to element ID for prerequisite resolution
  const suffixToElementId = new Map<string, string>();
  for (const elemConfig of pattern.elements) {
    suffixToElementId.set(elemConfig.suffix, `elem-${jobId}-${elemConfig.suffix.toLowerCase()}`);
  }

  for (const elemConfig of pattern.elements) {
    const elementId = suffixToElementId.get(elemConfig.suffix)!;

    // Resolve prerequisite element IDs
    const prerequisiteElementIds = elemConfig.prerequisiteSuffixes.map(
      (suffix) => suffixToElementId.get(suffix)!
    );

    // Generate tasks for this element
    const tasks = generateTasksForElement({
      jobId,
      elementId,
      startSequence: globalSequence,
      includeOutsourced: Math.random() > 0.4,
      forceFirstStation: elements.length === 0 ? forceFirstStation : undefined,
      taskCount: elemConfig.taskCount,
    });

    globalSequence += tasks.length;

    // Create element
    const element = generateElement({
      jobId,
      suffix: elemConfig.suffix,
      label: elemConfig.label,
      prerequisiteElementIds,
      taskIds: tasks.map((t) => t.id),
    });

    elements.push(element);
    allTasks.push(...tasks);
  }

  // Randomly assign some tasks as Assigned
  const fullyScheduled = !keepFirstUnscheduled && Math.random() > 0.6;
  if (fullyScheduled) {
    allTasks.forEach((task) => {
      (task as InternalTask | OutsourcedTask).status = 'Assigned';
    });
  } else if (Math.random() > 0.5) {
    // Partially scheduled - but keep first unscheduled if requested
    const startIndex = keepFirstUnscheduled ? 1 : 0;
    const maxScheduled = allTasks.length - (keepFirstUnscheduled ? 1 : 0);
    const scheduledCount = randomInt(0, maxScheduled - 1);
    for (let i = startIndex; i < startIndex + scheduledCount && i < allTasks.length; i++) {
      (allTasks[i] as InternalTask | OutsourcedTask).status = 'Assigned';
    }
  }

  const client = randomElement(CLIENT_NAMES);
  const description = randomElement(JOB_DESCRIPTIONS);
  const quantity = randomElement([100, 250, 500, 1000, 2500, 5000]);

  const job: Job = {
    id: jobId,
    reference: `${now.getFullYear()}-${String(index).padStart(4, '0')}`,
    client,
    description: `${description} - ${quantity} ex`,
    status,
    workshopExitDate: formatDate(workshopExitDate),
    fullyScheduled,
    color: JOB_COLORS[index % JOB_COLORS.length],
    paperType: randomElement(PAPER_TYPES),
    paperFormat: randomElement(PAPER_FORMATS),
    paperWeight: randomElement(PAPER_WEIGHTS),
    inking: randomElement(INKINGS),
    paperPurchaseStatus: randomElement(['InStock', 'Ordered', 'Received'] as PaperPurchaseStatus[]),
    proofApproval: forceApproved
      ? {
          sentAt: formatDate(addDays(now, -randomInt(5, 10))),
          approvedAt: formatDate(addDays(now, -randomInt(1, 4))),
        }
      : {
          sentAt: Math.random() > 0.3 ? formatDate(addDays(now, -randomInt(3, 10))) : 'AwaitingFile',
          approvedAt: Math.random() > 0.1 ? formatDate(addDays(now, -randomInt(1, 5))) : null,
        },
    platesStatus: forceApproved ? 'Done' : randomElement(['Todo', 'Done'] as PlatesStatus[]),
    requiredJobIds: [],
    comments: [],
    elementIds: elements.map((e) => e.id),
    taskIds: allTasks.map((t) => t.id),
    createdAt: formatTimestamp(addDays(now, -randomInt(5, 30))),
    updatedAt: formatTimestamp(now),
  };

  return { job, elements, tasks: allTasks };
}

export interface JobData {
  jobs: Job[];
  elements: Element[];
  tasks: Task[];
}

export function generateJobs(options: JobGeneratorOptions = {}): JobData {
  const { count = 15, includeLateJobs = 2, includeConflictJobs = 1 } = options;

  const jobs: Job[] = [];
  const elements: Element[] = [];
  const tasks: Task[] = [];

  // First, generate the QA test job (non-late, with Komori G40, unscheduled, approved)
  const qaResult = generateJob({
    index: 1,
    isLate: false, // NOT late so deadline is in the future
    forceFirstStation: 'sta-komori-g40',
    keepFirstUnscheduled: true,
    forceApproved: true,
  });
  jobs.push(qaResult.job);
  elements.push(...qaResult.elements);
  tasks.push(...qaResult.tasks);

  // Generate late jobs (starting from index 2)
  for (let i = 0; i < includeLateJobs && i + 1 < count; i++) {
    const result = generateJob({
      index: i + 2,
      isLate: true,
    });
    jobs.push(result.job);
    elements.push(...result.elements);
    tasks.push(...result.tasks);
  }

  // Generate normal jobs (after QA job and late jobs)
  // QA job = 1, late jobs = 2 to (includeLateJobs+1), normal jobs start after
  const normalStartIndex = 1 + includeLateJobs + 1; // +1 for QA job, +1 because indexes are 1-based
  for (let i = normalStartIndex; i <= count; i++) {
    const result = generateJob({
      index: i,
      isLate: false,
    });
    jobs.push(result.job);
    elements.push(...result.elements);
    tasks.push(...result.tasks);
  }

  // Mark some jobs for conflicts (will be handled in assignment generator)
  // Just add a marker in the job notes
  for (let i = 0; i < includeConflictJobs && i < jobs.length; i++) {
    jobs[i].notes = 'CONFLICT_TEST';
  }

  return { jobs, elements, tasks };
}

// ============================================================================
// Late Jobs Detection
// ============================================================================

export function identifyLateJobs(jobs: Job[], _tasks?: Task[]): LateJob[] {
  const lateJobs: LateJob[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const job of jobs) {
    const deadline = new Date(job.workshopExitDate);
    deadline.setHours(0, 0, 0, 0);

    // Check if deadline has passed
    if (deadline < today) {
      const delayMs = today.getTime() - deadline.getTime();
      const delayDays = Math.ceil(delayMs / (1000 * 60 * 60 * 24));

      lateJobs.push({
        jobId: job.id,
        deadline: job.workshopExitDate,
        expectedCompletion: formatDate(addDays(today, randomInt(1, 5))),
        delayDays,
      });
    }
  }

  return lateJobs;
}
